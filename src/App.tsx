// La estructura general de la app: título, pantalla actual y menú inferior.
import { useState } from 'react'
import { FoodsScreen } from './components/FoodsScreen'

const TABS = [
  { id: 'foods', label: 'Alimentos' },
  { id: 'goals', label: 'Metas' },
  { id: 'today', label: 'Hoy' },
  { id: 'plans', label: 'Planes' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<Tab>('foods')
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="app">
      <header className="top">
        <h1>{current.label}</h1>
      </header>
      <main>
        {tab === 'foods' ? <FoodsScreen /> : <p className="empty">Esta parte la construimos en las próximas etapas.</p>}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
