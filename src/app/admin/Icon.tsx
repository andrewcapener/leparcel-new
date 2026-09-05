/**
 * The admin's line icons. Twenty pixels, 1.5px stroke, currentColor, no fill,
 * drawn on the same 24-unit grid so they sit at one weight beside a
 * letter-spaced caps label.
 *
 * Inline rather than a package: eleven icons is not a dependency, and an
 * icon that ships in the HTML cannot arrive after the nav has painted.
 * Every one is decorative — the label beside it carries the meaning — so
 * they are all aria-hidden and never the only signal.
 */
export type IconName =
  | 'grid' | 'queue' | 'roster' | 'settings' | 'mail' | 'bell' | 'exit'
  | 'external' | 'money' | 'clock' | 'shield' | 'chevron' | 'menu' | 'plus'
  | 'photo' | 'tent'

const PATHS: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7.5" height="7.5" /><rect x="13.5" y="3" width="7.5" height="7.5" /><rect x="3" y="13.5" width="7.5" height="7.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" /></>,
  queue: <><path d="M4 6h16M4 12h16M4 18h9" /><circle cx="18.5" cy="18" r="2.5" /></>,
  roster: <><path d="M3 5h18v14H3z" /><path d="M3 10h18M9 10v9" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" /><path d="m3 7 9 6 9-6" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  exit: <><path d="M9 4H5v16h4" /><path d="M15 8l4 4-4 4M19 12H9" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v6H4V6h6" /></>,
  money: <><rect x="2.5" y="6" width="19" height="12" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.2 2" /></>,
  shield: <><path d="M12 3l7 3v5.5c0 4.4-2.9 7.7-7 9.5-4.1-1.8-7-5.1-7-9.5V6l7-3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  photo: <><rect x="3" y="4.5" width="18" height="15" /><circle cx="8.5" cy="10" r="1.8" /><path d="m3.5 17 5-5 4.5 4.5 3-2.5 4.5 4" /></>,
  /* a market canopy, not a warning triangle: a peaked roof, two poles and
     the ground line under it. The earlier tent was a triangle with a stroke
     down the middle and read as an alert at 18px. */
  tent: <><path d="M2.5 13 12 6l9.5 7" /><path d="M4.5 13v6M19.5 13v6M2.5 19h19" /></>,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
