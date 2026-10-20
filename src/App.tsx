// La estructura general de la app: saludo y título, pantalla actual y menú flotante.
import { useState } from 'react'
import { FoodsScreen } from './components/FoodsScreen'
import { TodayScreen } from './components/TodayScreen'
import { GoalsScreen } from './components/GoalsScreen'
import { FoodIcon, GoalIcon, PlanIcon, TodayIcon } from './components/Icons'
import { NOMBRE } from './lib/perfil'

const TABS = [
  { id: 'foods', label: 'Alimentos', title: '¿Qué vas a comer hoy?', icon: FoodIcon },
  { id: 'goals', label: 'Metas', title: 'Tus metas', icon: GoalIcon },
  { id: 'today', label: 'Hoy', title: 'Tu día', icon: TodayIcon },
  { id: 'plans', label: 'Planes', title: 'Planes de alimentación', icon: PlanIcon },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  // La app abre en "Hoy", que es lo que más se usa.
  const [tab, setTab] = useState<Tab>('today')
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="app">
      {/* "Hoy" y "Metas" traen su propio encabezado. */}
      {(tab === 'foods' || tab === 'plans') && (
        <header className="top">
          <span className="greeting">Hola, {NOMBRE}</span>
          <h1>{current.title}</h1>
        </header>
      )}
      <main>
        {tab === 'foods' && <FoodsScreen />}
        {tab === 'today' && <TodayScreen />}
        {tab === 'goals' && <GoalsScreen />}
        {tab === 'plans' && <p className="empty">Esta parte la construimos en las próximas etapas.</p>}
      </main>
      {/* Menú flotante: la pestaña activa muestra su nombre, las demás solo el ícono. */}
      <nav className="tabs" aria-label="Secciones">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={id === tab ? 'tab active' : 'tab'}
            aria-label={label}
            aria-current={id === tab ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon />
            {id === tab && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}
