import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

const STATUS_COLORS = {
  uploading: 'bg-sky-100 text-sky-600',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-500',
}

export default function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])   // [{ name, status, chunks?, error? }]
  const [isDragging, setIsDragging] = useState(false)

  const uploadFile = useCallback(async (file) => {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { name: file.name, status: 'error', error: err.detail || 'Upload failed' }
      }
      const data = await res.json()
      return { name: file.name, status: 'done', chunks: data.chunks }
    } catch {
      return { name: file.name, status: 'error', error: 'Could not reach backend' }
    }
  }, [])

  const processFiles = useCallback(async (fileList) => {
    const pending = Array.from(fileList)
    // Add all as uploading immediately
    setFiles((prev) => [
      ...prev,
      ...pending.map((f) => ({ name: f.name, status: 'uploading' })),
    ])

    // Upload in parallel
    const results = await Promise.all(pending.map(uploadFile))

    setFiles((prev) => {
      // Replace the uploading placeholders with results
      const names = new Set(results.map((r) => r.name))
      const kept = prev.filter((f) => !(f.status === 'uploading' && names.has(f.name)))
      return [...kept, ...results]
    })
  }, [uploadFile])

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files) }
  const handleFileChange = (e) => { processFiles(e.target.files); e.target.value = '' }
  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name))

  const doneCount = files.filter((f) => f.status === 'done').length
  const uploading = files.some((f) => f.status === 'uploading')

  return (
    <div className="min-h-screen dashboard-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 border border-white/60 mb-5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-500">TRACTIAN — Field Assistant</span>
          </div>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center text-3xl shadow-sm mx-auto mb-4">
            🔧
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">Meet Bruno</h1>
          <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
            Upload technical documents to give Bruno context, then start your voice session.
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 overflow-hidden mb-5 animate-fade-in">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 12 15 15" />
                </svg>
              </div>
              <div>
                <h3 className="text-gray-800 font-semibold text-sm">Upload Documents</h3>
                <p className="text-gray-400 text-[11px]">PDF, JSON, or TXT — optional</p>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                min-h-[140px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed
                cursor-pointer transition-all duration-200
                ${isDragging
                  ? 'border-blue-400 bg-blue-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-blue-200 hover:bg-blue-50/30'
                }
              `}
            >
              {files.length === 0 ? (
                <div className="text-center px-4 py-6">
                  <svg width="32" height="32" viewBox="0 0 48 48" fill="none" className="mx-auto mb-2 opacity-40">
                    <rect x="12" y="8" width="24" height="32" rx="3" fill="rgba(59,130,246,0.08)" />
                    <path d="M20 22h8M20 27h8M20 32h5" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="36" cy="36" r="8" fill="#3B82F6" />
                    <path d="M36 32v8M32 36h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-gray-400 text-xs">
                    Drop files or{' '}
                    <span className="text-blue-500 font-medium underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-gray-300 text-[10px] mt-1">Manuals, procedures, troubleshooting guides…</p>
                </div>
              ) : (
                <div className="px-4 py-4 w-full space-y-1.5">
                  {files.map((f) => (
                    <div key={f.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status]}`}>
                        {f.status === 'uploading' && '⏳ '}
                        {f.status === 'done' && '✓ '}
                        {f.status === 'error' && '✗ '}
                        {f.name.length > 26 ? f.name.slice(0, 23) + '…' : f.name}
                        {f.status === 'done' && f.chunks !== undefined && (
                          <span className="opacity-60 ml-1">({f.chunks} chunks)</span>
                        )}
                      </span>
                      {f.status !== 'uploading' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(f.name) }}
                          className="opacity-40 hover:opacity-80 flex-shrink-0"
                          aria-label={`Remove ${f.name}`}
                        >
                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="8" y1="2" x2="2" y2="8" />
                            <line x1="2" y1="2" x2="8" y2="8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-gray-400 text-[10px] text-center pt-1">
                    <span className="text-blue-500 underline underline-offset-2">Add more files</span>
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.json,.txt,.md"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="px-6 py-3 border-t border-gray-200/60 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {uploading
                ? 'Processing…'
                : doneCount > 0
                ? `${doneCount} file${doneCount !== 1 ? 's' : ''} ready`
                : 'No files — Bruno will still help you'}
            </span>
            {doneCount > 0 && !uploading && (
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="10" height="10" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 5.5 3.5 8 9 2" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 animate-fade-in">
          <button
            onClick={() => navigate('/dashboard')}
            disabled={uploading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-sky-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:brightness-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing files…' : 'Talk to Bruno →'}
          </button>
          {files.length === 0 && (
            <p className="text-center text-[11px] text-gray-400">
              You can skip uploading and start talking right away
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
