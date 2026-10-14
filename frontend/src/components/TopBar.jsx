import { useState } from 'react'
import { useLiveData } from '../context/LiveDataContext'
import { startSimulation, stopSimulation } from '../services/api'
import { Play, Square, Siren, Loader2 } from 'lucide-react'

function formatTime(seconds) {
  if (seconds == null) return '00:00'
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function TopBar() {
  const { wsStatus, status } = useLiveData()
  const [busy, setBusy] = useState(false)

  const sysStatus = status?.system_status ?? 'stopped'
  const isRunning = sysStatus === 'running'
  const simTime = status?.simulation_time ?? 0

  const wsLabel = wsStatus === 'connected' ? 'Connected' : wsStatus === 'connecting' ? 'Connecting' : 'Disconnected'
  const wsColor = wsStatus === 'connected' ? 'text-emerald-400' : wsStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
  const dotColor = wsStatus === 'connected' ? 'bg-emerald-400' : wsStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'

  const handleStart = async (emergency = false) => {
    setBusy(true)
    try {
      await startSimulation({ steps: 200, emergency, gui: false })
    } catch (_) {}
    setBusy(false)
  }

  const handleStop = async () => {
    setBusy(true)
    try {
      await stopSimulation()
    } catch (_) {}
    setBusy(false)
  }

  return (
    <header className="fixed top-0 right-0 left-0 z-20 h-[60px] bg-slate-900/95 border-b border-slate-700/50 backdrop-blur flex items-center px-4 gap-4">
      <div className="flex-1 flex items-center gap-3">
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">AI TRAFFIC ADAPTATION</h1>
          <p className="text-xs text-slate-400">Admin Control Center</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {/* Simulation Controls */}
        <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 font-medium transition cursor-pointer disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
              Stop SUMO
            </button>
          ) : (
            <>
              <button
                onClick={() => handleStart(false)}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 font-medium transition cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Run SUMO
              </button>
              <button
                onClick={() => handleStart(true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 font-medium transition cursor-pointer disabled:opacity-50"
              >
                <Siren className="w-3.5 h-3.5" />
                Emergency Demo
              </button>
            </>
          )}
        </div>

        {/* WS status */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor} ${wsStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <span className={wsColor}>{wsLabel}</span>
        </div>

        {/* SUMO status */}
        <div className="text-slate-400 hidden sm:block">
          SUMO: <span className={isRunning ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
            {isRunning ? 'Running' : sysStatus === 'stopped' ? 'Stopped' : sysStatus}
          </span>
        </div>

        {/* Sim time */}
        <div className="text-slate-400">
          Sim Time: <span className="text-white font-mono">{formatTime(simTime)}</span>
        </div>
      </div>
    </header>
  )
}
