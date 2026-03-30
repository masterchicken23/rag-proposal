import { Handle, Position } from '@xyflow/react'
import { FileText, Maximize2 } from 'lucide-react'

export default function ManualNode({ data, selected }) {
  const { title, confidence, docType, bullets, sourceRef, onExpand } = data

  return (
    <>
      <Handle type="source" position={Position.Right} className="manual-handle" />

      <div
        className={`manual-node-card ${selected ? 'ring-2 ring-slate-400' : ''}`}
        style={{ width: 285 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 flex-shrink-0">
            <FileText size={13} className="text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-gray-700 flex-1 leading-tight">{title}</span>
          <button
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            onClick={() => onExpand && onExpand({ type: 'manual', data })}
            title="Expand"
          >
            <Maximize2 size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="px-3.5 py-3 space-y-2.5">
          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Confidence:{' '}
              <span className="text-emerald-600 font-semibold">Score {confidence}%</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-medium text-emerald-700">
              {docType}
            </span>
          </div>

          {/* Bullet points */}
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>

          {/* Source reference */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
            <FileText size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">{sourceRef}</span>
          </div>
        </div>
      </div>
    </>
  )
}
