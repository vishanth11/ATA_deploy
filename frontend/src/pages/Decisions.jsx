import { useState } from 'react'
import { useLiveData } from '../context/LiveDataContext'
import { Card, StatusBadge, EmptyState } from '../components/ui'
import { Brain, Filter, ShieldCheck, Siren, Activity, CheckCircle2 } from 'lucide-react'

const METHOD_COLORS = {
  ai_adaptive: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  emergency_preemption: 'text-red-400 bg-red-500/10 border-red-500/30',
  density_fallback: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  rule_fallback: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  fixed_time: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
}

export default function Decisions() {
  const { decisions } = useLiveData()
  const [selectedJunction, setSelectedJunction] = useState('ALL')
  const [selectedMethod, setSelectedMethod] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const allDecisions = decisions || []

  // Filter
  const filtered = allDecisions.filter((d) => {
    if (selectedJunction !== 'ALL' && d.junction !== selectedJunction) return false
    if (selectedMethod !== 'ALL' && d.method !== selectedMethod) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const junc = (d.junction || '').toLowerCase()
      const phase = (d.selected || d.selected_phase || '').toLowerCase()
      const method = (d.method || '').toLowerCase()
      if (!junc.includes(term) && !phase.includes(term) && !method.includes(term)) return false
    }
    return true
  })

  // Statistics
  const aiCount = allDecisions.filter((d) => d.method === 'ai_adaptive').length
  const emergencyCount = allDecisions.filter((d) => d.emergency_active || d.method === 'emergency_preemption').length
  const fallbackCount = allDecisions.filter((d) => d.method && d.method.includes('fallback')).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          AI Decision Stream & Fallback Audit
        </h2>
        <p className="text-sm text-slate-400">
          Complete decision log from the Spatio-Temporal GNN and multi-tiered fallback controller ({allDecisions.length} recorded).
        </p>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400">Total Decisions</span>
          <p className="text-lg font-bold text-white font-mono mt-0.5">{allDecisions.length}</p>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <span className="text-[11px] text-purple-400">GNN AI Adaptive</span>
          <p className="text-lg font-bold text-purple-300 font-mono mt-0.5">{aiCount}</p>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <span className="text-[11px] text-red-400">Emergency Preemptions</span>
          <p className="text-lg font-bold text-red-300 font-mono mt-0.5">{emergencyCount}</p>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <span className="text-[11px] text-amber-400">Rule/Density Fallbacks</span>
          <p className="text-lg font-bold text-amber-300 font-mono mt-0.5">{fallbackCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card title="Decision Log & Filter Controls">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>

            {/* Junction filter */}
            <select
              value={selectedJunction}
              onChange={(e) => setSelectedJunction(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Junctions</option>
              <option value="A0">Junction A0</option>
              <option value="B0">Junction B0</option>
              <option value="C0">Junction C0</option>
            </select>

            {/* Method filter */}
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Decision Methods</option>
              <option value="ai_adaptive">AI Adaptive (GNN)</option>
              <option value="emergency_preemption">Emergency Preemption</option>
              <option value="rule_fallback">Rule Fallback</option>
              <option value="density_fallback">Density Fallback</option>
              <option value="fixed_time">Fixed Time</option>
            </select>
          </div>

          <div className="text-xs text-slate-400">
            Showing <strong className="text-white font-mono">{filtered.length}</strong> of {allDecisions.length}
          </div>
        </div>

        {/* Decisions Table */}
        {!filtered.length ? (
          <EmptyState message="No matching decisions found for current filter criteria" />
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800 text-left">
                  <th className="py-2.5 px-3">Sim Time</th>
                  <th className="py-2.5 px-3">Junction</th>
                  <th className="py-2.5 px-3">Selected Phase</th>
                  <th className="py-2.5 px-3">Decision Method</th>
                  <th className="py-2.5 px-3">Safety Gate</th>
                  <th className="py-2.5 px-3">Emergency Priority</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((d, i) => (
                  <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
                    <td className="py-2 px-3 text-slate-400 font-mono">
                      {(d.time ?? d.simulation_time) != null ? `${Number(d.time ?? d.simulation_time).toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-blue-300">
                      {d.junction ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-200 font-mono font-semibold">
                      {d.selected ?? d.selected_phase ?? '—'}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          METHOD_COLORS[d.method] ?? 'text-slate-300 bg-slate-800 border-slate-700'
                        }`}
                      >
                        {d.method === 'ai_adaptive' ? '🧠 AI ADAPTIVE (GNN)' : d.method?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {d.safety?.approved === true && <StatusBadge status="APPROVED" />}
                      {d.safety?.approved === false && <StatusBadge status="REJECTED" />}
                      {d.safety?.approved == null && <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2 px-3">
                      {d.emergency_active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 inline-flex items-center gap-1">
                          <Siren className="w-3 h-3 text-red-400" />
                          {d.emergency_vehicle_id ? `#${d.emergency_vehicle_id}` : 'ACTIVE'}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
