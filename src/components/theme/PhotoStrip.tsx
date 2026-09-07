/**
 * A filmstrip of the show, running slowly across the page.
 *
 * It replaces the second background-video band, which was the last piece of
 * the old Shopify site still on this page and was full of a venue Mermade no
 * longer uses.
 *
 * A slider was the obvious answer and is the wrong one. An auto-advancing
 * carousel shows one photograph at a time, needs arrows and dots and a pause
 * control, and most people never see the second slide. The argument this band
 * has to make is quantity: a hundred makers, three days, more than you can
 * take in. Quantity is made of things going past, not of one thing at a time.
 *
 * It is also already the page's own language. The homepage runs a text ticker
 * a few hundred pixels below this ("SHOP SMALL · THINK BIG · MERMADE MARKET"),
 * so a strip of photographs reads as a sibling rather than as a widget.
 *
 * Two copies of the list, translated by exactly half the track, is the whole
 * trick: the moment the first copy has fully left, the second is where the
 * first began and the loop is seamless. The second copy is aria-hidden, so a
 * screen reader is read the photographs once rather than twice.
 *
 * Nothing here is interactive and nothing is behind a click, which is the
 * point: it is atmosphere, and the two frames cut off at either edge are what
 * tell you there is more of it.
 */

type Frame = { file: string; alt: string }

export function PhotoStrip({ id, frames }: { id: string; frames: readonly Frame[] }) {
  if (frames.length === 0) return null

  const run = (hidden: boolean) => (
    <div className="mm-strip__run" aria-hidden={hidden || undefined}>
      {frames.map((f) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${hidden ? 'b' : 'a'}-${f.file}`}
          className="mm-strip__frame"
          src={`/photos/strip/${f.file}`}
          alt={hidden ? '' : f.alt}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  )

  return (
    <div className="shopify-section section-photo-strip">
      <div className="mm-strip" id={id}>
        <div className="mm-strip__track">
          {run(false)}
          {run(true)}
        </div>
      </div>
    </div>
  )
}
