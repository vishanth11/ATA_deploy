import { useState } from 'react'
import { useLiveData } from '../context/LiveDataContext'
import { startSimulation, stopSimulation } from '../services/api'
import { Play, Square, Siren, Loader2, RadioTower } from 'lucide-react'

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
    <header className="fixed left-0 right-0 top-0 z-20 flex min-h-16 items-center gap-4 border-b border-slate-700/60 bg-slate-950/90 px-3 shadow-lg shadow-slate-950/30 backdrop-blur md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 md:hidden">
          <RadioTower className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-white">AI Traffic Adaptation</h1>
          <p className="hidden text-xs text-slate-400 sm:block">Real-time signal intelligence center</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <div className="hidden items-center gap-2 border-r border-slate-800 pr-3 sm:flex">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-600/20 px-2.5 py-1.5 font-medium text-rose-300 transition hover:bg-rose-600/30 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
              Stop SUMO
            </button>
          ) : (
            <>
              <button
                onClick={() => handleStart(false)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-600/20 px-2.5 py-1.5 font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Run SUMO
              </button>
              <button
                onClick={() => handleStart(true)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-600/20 px-2.5 py-1.5 font-medium text-amber-300 transition hover:bg-amber-600/30 disabled:opacity-50"
              >
                <Siren className="w-3.5 h-3.5" />
                Emergency Demo
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-900/70 px-2.5 py-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor} ${wsStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <span className={`${wsColor} hidden sm:inline`}>{wsLabel}</span>
        </div>

        <div className="hidden text-slate-400 lg:block">
          SUMO: <span className={isRunning ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
            {isRunning ? 'Running' : sysStatus === 'stopped' ? 'Stopped' : sysStatus}
          </span>
        </div>

        <div className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2.5 py-1.5 text-slate-400">
          <span className="hidden sm:inline">Sim Time: </span><span className="font-mono text-white">{formatTime(simTime)}</span>
        </div>
      </div>
    </header>
  )
}
