import {
  centsToPlain, toCsv, LINK_COLUMNS, PAYMENT_COLUMNS, linkValues, paymentValues,
  type PaymentRow,
} from './payment-export'

/**
 * These two files carry a fee into an email and a pay link to a stranger, so
 * the things worth testing are the money and the quoting.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* Money. Never a float divide into a string (rule 1): (28000/100).toFixed(2)
   happens to work, but 1e21 cents and negative amounts do not, and a booth
   fee column that a sheet cannot add up is not a booth fee column. */
check('whole dollars keep their cents', centsToPlain(28000) === '280.00')
check('an odd number of cents survives', centsToPlain(34099) === '340.99')
check('single digit cents keep the leading zero', centsToPlain(28005) === '280.05')
check('under a dollar is not blank', centsToPlain(50) === '0.50')
check('zero is a real fee', centsToPlain(0) === '0.00')
check('a credit reads as a credit', centsToPlain(-28000) === '-280.00')
/* The one the sheet actually contains. */
check('the largest fee on the roster', centsToPlain(102000) === '1020.00')
/* No dollar sign, no thousands comma: both stop a sheet summing the column. */
check('no currency furniture', !/[$,]/.test(centsToPlain(102000)))

/* Quoting. A real shop on this roster is "Brighton Awad (Melissa, mom)". */
const csv = toCsv(['a', 'b'], [['Brighton Awad (Melissa, mom)', '280.00']])
check('a comma inside a value does not shift the column',
  csv.split('\r\n')[1] === '"Brighton Awad (Melissa, mom)","280.00"')
check('a quotation mark is doubled',
  toCsv(['a'], [['say "hi"']]).split('\r\n')[1] === '"say ""hi"""')
/* A newline inside a value must not start a new record. Records are split on
   CRLF and the embedded newline is a bare LF inside quotes, so one row stays
   one row: header plus one, not header plus two. */
check('a newline inside a value does not start a new row',
  toCsv(['a'], [['two\nlines']]).split('\r\n').length === 2)
check('rows are CRLF separated', toCsv(['a'], [['1'], ['2']]).split('\r\n').length === 3)

const row: PaymentRow = {
  code: 'MM07', shop: 'Trophy Goods', contact: 'Shea Mullen', email: 'shea@crabandcleek.com',
  track: 'indoor', space: '3x8', fee: '340.00',
  payLink: 'https://mermademarket.com/pay/abc', due: 'Sep 23, 11:59 PM',
  status: 'Awaiting', paidHow: '', paidAt: '', linkSent: '', theirMove: 'Nothing back yet',
}
check('every link column has a value', linkValues(row).length === LINK_COLUMNS.length)
check('every payment column has a value', paymentValues(row).length === PAYMENT_COLUMNS.length)
/* Both files quote the same fee from the same row, which is the entire reason
   they are built from one gather. */
check('the fee is the same number in both files',
  linkValues(row)[LINK_COLUMNS.indexOf('Fee')] === paymentValues(row)[PAYMENT_COLUMNS.indexOf('Fee')])
check('and so is the link',
  linkValues(row)[LINK_COLUMNS.indexOf('Pay link')] === paymentValues(row)[PAYMENT_COLUMNS.indexOf('Pay link')])
/* The mail merge file carries nothing that changes while the merge runs. */
for (const c of ['Status', 'Paid how', 'Paid at', 'Their move']) {
  check(`the links file does not carry "${c}"`, !(LINK_COLUMNS as readonly string[]).includes(c))
}

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('payment export: a fee a sheet can add up, and a comma that never shifts a column')
export {}
