export type IconName =
  | 'grid'
  | 'pulse'
  | 'arrow'
  | 'check'
  | 'database'
  | 'network'
  | 'refresh'
  | 'home'
  | 'building'
  | 'users'
  | 'user'
  | 'wallet'
  | 'target'
  | 'bell'
  | 'audit'
  | 'menu'
  | 'close'
  | 'search'
  | 'shield'
  | 'eye'
  | 'eye-off'
  | 'lock'
  | 'logout'
  | 'more'
  | 'chart';

const paths: Record<IconName, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  check: 'M5 12l4 4L19 6',
  database: 'M4 6c0-4 16-4 16 0s-16 4-16 0 M4 6v12c0 4 16 4 16 0V6 M4 12c0 4 16 4 16 0',
  network: 'M3 9a15 15 0 0 1 18 0 M6 13a10 10 0 0 1 12 0 M9 17a5 5 0 0 1 6 0 M12 21h.01',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M18 17a7 7 0 0 1-12 1l-2-3',
  home: 'M3 10 12 3l9 7 M5 9v12h5v-7h4v7h5V9',
  building: 'M5 21V4h14v17 M3 21h18 M9 8h1 M14 8h1 M9 12h1 M14 12h1 M10 21v-5h4v5',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8a3 3 0 0 1-1 6 M22 21v-2a4 4 0 0 0-3-4',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  wallet: 'M4 6h15V3H5a3 3 0 0 0-3 3v13a2 2 0 0 0 2 2h17V7H4 M16 11h6v6h-6z M18 14h.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10 M12 12h.01',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  audit: 'M7 3h10v3H7z M7 4H4v17h16V4h-3 M8 11h8 M8 15h8 M8 18h5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M6 6l12 12 M18 6 6 18',
  search: 'M21 21l-5-5 M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
  shield: 'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7z M9 12l2 2 4-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  'eye-off':
    'M3 3l18 18 M10 5a12 12 0 0 1 12 7 17 17 0 0 1-4 5 M6 6a17 17 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1 M10 10a3 3 0 0 0 4 4',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v12H5z M12 15v3',
  logout: 'M9 4H4v16h5 M13 7l5 5-5 5 M8 12h12',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  chart: 'M4 20V10h3v10z M10 20V6h3v14z M16 20V3h3v17z',
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 ${className}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}
