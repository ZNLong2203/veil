import type { ReactNode, SVGProps } from 'react'

function Icon({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const ShieldIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5c0 4.5 2.9 8.3 7 10 4.1-1.7 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
)
export const ChipIcon = (p: P) => (
  <Icon {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
  </Icon>
)
export const CloudIcon = (p: P) => (
  <Icon {...p}>
    <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 .5 9.5H7Z" />
  </Icon>
)
export const CodeIcon = (p: P) => (
  <Icon {...p}>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
  </Icon>
)
export const BlockIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m6 6 12 12" />
  </Icon>
)
export const AlertIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 4 3 20h18L12 4Z" />
    <path d="M12 10v4M12 17.2v.1" />
  </Icon>
)
export const CameraIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)
export const FileIcon = (p: P) => (
  <Icon {...p}>
    <path d="M7 3h7l4 4v14H7V3Z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </Icon>
)
export const XIcon = (p: P) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
)
export const PlaneIcon = (p: P) => (
  <Icon {...p}>
    <path d="m3 11 18-7-6 17-3-7-9-3Z" />
  </Icon>
)
export const LockIcon = (p: P) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
)
export const EyeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)
export const CalendarIcon = (p: P) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </Icon>
)
export const CopyIcon = (p: P) => (
  <Icon {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
)
export const SunIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Icon>
)
export const MoonIcon = (p: P) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Icon>
)
export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)
export const DocIcon = (p: P) => (
  <Icon {...p}>
    <path d="M7 3h7l4 4v14H7V3Z" />
    <path d="M14 3v4h4M10 12h5M10 16h3" />
  </Icon>
)
export const HomeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 11 12 4l8 7v9H4v-9Z" />
    <path d="M10 20v-6h4v6" />
  </Icon>
)
export const HeartIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </Icon>
)
export const ArrowIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export function Logo({ size = 34 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="veil-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c6cf0" />
          <stop offset="1" stopColor="#3b2db0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#veil-g)" />
      <path d="M16 6.5 8 9.8v5.6c0 4.6 3.1 8.2 8 10.1 4.9-1.9 8-5.500 8-10.100V9.800L16 6.500Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11.500 14.500c1.300 2.700 2.700 4 4.500 4s3.200-1.300 4.500-4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
    </svg>
  )
}
