import type { Config } from 'tailwindcss'
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)', 'paper-2': 'var(--paper-2)', 'paper-3': 'var(--paper-3)',
        ink: 'var(--ink)', 'ink-2': 'var(--ink-2)', 'ink-3': 'var(--ink-3)',
        line: 'var(--line)', dark: 'var(--dark)', clay: 'var(--clay)', sage: 'var(--sage)',
      },
      fontFamily: { g: 'var(--font-g)', j: 'var(--font-j)', c: 'var(--font-c)' },
    },
  },
} satisfies Config
