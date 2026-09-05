/**
 * Unit test for transport selection and the service-account credentials.
 *
 * There is no live Google in a test, so this covers the parts that break
 * without one: which transport a given set of environment variables selects,
 * whether a private key pasted in any of the three shapes Vercel produces
 * still signs, whether the assertion Google will be asked to verify actually
 * verifies, and whether anything secret can reach a log line.
 *
 * Run with `npm test`. Dependency-free, in the style of money.test.ts.
 */
import { createVerify, generateKeyPairSync } from 'crypto'
import {
  colLetter, redact, selectTransport, sheetsApiConfig, transportDiagnostics,
} from './transport'
import { normalizePrivateKey, serviceAccount, signAssertion } from './google-auth'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures++; console.error(`  ✗ ${name} ${detail}`) }
}

const KEYS = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'SHEETS_SPREADSHEET_ID',
  'SHEETS_TAB', 'SHEETS_WEBHOOK_URL', 'SHEETS_WEBHOOK_SECRET',
] as const
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
const clear = () => { for (const k of KEYS) delete process.env[k] }

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

// 1 · nothing configured is a silent no-op, exactly like email without a key
clear()
check('no transport when unconfigured', selectTransport() === undefined)
check('diagnostics say so', transportDiagnostics().transport === null)

// 2 · the webhook alone selects apps_script
clear()
process.env.SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfy/exec'
process.env.SHEETS_WEBHOOK_SECRET = 'shh'
check('webhook selected', selectTransport()?.name === 'apps_script', String(selectTransport()?.name))

// 3 · a complete service account wins over the webhook
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sheets@mermade.iam.gserviceaccount.com'
process.env.GOOGLE_PRIVATE_KEY = PEM
process.env.SHEETS_SPREADSHEET_ID = '1AbCdEf'
check('api wins', selectTransport()?.name === 'sheets_api', String(selectTransport()?.name))
check('default tab', sheetsApiConfig()?.tab === 'Applications', String(sheetsApiConfig()?.tab))
process.env.SHEETS_TAB = 'Fall 2026'
check('tab is configurable', sheetsApiConfig()?.tab === 'Fall 2026', String(sheetsApiConfig()?.tab))

// 4 · a half-configured service account falls back rather than failing
delete process.env.SHEETS_SPREADSHEET_ID
check('no spreadsheet id falls back to the webhook',
  selectTransport()?.name === 'apps_script', String(selectTransport()?.name))
process.env.SHEETS_SPREADSHEET_ID = '1AbCdEf'
process.env.GOOGLE_PRIVATE_KEY = 'not a key'
check('an unusable key falls back too',
  selectTransport()?.name === 'apps_script', String(selectTransport()?.name))

// 5 · the three shapes a pasted key arrives in all have to work. This is the
//     one that costs an afternoon: Vercel stores literal backslash-n, and a
//     copy out of the JSON key file arrives wrapped in quotes.
{
  const escaped = PEM.replace(/\n/g, '\\n')
  check('real newlines', normalizePrivateKey(PEM) === PEM.trim())
  check('literal backslash-n', normalizePrivateKey(escaped) === PEM.trim())
  check('quoted and escaped', normalizePrivateKey(`"${escaped}"`) === PEM.trim())
  check('quoted, spaced', normalizePrivateKey(`  '${escaped}'  `) === PEM.trim())
}

// 6 · the assertion Google verifies actually verifies, and says what it must
{
  process.env.GOOGLE_PRIVATE_KEY = PEM.replace(/\n/g, '\\n')   // the Vercel shape
  const sa = serviceAccount()!
  check('service account reads back', Boolean(sa))
  const jwt = signAssertion(sa, 1_800_000_000)
  const [h, c, sig] = jwt.split('.')
  check('three segments', Boolean(h && c && sig))

  const un = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const header = JSON.parse(un(h!).toString())
  const claims = JSON.parse(un(c!).toString())
  check('RS256', header.alg === 'RS256' && header.typ === 'JWT')
  check('issued by the service account',
    claims.iss === 'sheets@mermade.iam.gserviceaccount.com', claims.iss)
  check('scoped to spreadsheets',
    claims.scope === 'https://www.googleapis.com/auth/spreadsheets', claims.scope)
  check('audience is the token endpoint',
    claims.aud === 'https://oauth2.googleapis.com/token', claims.aud)
  check('one hour', claims.exp - claims.iat === 3600, String(claims.exp - claims.iat))

  const v = createVerify('RSA-SHA256')
  v.update(`${h}.${c}`)
  check('signature verifies', v.verify(publicKey, un(sig!)))
}

// 7 · column letters, because the row is 21 wide and the range strings are
//     built from them
check('A', colLetter(1) === 'A')
check('Z', colLetter(26) === 'Z')
check('AA', colLetter(27) === 'AA')
check('AZ', colLetter(52) === 'AZ')

// 8 · nothing secret can reach a log, an outbox row, or /api/health
{
  process.env.SHEETS_WEBHOOK_SECRET = 'super-secret-value'
  process.env.SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfyLongId/exec'
  const dirty = 'POST https://script.google.com/macros/s/AKfyLongId/exec failed, '
    + 'secret=super-secret-value token=ya29.a0AfB_byC123 '
    + `key=${PEM.split('\n').slice(0, 3).join('\n')}`
  const clean = redact(dirty)
  check('webhook url gone', !clean.includes('AKfyLongId'), clean)
  check('secret gone', !clean.includes('super-secret-value'), clean)
  check('access token gone', !clean.includes('ya29.a0AfB_byC123'), clean)
  check('private key gone', !clean.includes('MII') || !clean.includes('BEGIN'), clean)
  check('bounded', redact('x'.repeat(9_999)).length <= 400)
}

// 9 · the health payload carries shapes, never values
{
  const d = transportDiagnostics()
  const blob = JSON.stringify(d)
  check('no private key in diagnostics', !blob.includes('BEGIN'), blob.slice(0, 120))
  check('no secret in diagnostics', !blob.includes('super-secret-value'))
  check('no spreadsheet id in diagnostics', !blob.includes('1AbCdEf'))
  check('but it says what is missing', d.hasWebhookSecret === true && d.hasPrivateKey === true)
}

for (const k of KEYS) {
  if (saved[k] === undefined) delete process.env[k]
  else process.env[k] = saved[k]
}

if (failures) { console.error(`\n${failures} failing assertions`); process.exit(1) }
console.log('sheets: transport selection, credentials and redaction hold')
