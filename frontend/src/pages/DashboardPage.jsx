import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { GoogleGenAI, Modality } from '@google/genai'

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
    // Deduplicate by text
    const seen = new Set()
    const chunks = results.flat().filter((r) => {
      if (seen.has(r.text)) return false
      seen.add(r.text)
      return true
    })
    if (chunks.length === 0) return ''
    return (
      '\n\n# Uploaded Documents\nUse the following excerpts to answer the technician\'s questions:\n\n' +
      chunks.map((c) => `[${c.source}]\n${c.text}`).join('\n\n---\n\n')
    )
  } catch {
    return ''
  }
}

const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  ENDING: 'ending',
}

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
  useLocation() // keep router context

  const geminiSessionRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const processorRef = useRef(null)
  const nextStartTimeRef = useRef(0)
  const activeSourcesRef = useRef([])
  const mutedRef = useRef(false)
  const statusRef = useRef(STATUS.IDLE)
  const startCallRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const wakeWordRef = useRef(null)

  const [status, setStatus] = useState(STATUS.IDLE)
  const [isMuted, setIsMuted] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [transcript, setTranscript] = useState([])
  const [wakeWordActive, setWakeWordActive] = useState(false)

  useEffect(() => {
    return () => {
      try { geminiSessionRef.current?.close() } catch {}
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()
    }
  }, [])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const flushAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try { src.stop() } catch {}
    }
    activeSourcesRef.current = []
    nextStartTimeRef.current = 0
    setVolumeLevel(0)
  }, [])

  const enqueueAudio = useCallback((b64) => {
    const ctx = audioCtxRef.current
    if (!ctx) return

    const raw = atob(b64)
    const int16 = new Int16Array(raw.length / 2)
    for (let i = 0; i < int16.length; i++) {
      int16[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8)
    }

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
    try { geminiSessionRef.current?.close() } catch {}
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
        } catch (err) {
          console.error('[Mic] Send error:', err.message)
        }
      }

      source.connect(workletNode)
      workletNode.connect(micCtx.destination)
    } catch (err) {
      console.error('Mic capture error:', err)
    }
  }

  const startCall = async () => {
    if (statusRef.current !== STATUS.IDLE) return
    statusRef.current = STATUS.CONNECTING
    setStatus(STATUS.CONNECTING)
    setTranscript([])
    mutedRef.current = false
    setIsMuted(false)

    try { geminiSessionRef.current?.close() } catch {}
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
                  if (last && last.role === 'user' && last.streaming) {
                    return [...prev.slice(0, -1), { role: 'user', text: last.text + text, streaming: true }]
                  }
                  return [...prev, { role: 'user', text, streaming: true }]
                })

                const spoken = text.toLowerCase()
                const END_PHRASES = [
                  'hang up', 'goodbye', 'good bye', 'bye bye',
                  'bye bruno', "i'm done", "i'm done for today", "we're done", 'thanks bye',
                ]
                const isExactBye = spoken.trim() === 'bye'
                if (isExactBye || END_PHRASES.some((p) => spoken.includes(p))) endCall()
              }
            }

            if (sc.outputTranscription?.text) {
              const text = sc.outputTranscription.text.trim()
              if (text) {
                setTranscript((prev) => {
                  const finalized = prev.map((e) =>
                    (e.role === 'user' && e.streaming) ? { ...e, streaming: false } : e
                  )
                  const last = finalized[finalized.length - 1]
                  if (last && last.role === 'assistant' && last.streaming) {
                    const joined = last.text.endsWith(' ') || text.startsWith(' ')
                      ? last.text + text
                      : last.text + ' ' + text
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

  // Wake word — "Hey Bruno"
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (status !== STATUS.IDLE) {
      if (wakeWordRef.current) {
        try { wakeWordRef.current.stop() } catch {}
        wakeWordRef.current = null
      }
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
          const triggered = alts.some((t) =>
            t.includes('hey bruno') ||
            t.includes('hey bru no') ||
            t.includes('hey brno') ||
            t.includes('a bruno')
          )
          if (triggered) {
            cancelled = true
            try { rec.stop() } catch {}
            startCallRef.current?.()
            return
          }
        }
      }
      rec.onend = () => { setWakeWordActive(false); if (!cancelled) setTimeout(startListening, 300) }
      rec.onerror = () => {}

      wakeWordRef.current = rec
      try { rec.start() } catch {}
    }

    startListening()
    return () => {
      cancelled = true
      if (wakeWordRef.current) { try { wakeWordRef.current.stop() } catch {}; wakeWordRef.current = null }
      setWakeWordActive(false)
    }
  }, [status])

  // Spacebar shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' && statusRef.current === STATUS.IDLE) {
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

  const isCallActive = status === STATUS.ACTIVE
  const isConnecting = status === STATUS.CONNECTING
  const isEnding = status === STATUS.ENDING
  const hasStarted = isCallActive || isConnecting || isEnding

  const barCount = 24
  const bars = Array.from({ length: barCount }, (_, i) => {
    const center = barCount / 2
    const distFromCenter = Math.abs(i - center) / center
    const baseHeight = (1 - distFromCenter * 0.6) * 100
    const active = volumeLevel > 0.05
    const randomFactor = active ? 0.4 + Math.random() * 0.6 : 0.15
    return { height: baseHeight * randomFactor }
  })

  return (
    <div className="min-h-screen dashboard-bg flex flex-col">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center text-lg shadow-sm">
            🔧
          </div>
          <span className="text-gray-800 font-semibold text-lg">Bruno</span>
        </div>
        <p className="text-gray-400 text-sm">TRACTIAN Field Assistant</p>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-xl">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 overflow-hidden">

            {/* Idle state */}
            {!hasStarted && (
              <div className="flex flex-col items-center py-14 px-8 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-blue-100/70 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-gray-800 mb-2">Ready to help</h2>
                <p className="text-gray-500 text-sm mb-3 text-center max-w-sm leading-relaxed">
                  Bruno can diagnose issues, walk through procedures, and help you access manuals — all by voice.
                </p>

                <p className="text-gray-400 text-xs mb-6 text-center">
                  Press <span className="text-sky-500 font-medium">space</span>, tap below, or say{' '}
                  <span className="text-blue-500 font-medium">"Hey Bruno"</span> to begin.
                </p>

                <button
                  onClick={startCall}
                  className="px-10 py-4 rounded-full bg-gradient-to-r from-blue-500 to-sky-500 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:brightness-105 active:scale-95 transition-all duration-200"
                >
                  Start Conversation
                </button>

                <div className="mt-5 flex items-center gap-2">
                  {wakeWordActive ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                      <span className="text-blue-500 text-xs">
                        Listening for <span className="font-medium">"Hey Bruno"</span>…
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400 text-xs">Wake word not available in this browser</span>
                  )}
                </div>

                <p className="text-gray-400 text-xs mt-4">
                  Say <span className="text-red-400 font-medium">"bye bye"</span> to end the conversation
                </p>
              </div>
            )}

            {/* Active / Connecting state */}
            {hasStarted && (
              <div className="flex flex-col animate-fade-in">
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCallActive
                            ? 'bg-green-400 animate-pulse'
                            : isConnecting
                            ? 'bg-sky-400 animate-pulse'
                            : 'bg-gray-400 animate-pulse'
                        }`}
                      />
                      <span className="text-xs text-gray-500 font-medium">
                        {isConnecting && 'Connecting…'}
                        {isCallActive && (isMuted ? 'Muted' : 'Listening…')}
                        {isEnding && 'Ending…'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={toggleMute}
                        disabled={!isCallActive}
                        className={`
                          p-2 rounded-lg text-xs transition-all
                          ${isMuted
                            ? 'bg-sky-50 text-sky-500'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200/70'
                          }
                          disabled:opacity-40
                        `}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .87-.16 1.7-.44 2.47" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={endCall}
                        disabled={!isCallActive}
                        className="p-2 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-all disabled:opacity-40"
                        aria-label="End call"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                          <line x1="23" y1="1" x2="1" y2="23" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Waveform */}
                  <div className="flex items-center justify-center gap-[3px] h-16 px-4">
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
                </div>

                {/* Transcript */}
                <div className="border-t border-blue-100/60">
                  <div className="px-6 py-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Conversation</p>
                  </div>
                  <div className="px-6 pb-6 max-h-96 overflow-y-auto flex flex-col gap-3 scroll-smooth">
                    {transcript.length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-8">
                        {isConnecting ? 'Connecting to Bruno…' : 'Conversation will appear here…'}
                      </p>
                    )}
                    {transcript.map((entry, i) => (
                      <div
                        key={i}
                        className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`
                            max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                            ${entry.role === 'user'
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-white/80 text-gray-700 border border-blue-100 rounded-bl-md'
                            }
                          `}
                        >
                          {entry.text}
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 border-t border-blue-100/60 bg-white/30 backdrop-blur-sm">
        <p className="text-gray-400 text-xs">TRACTIAN — Powered by Gemini Live</p>
      </footer>
    </div>
  )
}
