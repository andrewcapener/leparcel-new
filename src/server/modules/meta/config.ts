/**
 * The Meta pixel and Conversions API, and the switch that turns them on.
 *
 * Everything here is inert until both halves are configured, the same way
 * email is without RESEND_API_KEY. That matters more than usual: until this
 * is switched on, the privacy page's promise that there is no advertising
 * pixel on the site remains TRUE, and switching it on is a deliberate act
 * with a copy change attached to it, not a deploy nobody noticed.
 */

/**
 * The dataset (pixel) id.
 *
 * MERMADE_DATASET_ID is the name in Vercel. It is deliberately NOT prefixed
 * NEXT_PUBLIC_, and that is fine: <MetaPixel> is a server component, so it
 * reads this here and inlines the id into the script it renders. Nothing
 * client-side ever reads process.env, which is why a plain server variable
 * works where a `use client` component would have needed the prefix. The
 * NEXT_PUBLIC_ name is still accepted so either spelling works.
 *
 * The id is not a secret in any case: it ships in the page to every visitor.
 */
export function pixelId(): string | null {
  return (
    process.env.MERMADE_DATASET_ID?.trim()
    || process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
    || null
  )
}

/**
 * The token that posts events. Server only, and it must stay that way: it can
 * write to the dataset.
 *
 * Trimmed, because a trailing newline picked up pasting into a dashboard
 * survives into the query string as %0A and Graph rejects it with "Cannot
 * parse access token", which is indistinguishable from a revoked token. That
 * exact bug cost the housework-api repo a deploy cycle; its aclifford/token.ts
 * carries the same note.
 */
export function capiToken(): string | null {
  return (
    process.env.MERMADE_META_ACCESS_TOKEN?.trim()
    || process.env.META_CAPI_TOKEN?.trim()
    || null
  )
}

export function capiConfigured(): boolean {
  return Boolean(pixelId() && capiToken())
}

/**
 * Limited Data Use, always on.
 *
 * Mermade is a California business and its shoppers are overwhelmingly
 * Californian, so CPRA applies. LDU is Meta's own switch for it: the event is
 * still received and attributed, but Meta is instructed to restrict how it
 * uses the data. Sending it unconditionally is the honest reading, costs
 * nothing we care about, and means the site is not relying on geolocation
 * being right about who is covered.
 *
 * 1 / 1000 is Meta's documented code for United States / California.
 */
export const LDU = {
  data_processing_options: ['LDU'],
  data_processing_options_country: 1,
  data_processing_options_state: 1000,
} as const
