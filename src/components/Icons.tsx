// Íconos de la app, dibujados con SVG (líneas simples que toman el color del texto).
import type { ReactNode } from 'react'

function Icon({ size = 22, width = 2.2, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const PlusIcon = () => <Icon width={2.4}><path d="M12 5v14M5 12h14" /></Icon>
export const SearchIcon = () => <Icon size={20}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>
export const ScanIcon = () => (
  <Icon><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" /></Icon>
)
export const GlobeIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Icon>
export const StarIcon = () => <Icon><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Icon>
export const FoodIcon = () => <Icon size={20}><path d="M7 3v7a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10" /></Icon>
export const GoalIcon = () => <Icon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icon>
export const TodayIcon = () => <Icon><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Icon>
export const PlanIcon = () => <Icon><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" /></Icon>
