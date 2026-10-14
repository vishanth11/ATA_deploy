// services/api.js — REST + WebSocket data layer

const APP_BASE = location.pathname.startsWith('/dashboard') ? '/dashboard' : ''
const BASE = `${APP_BASE}/api`
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${APP_BASE}/ws/live`

export async function fetchStatus() {
  const r = await fetch(`${BASE}/status`)
  return r.json()
}

export async function fetchJunctions() {
  const r = await fetch(`${BASE}/junctions`)
  return r.json()
}

export async function fetchJunction(id) {
  const r = await fetch(`${BASE}/junctions/${id}`)
  if (!r.ok) return null
  return r.json()
}

export async function fetchDecisions() {
  const r = await fetch(`${BASE}/decisions`)
  return r.json()
}

export async function fetchSafety() {
  const r = await fetch(`${BASE}/safety`)
  return r.json()
}

export async function fetchEmergencies() {
  const r = await fetch(`${BASE}/emergencies`)
  return r.json()
}

export async function fetchMetrics() {
  const r = await fetch(`${BASE}/metrics`)
  return r.json()
}

export async function fetchLogs() {
  const r = await fetch(`${BASE}/logs`)
  return r.json()
}

export async function fetchComparison() {
  const r = await fetch(`${BASE}/comparison`)
  return r.json()
}

export async function fetchPerception(frame = null) {
  const url = frame != null ? `${BASE}/perception?frame=${frame}` : `${BASE}/perception`
  const r = await fetch(url)
  if (!r.ok) return null
  return r.json()
}

export async function startSimulation(options = {}) {
  const r = await fetch(`${BASE}/simulation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  return r.json()
}

export async function stopSimulation() {
  const r = await fetch(`${BASE}/simulation/stop`, {
    method: 'POST',
  })
  return r.json()
}

export async function fetchVideoSamples() {
  const r = await fetch(`${BASE}/video/samples`)
  if (!r.ok) return []
  return r.json()
}

export async function fetchLatestVideoAnalysis() {
  const r = await fetch(`${BASE}/video/latest-analysis`)
  if (!r.ok) return null
  return r.json()
}

export async function analyzeSampleVideo(samplePath) {
  const r = await fetch(`${BASE}/video/analyze-sample`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample_path: samplePath }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || 'Video analysis failed')
  }
  return r.json()
}

export async function uploadAndAnalyzeVideo(file) {
  const formData = new FormData()
  formData.append('file', file)
  const r = await fetch(`${BASE}/video/upload-and-analyze`, {
    method: 'POST',
    body: formData,
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || 'Video processing failed')
  }
  return r.json()
}

export function createWebSocket(onMessage, onOpen, onClose) {
  let ws = null
  let reconnectTimer = null
  let isClosed = false

  function connect() {
    if (isClosed) return
    try {
      ws = new WebSocket(WS_URL)
    } catch {
      reconnectTimer = setTimeout(connect, 2500)
      return
    }

    ws.onopen = () => {
      clearTimeout(reconnectTimer)
      onOpen?.()
    }

    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data))
      } catch (_) {}
    }

    ws.onclose = () => {
      onClose?.()
      if (!isClosed) {
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(connect, 2500)
      }
    }

    ws.onerror = () => {
      // Allow browser onclose handler to fire naturally and handle reconnect
    }
  }

  connect()

  return {
    close() {
      isClosed = true
      clearTimeout(reconnectTimer)
      try {
        ws?.close()
      } catch (_) {}
    },
    send(data) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      }
    },
  }
}
