import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { GoogleGenAI, Modality } from '@google/genai'
import { Mic, MicOff, PhoneOff, Send, Search } from 'lucide-react'

import TroubleshootingCanvas from '../components/whiteboard/TroubleshootingCanvas'
import { submitQuery } from '../api/troubleshooting'
import { getMockGraphData } from '../data/mockGraph'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
const geminiClient = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null

async function fetchContext() {
  try {
    const queries = [
      'equipment maintenance procedures troubleshooting',
      'error codes fault diagnosis specifications',
    ]
    const results = await Promise.all(
      queries.map((q) =>
        fetch(`${API_BASE}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, n_results: 5 }),
        })
          .then((r) => r.json())
          .then((d) => d.results || [])
          .catch(() => [])
      )
    )
    const seen = new Set()
    const chunks = results.flat().filter((r) => {
      if (seen.has(r.text)) return false
      seen.add(r.text)
      return true
    })
    if (chunks.length === 0) return ''
    return (
      "\n\n# Uploaded Documents\nUse the following excerpts to answer the technician's questions:\n\n" +
      chunks.map((c) => `[${c.source}]\n${c.text}`).join('\n\n---\n\n')
    )
  } catch {
    return ''
  }
}

const STATUS = { IDLE: 'idle', CONNECTING: 'connecting', ACTIVE: 'active', ENDING: 'ending' }

const SYSTEM_PROMPT = `you are a voice agent to help technicians in factories to solve issues and access manuals faster

# Voice & Persona
- Speak clearly and concisely — technicians need fast, actionable answers
- Be direct and practical; avoid unnecessary filler
- Stay calm and helpful under pressure
- Use technical language when appropriate, but keep explanations simple

# Capabilities
- Help diagnose equipment faults and suggest troubleshooting steps
- Reference uploaded manuals and documentation when available
- Walk technicians through repair or maintenance procedures step by step
- Answer questions about specifications, error codes, and safety guidelines

# Conversation rules
- If you can't find something in the provided documents, say so clearly and offer general guidance
- Keep responses concise — the technician may be on the factory floor
- If the user says "stop" it means stop the current topic, not end the call

# Ending the conversation
Valid triggers: "hang up", "goodbye", "bye", "bye bye", "thanks bye", "bye Bruno", "I'm done", "we're done"
NEVER end the call for any other reason.
Before ending, say a brief warm goodbye.
If you feel the user wants to end the call but hasn't said a trigger, ask: "Are you trying to end the call? Say 'bye bye' when you're ready."
`

export default function DashboardPage() {
  useLocation()

  // ── Voice / Gemini refs ────────────────────────────────────────────────────
  const geminiSessionRef   = useRef(null)
  const audioCtxRef        = useRef(null)
  const micStreamRef       = useRef(null)
  const processorRef       = useRef(null)
  const nextStartTimeRef   = useRef(0)
  const activeSourcesRef   = useRef([])
  const mutedRef           = useRef(false)
  const statusRef          = useRef(STATUS.IDLE)
  const startCallRef       = useRef(null)
  const transcriptEndRef   = useRef(null)
  const wakeWordRef        = useRef(null)

  // ── Voice / Gemini state ───────────────────────────────────────────────────
  const [status, setStatus]               = useState(STATUS.IDLE)
  const [isMuted, setIsMuted]             = useState(false)
  const [volumeLevel, setVolumeLevel]     = useState(0)
  const [transcript, setTranscript]       = useState([])
  const [wakeWordActive, setWakeWordActive] = useState(false)

  // ── Whiteboard / graph state ───────────────────────────────────────────────
  const [problem, setProblem]       = useState('')
  const [graphData, setGraphData]   = useState(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [queryInput, setQueryInput] = useState('')

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { geminiSessionRef.current?.close() } catch { /* noop */ }
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()
    }
  }, [])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // ── Audio helpers ──────────────────────────────────────────────────────────
  const flushAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) { try { src.stop() } catch { /* noop */ } }
    activeSourcesRef.current = []
    nextStartTimeRef.current = 0
    setVolumeLevel(0)
  }, [])

  const enqueueAudio = useCallback((b64) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const raw = atob(b64)
    const int16 = new Int16Array(raw.length / 2)
    for (let i = 0; i < int16.length; i++)
      int16[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8)
    let sum = 0
    for (let i = 0; i < int16.length; i++) sum += (int16[i] / 32768) ** 2
    setVolumeLevel(Math.min(Math.sqrt(sum / int16.length) * 4, 1))
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
    const buf = ctx.createBuffer(1, float32.length, 24000)
    buf.getChannelData(0).set(float32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const now = ctx.currentTime
    const startAt = Math.max(nextStartTimeRef.current, now)
    nextStartTimeRef.current = startAt + buf.duration
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src)
      if (activeSourcesRef.current.length === 0) setVolumeLevel(0)
    }
    activeSourcesRef.current.push(src)
    src.start(startAt)
  }, [])

  const cleanupCall = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (processorRef.current) {
      processorRef.current.node.disconnect()
      processorRef.current.context.close().catch(() => {})
      processorRef.current = null
    }
    geminiSessionRef.current = null
    flushAudio()
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    statusRef.current = STATUS.IDLE
    setStatus(STATUS.IDLE)
    setIsMuted(false)
  }, [flushAudio])

  const endCall = useCallback(() => {
    statusRef.current = STATUS.ENDING
    setStatus(STATUS.ENDING)
    try { geminiSessionRef.current?.close() } catch { /* noop */ }
    geminiSessionRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (processorRef.current) {
      processorRef.current.node.disconnect()
      processorRef.current.context.close().catch(() => {})
      processorRef.current = null
    }
    flushAudio()
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setTimeout(() => {
      statusRef.current = STATUS.IDLE
      setStatus(STATUS.IDLE)
      setVolumeLevel(0)
      setIsMuted(false)
    }, 600)
  }, [flushAudio])

  const startMicCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      micStreamRef.current = stream
      const micCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      await micCtx.audioWorklet.addModule('/pcm-processor.js')
      const source = micCtx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(micCtx, 'pcm-processor')
      processorRef.current = { node: workletNode, context: micCtx }
      workletNode.port.onmessage = (e) => {
        if (mutedRef.current) return
        const session = geminiSessionRef.current
        if (!session) return
        const bytes = new Uint8Array(e.data)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        try {
          session.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } })
        } catch (err) { console.error('[Mic] Send error:', err.message) }
      }
      source.connect(workletNode)
      workletNode.connect(micCtx.destination)
    } catch (err) { console.error('Mic capture error:', err) }
  }

  const startCall = async () => {
    if (statusRef.current !== STATUS.IDLE) return
    statusRef.current = STATUS.CONNECTING
    setStatus(STATUS.CONNECTING)
    setTranscript([])
    mutedRef.current = false
    setIsMuted(false)
    try { geminiSessionRef.current?.close() } catch { /* noop */ }
    geminiSessionRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (processorRef.current) {
      processorRef.current.node.disconnect()
      processorRef.current.context.close().catch(() => {})
      processorRef.current = null
    }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    activeSourcesRef.current = []
    nextStartTimeRef.current = 0
    const userContext = await fetchContext()
    const systemPrompt = SYSTEM_PROMPT + userContext
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
    audioCtxRef.current = audioCtx
    if (!geminiClient) {
      console.error('VITE_GEMINI_API_KEY not set')
      statusRef.current = STATUS.IDLE
      setStatus(STATUS.IDLE)
      return
    }
    let setupDone = false
    try {
      const session = await geminiClient.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          thinkingConfig: { thinkingBudget: 0 },
        },
        callbacks: {
          onopen: () => console.log('[Gemini] Connection established'),
          onmessage: (msg) => {
            if (msg.setupComplete) {
              if (setupDone) return
              setupDone = true
              statusRef.current = STATUS.ACTIVE
              setStatus(STATUS.ACTIVE)
              startMicCapture()
              return
            }
            const sc = msg.serverContent
            if (!sc) return
            if (sc.interrupted) { flushAudio(); return }
            if (sc.modelTurn?.parts) {
              setTranscript((prev) =>
                prev.map((e) => (e.role === 'user' && e.streaming) ? { ...e, streaming: false } : e)
              )
              for (const part of sc.modelTurn.parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/pcm')) enqueueAudio(part.inlineData.data)
              }
            }
            if (sc.inputTranscription?.text) {
              const text = sc.inputTranscription.text
              if (text.trim()) {
                setTranscript((prev) => {
                  const last = prev[prev.length - 1]
                  if (last && last.role === 'user' && last.streaming)
                    return [...prev.slice(0, -1), { role: 'user', text: last.text + text, streaming: true }]
                  return [...prev, { role: 'user', text, streaming: true }]
                })
                const spoken = text.toLowerCase()
                const END_PHRASES = ['hang up', 'goodbye', 'good bye', 'bye bye', 'bye bruno', "i'm done", "we're done", 'thanks bye']
                if (spoken.trim() === 'bye' || END_PHRASES.some((p) => spoken.includes(p))) endCall()
              }
            }
            if (sc.outputTranscription?.text) {
              const text = sc.outputTranscription.text.trim()
              if (text) {
                setTranscript((prev) => {
                  const finalized = prev.map((e) => (e.role === 'user' && e.streaming) ? { ...e, streaming: false } : e)
                  const last = finalized[finalized.length - 1]
                  if (last && last.role === 'assistant' && last.streaming) {
                    const joined = last.text.endsWith(' ') || text.startsWith(' ') ? last.text + text : last.text + ' ' + text
                    return [...finalized.slice(0, -1), { role: 'assistant', text: joined, streaming: true }]
                  }
                  return [...finalized, { role: 'assistant', text, streaming: true }]
                })
              }
            }
            if (sc.turnComplete) {
              setVolumeLevel(0)
              setTranscript((prev) => prev.map((e) => (e.streaming ? { ...e, streaming: false } : e)))
            }
          },
          onerror: (e) => console.error('[Gemini] Error:', e?.message || e),
          onclose: () => { console.log('[Gemini] Session closed'); cleanupCall() },
        },
      })
      geminiSessionRef.current = session
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'A factory technician just connected. Greet them and ask how you can help.' }] }],
        turnComplete: true,
      })
    } catch (err) {
      console.error('[Gemini] Session error:', err)
      audioCtx.close().catch(() => {})
      audioCtxRef.current = null
      statusRef.current = STATUS.IDLE
      setStatus(STATUS.IDLE)
    }
  }
  startCallRef.current = startCall

  // ── Wake word ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    if (status !== STATUS.IDLE) {
      if (wakeWordRef.current) { try { wakeWordRef.current.stop() } catch { /* noop */ }; wakeWordRef.current = null }
      setWakeWordActive(false)
      return
    }
    let cancelled = false
    function startListening() {
      if (cancelled) return
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.maxAlternatives = 5
      rec.onstart = () => setWakeWordActive(true)
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const alts = Array.from(event.results[i]).map((a) => a.transcript.toLowerCase())
          if (alts.some((t) => t.includes('hey bruno') || t.includes('hey bru no') || t.includes('hey brno') || t.includes('a bruno'))) {
            cancelled = true
            try { rec.stop() } catch { /* noop */ }
            startCallRef.current?.()
            return
          }
        }
      }
      rec.onend = () => { setWakeWordActive(false); if (!cancelled) setTimeout(startListening, 300) }
      rec.onerror = () => {}
      wakeWordRef.current = rec
      try { rec.start() } catch { /* noop */ }
    }
    startListening()
    return () => {
      cancelled = true
      if (wakeWordRef.current) { try { wakeWordRef.current.stop() } catch { /* noop */ }; wakeWordRef.current = null }
      setWakeWordActive(false)
    }
  }, [status])

  // ── Spacebar shortcut ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' && statusRef.current === STATUS.IDLE && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        startCallRef.current?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setIsMuted(next)
  }, [])

  // ── Text query handler ─────────────────────────────────────────────────────
  const handleQuery = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isQuerying) return
    setIsQuerying(true)
    setProblem(trimmed)
    setQueryInput('')
    try {
      const result = await submitQuery({ problem: trimmed, sessionId: `sess-${Date.now()}`, machineId: 'auto' })
      setGraphData(result.graph)
    } catch {
      // Backend unavailable — use mock data
      await new Promise((r) => setTimeout(r, 1400))
      const mock = getMockGraphData(trimmed)
      setGraphData(mock.graph)
    } finally {
      setIsQuerying(false)
    }
  }, [isQuerying])

  const handleQuerySubmit = (e) => {
    e.preventDefault()
    handleQuery(queryInput)
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const isCallActive  = status === STATUS.ACTIVE
  const isConnecting  = status === STATUS.CONNECTING
  const isEnding      = status === STATUS.ENDING
  const hasStarted    = isCallActive || isConnecting || isEnding

  const barCount = 20
  const bars = Array.from({ length: barCount }, (_, i) => {
    const center = barCount / 2
    const distFromCenter = Math.abs(i - center) / center
    const baseHeight = (1 - distFromCenter * 0.6) * 100
    const active = volumeLevel > 0.05
    const randomFactor = active ? 0.4 + Math.random() * 0.6 : 0.12
    return { height: baseHeight * randomFactor }
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F4F8]">

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <aside className="w-[232px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">

        {/* Voice visualization */}
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          {!hasStarted ? (
            /* Idle: gradient blob */
            <>
              <div className="voice-blob-1" />
              <div className="voice-blob-2" />
              <div className="voice-blob-3" />
              {/* Listening indicator */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                {wakeWordActive ? (
                  <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                    <span className="text-[11px] text-gray-600 font-medium">
                      Listening for <span className="text-blue-600">"Hey Bruno"</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    <span className="text-[11px] text-gray-400">Wake word unavailable</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Active: waveform */
            <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
              <div className="flex items-center justify-center gap-[3px] h-14 w-full">
                {bars.map((bar, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.max(bar.height, 8)}%`, transition: 'height 0.15s ease' }}
                    className={`w-1 rounded-full ${
                      isCallActive && volumeLevel > 0.05 ? 'bg-blue-400' : 'bg-blue-100'
                    }`}
                  />
                ))}
              </div>
              {/* Status + controls */}
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isCallActive ? 'bg-green-400 animate-pulse' :
                  isConnecting ? 'bg-sky-400 animate-pulse' : 'bg-gray-400 animate-pulse'
                }`} />
                <span className="text-[11px] text-gray-500 font-medium">
                  {isConnecting && 'Connecting…'}
                  {isCallActive && (isMuted ? 'Muted' : 'Listening…')}
                  {isEnding && 'Ending…'}
                </span>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={toggleMute}
                    disabled={!isCallActive}
                    className={`p-1.5 rounded-lg text-xs transition-all disabled:opacity-40 ${
                      isMuted ? 'bg-sky-50 text-sky-500' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                  </button>
                  <button
                    onClick={endCall}
                    disabled={!isCallActive}
                    className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-all disabled:opacity-40"
                  >
                    <PhoneOff size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto min-h-0 border-t border-gray-100">
          {!hasStarted ? (
            /* Idle — start button */
            <div className="flex flex-col items-center justify-center h-full px-4 gap-3 py-6">
              <button
                onClick={startCall}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-sky-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 hover:brightness-105 active:scale-95 transition-all"
              >
                Start Voice Session
              </button>
              <p className="text-[10px] text-gray-400 text-center">
                Press <span className="text-sky-500 font-medium">space</span> or say{' '}
                <span className="text-blue-500 font-medium">"Hey Bruno"</span>
              </p>
              <p className="text-[10px] text-gray-400 text-center">
                Say <span className="text-red-400 font-medium">"bye bye"</span> to end
              </p>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-2">
              {transcript.length === 0 && (
                <p className="text-[11px] text-gray-400 text-center py-4">
                  {isConnecting ? 'Connecting to Bruno…' : 'Conversation will appear here…'}
                </p>
              )}
              {transcript.map((entry, i) => (
                <div key={i} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-2.5 py-2 rounded-xl text-[11px] leading-relaxed ${
                    entry.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-sm'
                  }`}>
                    {entry.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* Text query input */}
        <div className="flex-shrink-0 border-t border-gray-100 p-3">
          <form onSubmit={handleQuerySubmit} className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Describe a problem…"
              disabled={isQuerying}
              className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-300 focus:bg-white transition-all disabled:opacity-50 placeholder-gray-400 text-gray-700"
            />
            <button
              type="submit"
              disabled={!queryInput.trim() || isQuerying}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
            >
              <Send size={12} />
            </button>
          </form>
        </div>
      </aside>

      {/* ── RIGHT CANVAS ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 h-full">
        <TroubleshootingCanvas
          problem={problem}
          graphData={graphData}
          isQuerying={isQuerying}
        />
      </main>
    </div>
  )
}
