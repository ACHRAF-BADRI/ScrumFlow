import { useId } from 'react';

/**
 * ScrumFlow mark: a stack of three task cards, each with its status dot
 * (stuck / working on it / done), using the app's status colors.
 * Keep in sync with public/favicon.svg.
 */
export default function LogoMark({ className = 'h-8 w-8' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B7DFF" />
          <stop offset="0.5" stopColor="#6161FF" />
          <stop offset="1" stopColor="#3B2FCB" />
        </linearGradient>
        <linearGradient id={`${id}shine`} x1="32" y1="0" x2="32" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#1B1466" floodOpacity="0.3" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}bg)`} />
      <path d="M0 18C0 8 8 0 18 0h28c10 0 18 8 18 18v6c-10 6-21 8-32 8S10 30 0 24z" fill={`url(#${id}shine)`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="17.25" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.5" />
      <g filter={`url(#${id}shadow)`}>
        <rect x="13" y="13" width="38" height="11" rx="5.5" fill="#fff" />
        <circle cx="19.5" cy="18.5" r="2.8" fill="#E2445C" />
        <rect x="26" y="17" width="12" height="3" rx="1.5" fill="#6161FF" fillOpacity="0.35" />
        <rect x="13" y="26.5" width="38" height="11" rx="5.5" fill="#fff" />
        <circle cx="19.5" cy="32" r="2.8" fill="#FDAB3D" />
        <rect x="26" y="30.5" width="16" height="3" rx="1.5" fill="#6161FF" fillOpacity="0.35" />
        <rect x="13" y="40" width="38" height="11" rx="5.5" fill="#fff" />
        <circle cx="19.5" cy="45.5" r="2.8" fill="#00C875" />
        <rect x="26" y="44" width="20" height="3" rx="1.5" fill="#6161FF" fillOpacity="0.35" />
      </g>
    </svg>
  );
}
