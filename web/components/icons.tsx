import { useId } from "react";

// RollCall's own icon set: 24px grid, round caps and joins, soft corners; solid dots echo the iris logo.
type Props = { size?: number; strokeWidth?: number; className?: string };

function icon(paths: React.ReactNode) {
  return function Icon({ size = 24, strokeWidth = 1.75, className }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {paths}
      </svg>
    );
  };
}

const dot = (cx: number, cy: number, r = 1.15) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

export const ChevronLeft = icon(<path d="M14.5 5.5 8 12l6.5 6.5" />);
export const ChevronRight = icon(<path d="M9.5 5.5 16 12l-6.5 6.5" />);
export const Plus = icon(<path d="M12 5v14M5 12h14" />);
export const X = icon(<path d="m6.5 6.5 11 11m0-11-11 11" />);
export const Check = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />);

// A lens with its centre dot.
export const Search = icon(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4 4" />
    {dot(10.5, 10.5, 1.4)}
  </>,
);

// Two prints on the pile, the back one peeking out.
export const Images = icon(
  <>
    <path d="M8 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v8" />
    <rect x="4" y="8" width="12.5" height="12" rx="2.5" />
    <path d="m4.5 18 3.5-3.5 2.5 2.5 1.5-1.5 4 3.5" />
    {dot(8.5, 11.75)}
  </>,
);

// A print with the plus breaking out of its corner.
export const ImagePlus = icon(
  <>
    <path d="M13 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V11" />
    <path d="M18 2.5v6M15 5.5h6" />
    <path d="m4.5 17 4-4 3 3 2-2 5.5 5" />
    {dot(9, 8.75)}
  </>,
);

// A calendar page with one day marked by a dot.
export const Calendar = icon(
  <>
    <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
    <path d="M8.5 3.5v4M15.5 3.5v4M4 10.5h16" />
    {dot(12, 15.25, 1.4)}
  </>,
);

export const Download = icon(<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />);
export const Share = icon(
  <path d="M12 3.5v11M8 7.5l4-4 4 4M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" />,
);
export const Trash2 = icon(
  <path d="M4.5 6.5h15M9.5 6.5V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v1.5m-8 0 .9 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.1m-7 4v6m3-6v6" />,
);
export const Copy = icon(
  <>
    <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
    <path d="M15.5 8.5V6.5A2.5 2.5 0 0 0 13 4H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" />
  </>,
);
export const LogOut = icon(<path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10M10.5 12h9m-3.5-3.5 3.5 3.5-3.5 3.5" />);

// Rounded finder squares; the data is dots, like the logo.
export const QrCode = icon(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    {[dot(7, 7), dot(17, 7), dot(7, 17), dot(14.75, 14.75), dot(19.25, 14.75), dot(17, 17), dot(14.75, 19.25), dot(19.25, 19.25)]}
  </>,
);

// A camera body with its lens.
export const Camera = icon(
  <>
    <rect x="3.5" y="7" width="17" height="12.5" rx="3" />
    <path d="m8.5 7 .9-1.6a1.5 1.5 0 0 1 1.3-.8h2.6a1.5 1.5 0 0 1 1.3.8L15.5 7" />
    <circle cx="12" cy="13.2" r="3.4" />
  </>,
);

// Two arrows chasing each other around a lens.
export const SwitchCamera = icon(
  <>
    <path d="M4.8 10A7.5 7.5 0 0 1 18.4 7.4M19 4.2v3.4h-3.4" />
    <path d="M19.2 14A7.5 7.5 0 0 1 5.6 16.6M5 19.8v-3.4h3.4" />
    <circle cx="12" cy="12" r="2.2" />
  </>,
);

// A film frame: sprocket rails either side.
export const Film = icon(
  <>
    <rect x="4" y="4.5" width="16" height="15" rx="3" />
    <path d="M8.5 4.5v15M15.5 4.5v15M4 9.5h4.5M4 14.5h4.5M15.5 9.5H20M15.5 14.5H20" />
  </>,
);

// A solid, softly rounded play triangle.
export const Play = icon(
  <path
    d="M8.6 6.4v11.2a.9.9 0 0 0 1.4.8l8.6-5.6a.9.9 0 0 0 0-1.5L10 5.6a.9.9 0 0 0-1.4.8z"
    fill="currentColor"
  />,
);

/**
 * Two chain links interlocked along the diagonal. Each link is cut open where the other passes over it,
 * so it reads as a chain on any background.
 */
export function JoinIcon({ size = 24, strokeWidth = 1.75, className }: Props) {
  const id = useId();
  const gap = strokeWidth + 2.2; // width of the cut around the link that passes over
  const link = { x: 1.5, y: 9, width: 12, height: 6, rx: 3 };
  const other = { ...link, x: 10.5 };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <g transform="rotate(-45 12 12)">
        <defs>
          {/* Upper half: the right link passes over the left one. */}
          <clipPath id={`${id}-top`}>
            <rect x="-12" y="-12" width="48" height="24" />
          </clipPath>
          <mask id={`${id}-left`} maskUnits="userSpaceOnUse" x="-12" y="-12" width="48" height="48">
            <rect x="-12" y="-12" width="48" height="48" fill="#fff" stroke="none" />
            <g clipPath={`url(#${id}-top)`}>
              <rect {...other} stroke="#000" strokeWidth={gap} />
            </g>
          </mask>
          {/* Lower half: the left link passes over the right one. */}
          <clipPath id={`${id}-bottom`}>
            <rect x="-12" y="12" width="48" height="24" />
          </clipPath>
          <mask id={`${id}-right`} maskUnits="userSpaceOnUse" x="-12" y="-12" width="48" height="48">
            <rect x="-12" y="-12" width="48" height="48" fill="#fff" stroke="none" />
            <g clipPath={`url(#${id}-bottom)`}>
              <rect {...link} stroke="#000" strokeWidth={gap} />
            </g>
          </mask>
        </defs>
        <rect {...link} mask={`url(#${id}-left)`} />
        <rect {...other} mask={`url(#${id}-right)`} />
      </g>
    </svg>
  );
}
