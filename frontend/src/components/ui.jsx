// components/ui.jsx — shared reusable UI primitives

export function StatusBadge({ status }) {
  const map = {
    SAFE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    LOW: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
    CONNECTED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    DISCONNECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
    CONNECTING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    ACTIVE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    INACTIVE: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    EXECUTED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
    UNAVAILABLE: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    running: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    stopped: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  const cls = map[status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

export function MetricCard({ label, value, sub, icon: Icon, accent = 'blue' }) {
  const accents = {
    blue: 'border-cyan-400/25 bg-cyan-400/8 text-cyan-300',
    green: 'border-emerald-400/25 bg-emerald-400/8 text-emerald-300',
    yellow: 'border-amber-400/25 bg-amber-400/8 text-amber-300',
    red: 'border-rose-400/25 bg-rose-400/8 text-rose-300',
    purple: 'border-violet-400/25 bg-violet-400/8 text-violet-300',
  }
  return (
    <div className={`group rounded-lg border p-4 shadow-lg shadow-slate-950/20 backdrop-blur ${accents[accent] ?? accents.blue}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">{label}</p>
          <p className="break-words text-2xl font-bold leading-tight text-white">{value ?? '—'}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <div className="rounded-md border border-white/10 bg-white/5 p-2 text-current">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  )
}

export function Card({ title, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-700/60 bg-slate-900/70 shadow-xl shadow-slate-950/20 backdrop-blur ${className}`}>
      {title && (
        <div className="border-b border-slate-700/50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
        {message}
      </div>
    </div>
  )
}

export function EmptyState({ message = 'No data available' }) {
  return (
    <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
      {message}
    </div>
  )
}

export function ErrorState({ message = 'Backend unavailable. Trying to reconnect...' }) {
  return (
    <div className="flex items-center justify-center h-32 text-red-400 text-sm">
      <div className="text-center">
        <p className="font-medium">Connection Error</p>
        <p className="text-slate-500 mt-1">{message}</p>
      </div>
    </div>
  )
}

export function CheckRow({ label, value }) {
  const ok = value === true
  const na = value === undefined || value === null
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-700/30 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      {na ? (
        <span className="text-xs text-slate-500">—</span>
      ) : ok ? (
        <span className="text-xs text-emerald-400 font-medium">✓ PASS</span>
      ) : (
        <span className="text-xs text-red-400 font-medium">✗ FAIL</span>
      )}
    </div>
  )
}

export function DataSourceTag({ source }) {
  return (
    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
      Source: {source}
    </span>
  )
}
