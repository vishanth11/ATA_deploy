// components/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Radio, Brain, ShieldAlert, Eye,
  ScrollText, BarChart3, Activity, Settings, ChevronLeft, ChevronRight
} from 'lucide-react'

const NAV = [
  { label: 'Main', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/junctions', icon: Radio, label: 'Live Junctions' },
    { to: '/decisions', icon: Brain, label: 'AI Decisions' },
    { to: '/safety', icon: ShieldAlert, label: 'Safety & Emergency' },
    { to: '/perception', icon: Eye, label: 'Perception & Risk' },
    { to: '/logs', icon: ScrollText, label: 'System Logs' },
    { to: '/metrics', icon: BarChart3, label: 'Performance Metrics' },
  ]},
  { label: 'System', items: [
    { to: '/system', icon: Activity, label: 'System Status' },
    { to: '/config', icon: Settings, label: 'Configuration' },
  ]},
]

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className={`
      fixed left-0 top-0 z-30 hidden h-full flex-col
      border-r border-slate-700/60 bg-slate-950/95 shadow-2xl shadow-slate-950/40 backdrop-blur md:flex
      transition-all duration-200
      ${collapsed ? 'w-14' : 'w-56'}
    `}>
      <div className="flex min-h-16 items-center gap-2 border-b border-slate-700/50 px-3 py-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
          <Radio className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-bold leading-tight text-white">AI TRAFFIC</p>
            <p className="text-xs leading-tight text-slate-400">Operations</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase text-slate-500">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => `
                      flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors
                      ${isActive
                        ? 'border border-cyan-400/25 bg-cyan-400/10 text-cyan-200'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}
                    `}
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center justify-center border-t border-slate-700/50 p-3 text-slate-500 transition-colors hover:text-slate-300"
        title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
