import type { SVGProps } from "react";

/**
 * The app's mark: a page with one paragraph highlighted and the note that explains it —
 * what the reader does. Follows the theme: outline in currentColor, highlight and note in
 * --accent, the note's lines in --bg (also public/favicon.svg, with fixed colours).
 */
export default function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 36" aria-hidden="true" {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3H20L26 9V31Q26 33 24 33H6Q4 33 4 31V5Q4 3 6 3Z" />
        <path d="M20 3V8Q20 9 21 9H26" />
      </g>
      <rect x="6.5" y="16.6" width="17" height="4.8" rx="1.4" fill="var(--accent)" opacity="0.2" />
      <g strokeWidth="1.8" strokeLinecap="round">
        <path d="M8.5 13.5H17" stroke="currentColor" opacity="0.45" />
        <path d="M8.5 19H21.5" stroke="var(--accent)" />
        <path d="M8.5 24.5H21" stroke="currentColor" opacity="0.45" />
        <path d="M8.5 28.5H15" stroke="currentColor" opacity="0.45" />
      </g>
      <path d="M32 11H38.5Q42 11 42 14.5V21.5Q42 25 38.5 25H32Q29 25 29 22V21L27 19L29 17V14Q29 11 32 11Z" fill="var(--accent)" />
      <g stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M32.2 16H38.8" />
        <path d="M32.2 20H36.2" />
      </g>
    </svg>
  );
}
