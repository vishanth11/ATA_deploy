// pages/Dashboard.jsx
import { useLiveData } from '../context/LiveDataContext'
import { MetricCard, Card, StatusBadge, EmptyState } from '../components/ui'
import { Radio, Car, Siren, ShieldAlert, Brain, Activity } from 'lucide-react'

function methodLabel(method) {
  if (!method) return null
  const map = {
    ai_adaptive: 'AI ADAPTIVE',
    emergency_preemption: 'EMERGENCY',
    density_fallback: 'DENSITY FALLBACK',
    rule_fallback: 'RULE FALLBACK',
    fixed_time: 'FIXED TIME',
  }
  return map[method] ?? method.toUpperCase()
}

function riskAccent(level) {
  if (level === 'CRITICAL') return 'red'
  if (level === 'HIGH') return 'yellow'
  if (level === 'MEDIUM') return 'yellow'
  return 'green'
}

export default function Dashboard() {
  const { status, junctions, decisions, emergencies, safety, wsStatus } = useLiveData()

  const riskLevel = safety?.risk_level ?? status?.risk_level ?? 'UNKNOWN'
  const method = methodLabel(status?.current_ai_method)
  const recentDecisions = decisions?.slice(0, 5) ?? []
  const systemStatus = status?.system_status ?? 'stopped'

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-cyan-300">Adaptive Signal Control</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Live Traffic Intelligence Dashboard</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Unified view of junction state, safety approvals, emergency preemption, and AI signal decisions.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
              <span className="block text-slate-500">System</span>
              <strong className="text-slate-100">{systemStatus}</strong>
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
              <span className="block text-slate-500">WebSocket</span>
              <strong className={wsStatus === 'connected' ? 'text-emerald-300' : 'text-amber-300'}>{wsStatus}</strong>
            </div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
              <span className="block text-slate-500">Risk</span>
              <strong className="text-slate-100">{riskLevel}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Active Junctions"
          value={junctions?.length ?? '—'}
          icon={Radio}
          accent="blue"
        />
        <MetricCard
          label="Active Vehicles"
          value={status?.vehicle_count ?? '—'}
          icon={Car}
          accent="blue"
        />
        <MetricCard
          label="Emergencies"
          value={emergencies?.length ?? 0}
          icon={Siren}
          accent={emergencies?.length > 0 ? 'red' : 'green'}
        />
        <MetricCard
          label="Current Risk"
          value={riskLevel}
          icon={ShieldAlert}
          accent={riskAccent(riskLevel)}
        />
        <MetricCard
          label="AI Method"
          value={method ?? '—'}
          icon={Brain}
          accent="purple"
        />
      </div>

      <Card title="Junction Overview">
        {!junctions?.length ? (
          <EmptyState message={wsStatus === 'disconnected' ? 'Backend unavailable' : 'No junctions discovered yet'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {junctions.map(j => (
              <JunctionMiniCard key={j.junction_id} junction={j} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent AI Decisions">
        {!recentDecisions.length ? (
          <EmptyState message="No decisions recorded yet" />
        ) : (
          <div className="space-y-2">
            {recentDecisions.map((d, i) => (
              <DecisionRow key={i} decision={d} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function JunctionMiniCard({ junction }) {
  const safe = junction.safety_approved
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 transition hover:border-cyan-400/30 hover:bg-slate-900/70">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{junction.junction_id}</span>
        {safe === true && <StatusBadge status="SAFE" />}
        {safe === false && <StatusBadge status="REJECTED" />}
        {safe == null && <StatusBadge status="UNAVAILABLE" />}
      </div>
      <div className="space-y-1 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>Phase</span>
          <span className="text-slate-300">{junction.last_decision ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Method</span>
          <span className="text-slate-300">{junction.decision_method ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Remaining</span>
          <span className="text-slate-300">
            {junction.remaining_time != null ? `${junction.remaining_time.toFixed(0)}s` : '—'}
          </span>
        </div>
        {junction.emergency_active && (
          <div className="font-medium text-red-400">Emergency Active</div>
        )}
      </div>
    </div>
  )
}

function DecisionRow({ decision }) {
  const approved = decision.safety?.approved
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-700/30 last:border-0 text-xs">
      <span className="text-slate-400 font-mono w-12">{decision.junction ?? '—'}</span>
      <span className="text-slate-300 flex-1">{decision.selected ?? decision.selected_phase ?? '—'}</span>
      <span className="text-slate-500">{decision.method ?? '—'}</span>
      {approved === true && <StatusBadge status="APPROVED" />}
      {approved === false && <StatusBadge status="REJECTED" />}
      {decision.emergency_active && <StatusBadge status="ACTIVE" />}
    </div>
  )
}
