import { Handle, Position } from '@xyflow/react'
import { FileText, ThumbsUp, Maximize2, BookOpen, ClipboardList } from 'lucide-react'

export default function ActionNode({ data, selected }) {
  const { title, reasoning, likelyCauses, actions, sources, onExpand } = data

  return (
    <>
      <Handle type="target" position={Position.Left} className="action-handle" />
      <Handle type="target" position={Position.Right} className="action-handle" />

      <div
        className={`action-node-card ${selected ? 'ring-2 ring-indigo-400' : ''}`}
        style={{ width: 400 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-indigo-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 flex-shrink-0">
            <FileText size={15} className="text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-gray-800 flex-1 leading-tight">{title}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <button className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors">
              <ThumbsUp size={13} />
            </button>
            <button
              className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors"
              onClick={() => onExpand && onExpand({ type: 'action', data })}
              title="Expand"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3.5">
          {/* Reasoning */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Reasoning</p>
            <p className="text-xs text-gray-600 leading-relaxed">{reasoning}</p>
          </div>

          {/* Likely Causes */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <BookOpen size={9} className="text-gray-400" /> Likely Causes
            </p>
            <ul className="space-y-1">
              {likelyCauses.map((cause, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                  {cause}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ClipboardList size={9} className="text-gray-400" /> Actions
            </p>
            <ol className="space-y-1.5">
              {actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[9px] font-semibold text-indigo-600 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Sources */}
          <div className="pt-1 border-t border-indigo-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Sources:{' '}
              <span className="text-emerald-600 font-semibold normal-case">High</span>
            </p>
            <div className="space-y-1.5">
              {sources.map((src, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      src.type === 'manual' ? 'bg-blue-500' : 'bg-teal-500'
                    }`}
                  />
                  <span className="text-gray-600">
                    {src.title}:{' '}
                    <span className="text-blue-600 font-medium">{src.ref}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
