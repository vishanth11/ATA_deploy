import { useState, useEffect, useRef } from 'react'
import { useLiveData } from '../context/LiveDataContext'
import { Card, MetricCard, EmptyState, DataSourceTag, StatusBadge } from '../components/ui'
import {
  Eye,
  Activity,
  AlertTriangle,
  Video,
  Upload,
  FileVideo,
  Play,
  CheckCircle2,
  AlertOctagon,
  Download,
  Loader2,
  BarChart3,
  Layers,
  Car,
  Siren,
  ShieldAlert,
} from 'lucide-react'
import {
  fetchComparison,
  fetchPerception,
  fetchVideoSamples,
  fetchLatestVideoAnalysis,
  analyzeSampleVideo,
  uploadAndAnalyzeVideo,
} from '../services/api'

export default function Perception() {
  const { safety } = useLiveData()
  const [comparison, setComparison] = useState([])
  const [samples, setSamples] = useState([])
  const [selectedSample, setSelectedSample] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState(null)
  const [activeTab, setActiveTab] = useState('samples') // 'samples' | 'upload'
  const [selectedFile, setSelectedFile] = useState(null)

  // Frame inspector state
  const [selectedFrame, setSelectedFrame] = useState(null)
  const [frameDetections, setFrameDetections] = useState([])
  const [loadingFrame, setLoadingFrame] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchComparison().then(setComparison).catch(() => {})
    fetchVideoSamples().then((list) => {
      setSamples(list)
      if (list.length > 0) {
        // Default to accident_002.mp4 or first sample
        const defaultSample = list.find((s) => s.filename.includes('accident_002')) || list[0]
        setSelectedSample(defaultSample.relative_path)
      }
    }).catch(() => {})

    fetchLatestVideoAnalysis().then((data) => {
      if (data && data.analysis) {
        setAnalysisResult(data)
        initFrameFromAnalysis(data.analysis)
      }
    }).catch(() => {})
  }, [])

  const initFrameFromAnalysis = (analysis) => {
    if (!analysis) return
    const activeFrames = analysis.active_frame_numbers || []
    const firstActive = activeFrames.length > 0 ? activeFrames[0] : 1
    setSelectedFrame(firstActive)
    loadFrameData(firstActive)
  }

  const loadFrameData = async (frameNum) => {
    setLoadingFrame(true)
    try {
      const res = await fetchPerception(frameNum)
      if (res && res.detections) {
        setFrameDetections(res.detections)
      } else {
        setFrameDetections([])
      }
    } catch (_) {
      setFrameDetections([])
    }
    setLoadingFrame(false)
  }

  const handleFrameChange = (frameNum) => {
    setSelectedFrame(frameNum)
    loadFrameData(frameNum)
  }

  const handleAnalyzeSample = async () => {
    if (!selectedSample) return
    setIsProcessing(true)
    setProcessError(null)
    try {
      const res = await analyzeSampleVideo(selectedSample)
      setAnalysisResult(res)
      initFrameFromAnalysis(res.analysis)
    } catch (err) {
      setProcessError(err.message || 'Failed to process sample video')
    }
    setIsProcessing(false)
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return
    setIsProcessing(true)
    setProcessError(null)
    try {
      const res = await uploadAndAnalyzeVideo(selectedFile)
      setAnalysisResult(res)
      initFrameFromAnalysis(res.analysis)
    } catch (err) {
      setProcessError(err.message || 'Failed to process uploaded video')
    }
    setIsProcessing(false)
  }

  const handleDownloadJSON = () => {
    if (!analysisResult) return
    const jsonStr = JSON.stringify(analysisResult, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `perception_analysis_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const riskScore = safety?.risk_score ?? 0
  const nearMissRisk = safety?.near_miss_risk ?? 0
  const confidence = safety?.safety_confidence ?? 0
  const pairRisks = safety?.pair_risks ?? []
  const accidentStatus = safety?.accident_status ?? 'unavailable_no_camera_frame_or_model'
  const isAccidentUnavailable = accidentStatus.includes('unavailable')

  const analysis = analysisResult?.analysis
  const summary = analysis?.summary
  const vehicleTypes = analysis?.vehicle_types || {}
  const emergencyAnalysis = analysis?.emergency_analysis
  const frameStats = analysis?.frame_statistics
  const confStats = analysis?.confidence_statistics
  const trackingCheck = analysis?.tracking_check

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <Eye className="w-6 h-6 text-sky-400" />
          Perception & Video Evidence Analysis
        </h2>
        <p className="text-sm text-slate-400">
          Upload and process real traffic footage using the unified YOLO11n + ByteTrack + Emergency perception pipeline.
        </p>
      </div>

      {/* ============================================================== */}
      {/* VIDEO PIPELINE WORKBENCH (UPLOAD OR SAMPLE)                    */}
      {/* ============================================================== */}
      <Card title="Video Perception Workbench">
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-700/60 pb-3">
            <button
              onClick={() => setActiveTab('samples')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTab === 'samples'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileVideo className="w-4 h-4" />
              Select Real Footage Sample ({samples.length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Video File (MP4, AVI, MOV)
            </button>
          </div>

          {/* Tab 1: Samples */}
          {activeTab === 'samples' && (
            <div className="space-y-3">
              <label className="text-xs text-slate-300 font-medium block">
                Choose Sample Dataset Video:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <select
                    value={selectedSample}
                    onChange={(e) => setSelectedSample(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {samples.map((s) => (
                      <option key={s.relative_path} value={s.relative_path}>
                        [{s.category.toUpperCase()}] {s.filename} ({s.size_mb} MB)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    onClick={handleAnalyzeSample}
                    disabled={isProcessing || !selectedSample}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-700/20"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running Pipeline...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Analyze Selected Footage
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Sample badges */}
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 pt-1">
                <span className="text-slate-500">Quick Test Presets:</span>
                <button
                  type="button"
                  onClick={() => setSelectedSample('data/real_footage_test/accident/accident_002.mp4')}
                  className="px-2 py-0.5 rounded bg-red-950/40 text-red-300 border border-red-800/40 hover:bg-red-900/50 cursor-pointer"
                >
                  ⚡ accident_002.mp4 (Accident)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSample('data/real_footage_test/near miss/near_miss_001.mp4')}
                  className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50 cursor-pointer"
                >
                  ⚡ near_miss_001.mp4 (Near Miss)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSample('data/real_footage_test/normal/normal_001.mp4')}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 cursor-pointer"
                >
                  ⚡ normal_001.mp4 (Normal)
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-900/40 rounded-xl p-6 text-center cursor-pointer transition"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-200">
                  {selectedFile ? selectedFile.name : 'Click or Drag & Drop Video File to Upload'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports MP4, AVI, MOV, MKV. Pipeline runs detection + tracking + emergency classification on GPU.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 text-xs">
                    <FileVideo className="w-4 h-4 text-blue-400" />
                    <span className="font-mono text-slate-200">{selectedFile.name}</span>
                    <span className="text-slate-500">
                      ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    onClick={handleFileUpload}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Upload & Run Analysis
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Status / Errors */}
          {isProcessing && (
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-300 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
              <div>
                <p className="font-semibold">Processing video through Unified Phase 6 Pipeline...</p>
                <p className="text-[11px] text-blue-400 mt-0.5">
                  Running YOLO11n object tracker, ByteTrack association, and emergency classifier on GPU.
                </p>
              </div>
            </div>
          )}

          {processError && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{processError}</span>
            </div>
          )}
        </div>
      </Card>

      {/* ============================================================== */}
      {/* COMPREHENSIVE VIDEO EVIDENCE & PERCEPTION REPORT              */}
      {/* ============================================================== */}
      {summary && (
        <Card title="Video Perception Evidence Report">
          <div className="space-y-6">
            {/* Header info & export */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-700/60">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Analysis Completed: {analysisResult?.filename || 'Evidence Run'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {analysisResult?.elapsed_seconds
                      ? `Execution time: ${analysisResult.elapsed_seconds}s • Output saved to outputs/perception_output.json`
                      : 'Loaded from perception telemetry cache'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleDownloadJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-600 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Evidence JSON
              </button>
            </div>

            {/* PART 1: DETECTION SUMMARY */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Part 1 — Perception Detection Summary
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-[11px] text-slate-400">Total Frames</span>
                  <p className="text-lg font-bold text-white font-mono mt-0.5">{summary.total_frames}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-[11px] text-slate-400">Total Detections</span>
                  <p className="text-lg font-bold text-sky-400 font-mono mt-0.5">{summary.total_detections}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-[11px] text-slate-400">Active Frames</span>
                  <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">{summary.active_frames}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-[11px] text-slate-400">Unique Vehicles</span>
                  <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">{summary.unique_vehicles}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-[11px] text-slate-400">Emergency Events</span>
                  <p className={`text-lg font-bold font-mono mt-0.5 ${summary.emergency_detections > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {summary.emergency_detections}
                  </p>
                </div>
              </div>

              {/* Vehicle / Object Types Counter */}
              <div className="mt-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                <span className="text-xs font-medium text-slate-300 block mb-2">
                  Object & Vehicle Class Distribution:
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(vehicleTypes).length === 0 ? (
                    <span className="text-xs text-slate-500">No objects classified</span>
                  ) : (
                    Object.entries(vehicleTypes).map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs"
                      >
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-300 capitalize font-medium">{type}:</span>
                        <span className="font-mono font-bold text-sky-300">{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* PART 2: EMERGENCY ANALYSIS */}
            {emergencyAnalysis && (
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Siren className="w-4 h-4 text-red-400" />
                  Part 2 — Emergency Vehicle Analysis
                </h4>
                {emergencyAnalysis.emergency_detections > 0 ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-300 flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-red-400" />
                        ACTIVE EMERGENCY IDENTIFIED IN FOOTAGE
                      </span>
                      <span className="text-xs font-mono text-red-400 font-semibold">
                        {emergencyAnalysis.emergency_detections} Emergency Detections
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Tracked Emergency Vehicle IDs:{' '}
                      <strong className="text-white font-mono">
                        {emergencyAnalysis.emergency_vehicle_ids.length > 0
                          ? emergencyAnalysis.emergency_vehicle_ids.map((id) => `#${id}`).join(', ')
                          : 'Unassigned Track ID'}
                      </strong>
                    </p>
                    {emergencyAnalysis.sample_emergency_records?.length > 0 && (
                      <div className="overflow-x-auto pt-1">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-red-500/20 text-left">
                              <th className="py-1 pr-3">Vehicle ID</th>
                              <th className="py-1 pr-3">Confidence</th>
                              <th className="py-1 pr-3">Velocity</th>
                              <th className="py-1">Heading</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emergencyAnalysis.sample_emergency_records.slice(0, 5).map((rec, i) => (
                              <tr key={i} className="border-b border-red-500/10 text-slate-200">
                                <td className="py-1 pr-3 font-mono">#{rec.vehicle_id}</td>
                                <td className="py-1 pr-3 font-mono">{(rec.confidence * 100).toFixed(0)}%</td>
                                <td className="py-1 pr-3 font-mono">{rec.speed != null ? `${rec.speed} km/h` : '—'}</td>
                                <td className="py-1 capitalize">{rec.direction || 'unknown'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 text-xs text-slate-400">
                    ✓ No emergency preemption triggers detected in this video segment.
                  </div>
                )}
              </div>
            )}

            {/* PART 3: FRAME & CONFIDENCE STATISTICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Frame Stats */}
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  Part 3 — Frame Statistics
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Average/Frame</span>
                    <strong className="text-white font-mono text-sm">{frameStats?.average_detections ?? 0}</strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Maximum/Frame</span>
                    <strong className="text-emerald-400 font-mono text-sm">{frameStats?.max_detections ?? 0}</strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Minimum/Frame</span>
                    <strong className="text-slate-400 font-mono text-sm">{frameStats?.min_detections ?? 0}</strong>
                  </div>
                </div>
              </div>

              {/* Confidence Stats */}
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Part 4 — Model Confidence Statistics
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Average Conf</span>
                    <strong className="text-white font-mono text-sm">
                      {confStats?.average_confidence != null ? `${(confStats.average_confidence * 100).toFixed(1)}%` : '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Maximum Conf</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {confStats?.max_confidence != null ? `${(confStats.max_confidence * 100).toFixed(1)}%` : '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Minimum Conf</span>
                    <strong className="text-amber-400 font-mono text-sm">
                      {confStats?.min_confidence != null ? `${(confStats.min_confidence * 100).toFixed(1)}%` : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* PART 4: INTERACTIVE FRAME INSPECTOR */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-400" />
                Part 5 — Interactive Video Frame Inspector
              </h4>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    Viewing Frame: <strong className="text-sky-300 font-mono text-sm">#{selectedFrame ?? '—'}</strong>
                    <span className="text-slate-500">({frameDetections.length} objects detected)</span>
                  </span>
                  {loadingFrame && <span className="text-slate-500 animate-pulse">Fetching frame detections...</span>}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={summary.total_frames || 100}
                    value={selectedFrame || 1}
                    onChange={(e) => handleFrameChange(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                  <input
                    type="number"
                    min="1"
                    max={summary.total_frames || 100}
                    value={selectedFrame || 1}
                    onChange={(e) => handleFrameChange(Number(e.target.value))}
                    className="w-20 bg-slate-800 border border-slate-700 text-xs text-white rounded px-2 py-1 text-center font-mono"
                  />
                </div>
              </div>

              {/* Detections table */}
              {!frameDetections.length ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/20 rounded border border-slate-800">
                  No vehicles detected in frame #{selectedFrame}. Slide to an active frame.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                        <th className="text-left py-2 px-3">Track ID</th>
                        <th className="text-left py-2 px-3">Classification</th>
                        <th className="text-left py-2 px-3">Confidence</th>
                        <th className="text-left py-2 px-3">Velocity</th>
                        <th className="text-left py-2 px-3">Heading</th>
                        <th className="text-left py-2 px-3">Bounding Box [x1, y1, x2, y2]</th>
                      </tr>
                    </thead>
                    <tbody>
                      {frameDetections.map((d, idx) => (
                        <tr key={idx} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition">
                          <td className="py-2 px-3 font-mono text-slate-300">
                            #{d.vehicle_id}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                d.emergency
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                              }`}
                            >
                              {d.emergency ? '🚨 EMERGENCY' : d.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300 font-mono">
                            {(d.confidence * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 px-3 text-slate-300 font-mono">
                            {d.speed != null ? `${d.speed.toFixed(1)} km/h` : '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-400 capitalize">
                            {d.direction || 'unknown'}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                            {d.bounding_box
                              ? `[${d.bounding_box.x1}, ${d.bounding_box.y1}, ${d.bounding_box.x2}, ${d.bounding_box.y2}]`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* SUMO SAFETY RISK INTELLIGENCE                                  */}
      {/* ============================================================== */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <DataSourceTag source="SUMO / TraCI Telemetry" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Overall Risk Score" value={riskScore.toFixed(4)} icon={Activity} accent="red" />
          <MetricCard label="Near-Miss Risk" value={nearMissRisk.toFixed(4)} icon={Eye} accent="yellow" />
          <MetricCard label="Model Confidence" value={confidence.toFixed(4)} icon={Eye} accent="blue" />
        </div>
      </div>

      {/* Accident detection card */}
      <Card title="Accident Status Classifier">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-slate-300 font-medium">Vision-Based Accident Detector</p>
              <DataSourceTag source="Computer Vision" />
            </div>
            {isAccidentUnavailable ? (
              <>
                <p className="text-sm font-semibold text-slate-400 mt-2">Unavailable in Simulation Mode</p>
                <p className="text-xs text-slate-500 mt-1">
                  Reason: SUMO does not generate camera frames. Real video footage uploaded above is parsed by the YOLO pipeline.
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-1">{accidentStatus}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Vehicle pair risks */}
      <Card title="Vehicle Pair Risk Details">
        <div className="flex items-center gap-2 mb-3">
          <DataSourceTag source="SUMO / TraCI" />
        </div>
        {!pairRisks.length ? (
          <EmptyState message="No vehicle conflict pair risk data — start a SUMO simulation run from the top bar" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="text-left py-2 pr-4">Vehicles</th>
                  <th className="text-left py-2 pr-4">TTC (s)</th>
                  <th className="text-left py-2 pr-4">Near-Miss P</th>
                  <th className="text-left py-2">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {pairRisks.map((p, i) => (
                  <tr key={i} className="border-b border-slate-700/20">
                    <td className="py-2 pr-4 font-mono text-slate-300">
                      {Array.isArray(p.vehicles) ? p.vehicles.join(' ↔ ') : `Pair ${i + 1}`}
                    </td>
                    <td className="py-2 pr-4 text-slate-200">
                      {p.ttc_seconds != null ? Number(p.ttc_seconds).toFixed(2) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-slate-200">
                      {p.near_miss_probability != null ? Number(p.near_miss_probability).toFixed(4) : '—'}
                    </td>
                    <td className="py-2 text-slate-200">
                      {p.risk_score != null ? Number(p.risk_score).toFixed(4) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Comparison results */}
      {comparison.length > 0 && (
        <Card title="AI Method Comparison (Evaluation Results)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="text-left py-2 pr-4">Controller</th>
                  <th className="text-left py-2 pr-4">Avg Wait (s)</th>
                  <th className="text-left py-2 pr-4">Avg Queue</th>
                  <th className="text-left py-2 pr-4">Throughput</th>
                  <th className="text-left py-2">Runs</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/20">
                    <td className="py-2 pr-4 font-medium text-slate-300">{row.controller}</td>
                    <td className="py-2 pr-4 text-slate-200">
                      {row.average_waiting_time_mean != null ? Number(row.average_waiting_time_mean).toFixed(2) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-slate-200">
                      {row.average_queue_length_mean != null ? Number(row.average_queue_length_mean).toFixed(2) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-slate-200">
                      {row.throughput_mean != null ? Number(row.throughput_mean).toFixed(0) : '—'}
                    </td>
                    <td className="py-2 text-slate-400">{row.successful_runs ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
