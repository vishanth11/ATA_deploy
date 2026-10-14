import { useLiveData } from '../context/LiveDataContext'
import { Card, StatusBadge, EmptyState } from '../components/ui'
import { Radio, ShieldCheck, Siren, Play, Activity } from 'lucide-react'
import { startSimulation } from '../services/api'
import { useState } from 'react'

export default function Junctions() {
  const { junctions, wsStatus, status } = useLiveData()
  const [busy, setBusy] = useState(false)

  const isRunning = status?.system_status === 'running'

  const handleStartSim = async (emergency = false) => {
    setBusy(true)
    try {
      await startSimulation({ steps: 200, emergency, gui: false })
    } catch (_) {}
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-400" />
            Live Corridor Junctions
          </h2>
          <p className="text-sm text-slate-400">
            Real-time signal controllers, light states, and safety gate telemetry across {junctions?.length ?? 0} corridor signals.
          </p>
        </div>

        {!isRunning && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStartSim(false)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-700/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Normal Live SUMO
            </button>
            <button
              onClick={() => handleStartSim(true)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-700/20"
            >
              <Siren className="w-3.5 h-3.5" />
              Emergency Preemption
            </button>
          </div>
        )}
      </div>

      {!junctions?.length ? (
        <Card>
          <EmptyState message={wsStatus === 'disconnected' ? 'Backend API unavailable' : 'No junctions discovered yet'} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {junctions.map((j) => (
            <JunctionCard key={j.junction_id} junction={j} />
          ))}
        </div>
      )}
    </div>
  )
}

function JunctionCard({ junction: j }) {
  const safe = j.safety_approved
  const stateStr = j.current_phase_state || ''
  const hasGreen = stateStr.includes('G') || stateStr.includes('g')
  const hasYellow = stateStr.includes('y') || stateStr.includes('Y')
  const hasRed = stateStr.includes('r') || stateStr.includes('R')

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300 font-mono text-sm">
            {j.junction_id}
          </div>
          <div>
            <span className="font-bold text-white text-base">Junction {j.junction_id}</span>
            <span className="text-[11px] text-slate-400 block font-mono">
              Sim Time: {j.simulation_time != null ? `${j.simulation_time.toFixed(1)}s` : '—'}
            </span>
          </div>
        </div>
        <StatusBadge
          status={safe === true ? 'SAFE' : safe === false ? 'REJECTED' : 'ACTIVE'}
        />
      </div>

      {/* Visual Traffic Light Simulator */}
      <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Signal heads */}
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full border border-slate-800">
            <span
              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                hasRed ? 'bg-red-500 shadow-md shadow-red-500/80 ring-2 ring-red-400/30' : 'bg-red-950/60 opacity-30'
              }`}
            />
            <span
              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                hasYellow ? 'bg-yellow-400 shadow-md shadow-yellow-400/80 ring-2 ring-yellow-300/30' : 'bg-yellow-950/60 opacity-30'
              }`}
            />
            <span
              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                hasGreen ? 'bg-emerald-400 shadow-md shadow-emerald-400/80 ring-2 ring-emerald-300/30' : 'bg-emerald-950/60 opacity-30'
              }`}
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Phase #{j.current_phase_index ?? '0'}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-500 block uppercase">Signal Countdown</span>
          <span className="text-sm font-bold font-mono text-white">
            {j.remaining_time != null ? `${j.remaining_time.toFixed(1)}s` : 'Hold'}
          </span>
        </div>
      </div>

      {/* Junction telemetry fields */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">Light State Vector:</span>
          <code className="text-blue-300 font-mono bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/50 text-[11px]">
            {j.current_phase_state ?? '—'}
          </code>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">Current Decision:</span>
          <span className="font-semibold text-slate-200 font-mono">{j.last_decision ?? '—'}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">AI Controller Method:</span>
          <span className="font-semibold text-purple-300">{j.decision_method ?? '—'}</span>
        </div>

        {/* Emergency Preemption Banner */}
        {j.emergency_active && (
          <div className="mt-2 text-xs text-red-300 font-semibold bg-red-500/15 border border-red-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
            <Siren className="w-4 h-4 text-red-400 animate-pulse" />
            <span>Emergency Corridor Active {j.emergency_vehicle_id ? `(#${j.emergency_vehicle_id})` : ''}</span>
          </div>
        )}

        {/* Safety Gate verification list */}
        {j.safety_checks && (
          <div className="mt-3 pt-2.5 border-t border-slate-700/50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Safety Gate Verification Checklist:
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              {Object.entries(j.safety_checks).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-slate-900/40 px-2 py-1 rounded border border-slate-800">
                  <span className="text-slate-400 truncate pr-1 capitalize">{k.replace('_', ' ')}</span>
                  <span className={v ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {v ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
