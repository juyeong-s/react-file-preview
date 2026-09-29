import type { ReactNode, SVGProps } from 'react';

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const defaultIcons = {
  zoomIn: (
    <Svg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
    </Svg>
  ),
  zoomOut: (
    <Svg>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M8 11h6" />
    </Svg>
  ),
  prevPage: (
    <Svg>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  ),
  nextPage: (
    <Svg>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  ),
  rotateCw: (
    <Svg>
      <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8" />
      <path d="M21 3v5h-5" />
    </Svg>
  ),
  rotateCcw: (
    <Svg>
      <path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.5 2.7L3 8" />
      <path d="M3 3v5h5" />
    </Svg>
  ),
  download: (
    <Svg>
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </Svg>
  ),
  print: (
    <Svg>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
    </Svg>
  ),
  sidebar: (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Svg>
  ),
  file: (
    <Svg>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </Svg>
  ),
  error: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </Svg>
  ),
  lock: (
    <Svg>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof defaultIcons;
export type Icons = Record<IconName, ReactNode>;
