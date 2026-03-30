import { Handle, Position } from '@xyflow/react'
import { FileText, Maximize2, AlertCircle, Wrench, Lightbulb } from 'lucide-react'

export default function CaseNode({ data, selected }) {
  const {
    title, confidence, docType,
    technician, date, manualRef,
    symptom, cause, fix, sourceRef, similarNote,
    onExpand,
  } = data

  return (
    <>
      <Handle type="source" position={Position.Left} className="case-handle" />

      <div
        className={`case-node-card ${selected ? 'ring-2 ring-amber-400' : ''}`}
        style={{ width: 285 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5 border-b border-amber-100">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-100 flex-shrink-0">
            <FileText size={13} className="text-amber-600" />
          </div>
          <span className="text-xs font-semibold text-gray-700 flex-1 leading-tight">{title}</span>
          <button
            className="p-1 rounded hover:bg-amber-100 text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
            onClick={() => onExpand && onExpand({ type: 'case', data })}
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

          {/* Technician */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-[9px] font-bold text-amber-800 flex-shrink-0">
              {technician.initials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-700 truncate">{technician.name}</p>
              <p className="text-[9px] text-gray-400">{date}</p>
            </div>
          </div>

          {/* Manual reference */}
          {manualRef && (
            <p className="text-[10px] text-gray-500 flex items-center gap-1">
              <FileText size={9} className="text-gray-400" />
              {manualRef}
            </p>
          )}

          {/* Symptom / Cause / Fix */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5 text-[10px]">
              <AlertCircle size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600"><span className="font-semibold text-gray-700">Symptom: </span>{symptom}</span>
            </div>
            <div className="flex items-start gap-1.5 text-[10px]">
              <Lightbulb size={10} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600"><span className="font-semibold text-gray-700">Cause: </span>{cause}</span>
            </div>
            <div className="flex items-start gap-1.5 text-[10px]">
              <Wrench size={10} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600"><span className="font-semibold text-gray-700">Fix: </span>{fix}</span>
            </div>
          </div>

          {/* Source reference */}
          <div className="flex items-center gap-1.5 border-t border-amber-100 pt-1.5">
            <FileText size={9} className="text-amber-400 flex-shrink-0" />
            <span className="text-[10px] text-amber-600 font-medium">{sourceRef}</span>
          </div>

          {/* Similar note */}
          {similarNote && (
            <div className="bg-amber-50 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-amber-700 leading-relaxed italic">{similarNote}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
