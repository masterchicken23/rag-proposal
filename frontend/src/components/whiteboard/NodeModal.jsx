import { X, FileText, BookOpen, ClipboardList, AlertCircle, Lightbulb, Wrench, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'

export default function NodeModal({ node, onClose }) {
  const { type, data } = node

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-modal-in">

        {/* Modal header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${
          type === 'action' ? 'bg-indigo-50 border-indigo-100' :
          type === 'manual' ? 'bg-slate-50 border-slate-100' :
          'bg-amber-50 border-amber-100'
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            type === 'action' ? 'bg-indigo-100' :
            type === 'manual' ? 'bg-slate-100' :
            'bg-amber-100'
          }`}>
            <FileText size={16} className={
              type === 'action' ? 'text-indigo-600' :
              type === 'manual' ? 'text-slate-500' :
              'text-amber-600'
            } />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{data.title}</h2>
            {type === 'manual' && (
              <p className="text-xs text-gray-500 mt-0.5">{data.sourceRef}</p>
            )}
            {type === 'case' && (
              <p className="text-xs text-gray-500 mt-0.5">{data.sourceRef}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── ACTION NODE ─────────────────────────────────────── */}
          {type === 'action' && (
            <>
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <BookOpen size={11} /> Reasoning
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{data.reasoning}</p>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Likely Causes
                </h3>
                <ul className="space-y-2">
                  {data.likelyCauses.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ClipboardList size={11} /> Step-by-step Actions
                </h3>
                <ol className="space-y-2.5">
                  {data.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-600 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Sources
                </h3>
                <div className="space-y-2">
                  {data.sources.map((src, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${src.type === 'manual' ? 'bg-blue-500' : 'bg-teal-500'}`} />
                      <span className="text-gray-700 flex-1">{src.title}</span>
                      <span className="text-blue-600 font-medium text-xs">{src.ref}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        src.confidence === 'high' ? 'bg-emerald-50 text-emerald-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {src.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── MANUAL NODE ─────────────────────────────────────── */}
          {type === 'manual' && (
            <>
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-500">
                    Confidence: <span className="text-emerald-600 font-semibold">Score {data.confidence}%</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                    {data.docType}
                  </span>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Key Points
                </h3>
                <ul className="space-y-2">
                  {data.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </section>

              {data.fullText && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Full Excerpt
                  </h3>
                  <pre className="text-xs text-gray-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4 whitespace-pre-wrap font-sans">
                    {data.fullText}
                  </pre>
                </section>
              )}

              <section className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText size={14} className="text-slate-400" />
                  <span>{data.sourceRef}</span>
                  <button className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs font-medium">
                    <ExternalLink size={11} /> Open document
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ── CASE NODE ───────────────────────────────────────── */}
          {type === 'case' && (
            <>
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-500">
                    Confidence: <span className="text-emerald-600 font-semibold">Score {data.confidence}%</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                    {data.docType}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-800 flex-shrink-0">
                    {data.technician.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{data.technician.name}</p>
                    <p className="text-xs text-gray-500">{data.date} · {data.manualRef}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-xs font-semibold text-red-600">Symptom</span>
                  </div>
                  <p className="text-sm text-gray-700">{data.symptom}</p>
                </div>

                <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb size={12} className="text-orange-400" />
                    <span className="text-xs font-semibold text-orange-600">Root Cause</span>
                  </div>
                  <p className="text-sm text-gray-700">{data.cause}</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wrench size={12} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600">Resolution</span>
                  </div>
                  <p className="text-sm text-gray-700">{data.fix}</p>
                </div>
              </section>

              {data.similarNote && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Similar Cases
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed italic bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    {data.similarNote}
                  </p>
                </section>
              )}

              <section className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <FileText size={14} className="text-amber-400" />
                  <span>{data.sourceRef}</span>
                  <button className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs font-medium">
                    <ExternalLink size={11} /> Open log entry
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
