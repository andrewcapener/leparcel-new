/**
 * The launch preview cookie's name, and nothing else.
 *
 * Its own file because both a server module and a client component need it,
 * and src/lib/preview.ts imports next/headers. Importing that from a client
 * component fails the build with a message about the Pages Router that has
 * nothing to do with the actual problem, so the shared value lives somewhere
 * with no imports at all.
 */
export const PREVIEW_COOKIE = 'mm_preview_window'
