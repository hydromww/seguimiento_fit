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
export const InfoIcon = () => <Icon size={20}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>
export const BackIcon = () => <Icon><path d="m15 18-6-6 6-6" /></Icon>
export const EditIcon = () => <Icon size={18}><path d="M4 20h4L19 9l-4-4L4 16z" /></Icon>

// Íconos de los objetivos y opciones del asistente de metas.
const OBJECTIVE_PATHS: Record<string, ReactNode> = {
  perder: <path d="M12 4v16M6 14l6 6 6-6" />,
  recomposicion: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  ganar: <path d="M12 20V4M6 10l6-6 6 6" />,
  mantener: <path d="M5 9h14M5 15h14" />,
  rendimiento: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  sano: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  check: <path d="m5 12 5 5 9-10" />,
  sliders: <><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" /></>,
  map: <><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" /><path d="M9 4v14M15 6v14" /></>,
}
export const ObjectiveIcon = ({ id }: { id: string }) => <Icon size={20}>{OBJECTIVE_PATHS[id]}</Icon>
export const ScaleIcon = () => <Icon size={20}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 10a3 3 0 0 1 6 0M12 10l1.5-2" /></Icon>
export const ReviewIcon = () => <Icon size={20}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>
export const SwapIcon = () => <Icon size={16} width={2.4}><path d="M7 7h11l-3-3M17 17H6l3 3" /></Icon>
export const DumbbellIcon = () => <Icon><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /></Icon>
export const RunIcon = () => <Icon size={20}><circle cx="14" cy="4.5" r="1.8" /><path d="M10 21l2-6 3 3v3M7 12l3-3 4 1 3 3M6 21l3-6" /></Icon>
export const CheckIcon = () => <Icon size={16} width={3}><path d="m5 12 5 5 9-10" /></Icon>
