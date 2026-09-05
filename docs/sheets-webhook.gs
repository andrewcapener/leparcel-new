/**
 * Mermade Market: applications land in this Sheet.
 *
 * WHAT TO DO, ONCE. Five minutes.
 *
 *   1. Open the Google Sheet you want the applications in.
 *   2. Extensions ▸ Apps Script. Delete whatever is in the editor and paste
 *      this whole file in.
 *   3. Change SECRET below to a long random string of your own. Anything
 *      unguessable: mash the keyboard, or use a password manager.
 *   4. Save (the disk icon).
 *   5. Deploy ▸ New deployment ▸ gear icon ▸ Web app.
 *        Execute as:        Me
 *        Who has access:    Anyone            ← must be "Anyone"
 *      Deploy, then Authorize access and allow it. Google will warn you that
 *      the script is unverified; it is your own script, choose Advanced ▸
 *      Go to (project name).
 *   6. Copy the Web app URL. It ends in /exec.
 *   7. In Vercel ▸ the project ▸ Settings ▸ Environment Variables, add:
 *        SHEETS_WEBHOOK_URL     = the /exec URL from step 6
 *        SHEETS_WEBHOOK_SECRET  = the same string you set in step 3
 *      Redeploy. Vercel bakes environment variables in at build time, so the
 *      change does nothing until the next deploy.
 *
 * "Who has access: Anyone" sounds alarming and is not the security boundary.
 * The URL is unguessable, and every request must carry the shared secret or it
 * is refused. Anything less than "Anyone" makes Google answer a sign-in page
 * instead of running the script, which is the single commonest reason this
 * does not work.
 *
 * If you change the secret later, change it in both places.
 *
 * WHAT IT DOES. It appends one row per application, and it creates the header
 * row the first time. If an application arrives that is already in the sheet
 * (a retry after a timeout, or someone re-running the sync script), it UPDATES
 * that row instead of adding a second one. It matches on the last column,
 * Application ID, so leave that column alone.
 *
 * You can sort, filter, colour, freeze panes, and add your own columns to the
 * RIGHT of Application ID. Do not reorder or delete the columns it writes.
 */

// ── change this ──────────────────────────────────────────────────────────────
var SECRET = 'change-me-to-something-long-and-random'
// Which tab to write to. It is created if it does not exist.
var TAB = 'Applications'
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents)

    if (!SECRET || SECRET === 'change-me-to-something-long-and-random') {
      return json({ ok: false, error: 'set SECRET in the script' })
    }
    if (body.secret !== SECRET) {
      return json({ ok: false, error: 'bad secret' })
    }
    if (!body.values || !body.values.length) {
      return json({ ok: false, error: 'no values' })
    }

    // One writer at a time. Two applications submitted in the same second
    // would otherwise be able to read the same last row and overwrite each
    // other.
    var lock = LockService.getScriptLock()
    lock.waitLock(20000)
    try {
      var sheet = tab()
      writeHeader(sheet, body.headers)

      var row = body.values.map(text)
      var key = body.key || row[row.length - 1]
      var existing = findRow(sheet, row.length, key)

      if (existing > 0) {
        sheet.getRange(existing, 1, 1, row.length).setValues([row])
        return json({ ok: true, action: 'updated', row: existing })
      }
      sheet.appendRow(row)
      return json({ ok: true, action: 'appended', row: sheet.getLastRow() })
    } finally {
      lock.releaseLock()
    }
  } catch (err) {
    return json({ ok: false, error: String(err) })
  }
}

/** A GET in a browser, so you can check the deployment is live. */
function doGet() {
  return json({ ok: true, service: 'mermade applications', tab: TAB })
}

function tab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(TAB) || ss.insertSheet(TAB)
}

function writeHeader(sheet, headers) {
  if (!headers || !headers.length) return
  if (sheet.getLastRow() > 0) return
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold')
  sheet.setFrozenRows(1)
}

/** The row holding this application id, or 0. The id is the last column. */
function findRow(sheet, width, key) {
  var last = sheet.getLastRow()
  if (last < 2 || !key) return 0
  var ids = sheet.getRange(2, width, last - 1, 1).getValues()
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(key)) return i + 2
  }
  return 0
}

/**
 * Everything is written as text. A maker who types "=IMPORTXML(...)" or
 * "+1-949..." into their shop name must land in a cell as those characters,
 * not as a formula running inside this spreadsheet.
 */
function text(v) {
  var s = v === null || v === undefined ? '' : String(v)
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}
