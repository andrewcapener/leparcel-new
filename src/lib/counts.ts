/**
 * Descriptions that name how many exist say it once, from the capacity column.
 *
 * "Only 6 chosen" on the JR space and "Five of these exist" on priority
 * placement were prose copies of a number the row already holds. Drew moved
 * the JR count to 8 the day after that copy was written, which would have left
 * the page promising six while the system sold eight: the kind of mismatch a
 * maker notices, quotes back, and is right about.
 *
 * So a description writes {{capacity}} and this fills it in at read time, next
 * to the number it is describing. There is nothing to keep in step because
 * there is only one number.
 */

/** The number, or a phrase when there is no cap. */
function count(capacity: number | null): string {
  return capacity === null ? 'a limited number' : String(capacity)
}

/**
 * The token stands for the number and nothing else. An outdoor cap is per day,
 * because each outdoor day is its own space type, and that is said in the
 * description itself ("Only {{capacity}} exist each day") rather than glued on
 * here, which produced "Only 5 each day of these exist."
 */
export function fillCapacity<T extends { description: string; capacity: number | null }>(row: T): T {
  if (!row.description.includes('{{capacity}}')) return row
  return { ...row, description: row.description.split('{{capacity}}').join(count(row.capacity)) }
}
