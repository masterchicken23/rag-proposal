import { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import ActionNode from './ActionNode'
import ManualNode from './ManualNode'
import CaseNode from './CaseNode'
import DeviceNode from './DeviceNode'
import NodeModal from './NodeModal'
import { useState, useEffect } from 'react'
import { Loader2, Cpu, Plus, X, Upload, FileText, Send, ToggleLeft, ToggleRight } from 'lucide-react'

// Node type registry — must be defined outside the component to avoid remounts
const NODE_TYPES = {
  actionNode: ActionNode,
  manualNode: ManualNode,
  caseNode: CaseNode,
  deviceNode: DeviceNode,
}

function UploadPopup({ onClose }) {
  const [forceAnalyse, setForceAnalyse] = useState(false)
  const [isDragging, setIsDragging]     = useState(false)
  const [file, setFile]                 = useState(null)
  const fileInputRef                    = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className="upload-popup animate-popup-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Upload size={13} className="text-indigo-500" />
          </div>
          <span className="text-sm font-semibold text-gray-800">Add Document</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 mb-4
          flex flex-col items-center justify-center gap-2 py-5 px-4 text-center
          ${isDragging
            ? 'border-indigo-400 bg-indigo-50/60'
            : file
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-gray-200 bg-gray-50/60 hover:border-indigo-200 hover:bg-indigo-50/30'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.json,.txt,.md"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]) }}
        />

        {file ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FileText size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700 truncate max-w-[180px]">
                {file.name}
              </p>
              <p className="text-[10px] text-emerald-500 mt-0.5">
                {(file.size / 1024).toFixed(0)} KB · ready to send
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="absolute top-2 right-2 p-0.5 rounded text-emerald-400 hover:text-emerald-600"
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Upload size={15} className="text-gray-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">
                Drop a file or{' '}
                <span className="text-indigo-500 font-medium underline underline-offset-2">browse</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">PDF, JSON, TXT, Markdown</p>
            </div>
          </>
        )}
      </div>

      {/* Force Analyse toggle */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 mb-0.5">Force Analyse</p>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Force Bruno to use this document for a solution
          </p>
        </div>
        <button
          onClick={() => setForceAnalyse((v) => !v)}
          className="flex-shrink-0 mt-0.5 transition-colors"
          aria-label="Toggle force analyse"
        >
          {forceAnalyse
            ? <ToggleRight size={26} className="text-indigo-500" strokeWidth={1.8} />
            : <ToggleLeft  size={26} className="text-gray-300"   strokeWidth={1.8} />
          }
        </button>
      </div>

      {/* Send button */}
      <button
        disabled={!file}
        className={`
          w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
          transition-all duration-200
          ${file
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:scale-95'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        <Send size={13} />
        Send to Bruno
      </button>
    </div>
  )
}

function Canvas({ problem, graphData, isQuerying }) {
  const [expandedNode, setExpandedNode] = useState(null)
  const [showUpload, setShowUpload]     = useState(false)

  // Inject the onExpand callback into each node's data
  const enrichedNodes = useMemo(() => {
    if (!graphData?.nodes) return []
    return graphData.nodes.map((n) => ({
      ...n,
      data: { ...n.data, onExpand: (node) => setExpandedNode(node) },
    }))
  }, [graphData])

  const [nodes, setNodes, onNodesChange] = useNodesState(enrichedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphData?.edges ?? [])

  // Sync when new graph data arrives
  useEffect(() => {
    setNodes(enrichedNodes)
    setEdges(graphData?.edges ?? [])
  }, [enrichedNodes, graphData, setNodes, setEdges])

  const onConnect = useCallback(() => {}, []) // connections are read-only

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="#d1d5db" gap={28} size={1.2} style={{ opacity: 0.35 }} />
        <Controls
          showInteractive={false}
          className="!border-0 !shadow-sm !rounded-xl overflow-hidden"
        />

        {/* TRACTIAN logo — top right */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <span className="text-base font-black tracking-widest text-gray-800 select-none">
            TRACTIAN
          </span>
        </div>

        {/* Problem header — top center */}
        {problem && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-4">
            <p className="text-sm font-medium text-gray-700 text-center whitespace-nowrap">
              Current problem:{' '}
              <span className="font-semibold text-gray-900">{problem}</span>
            </p>
          </div>
        )}
      </ReactFlow>

      {/* Processing overlay */}
      {isQuerying && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
                <Cpu size={24} className="text-indigo-500 animate-pulse" />
              </div>
              <Loader2 size={14} className="absolute -top-1 -right-1 text-indigo-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">Analysing problem…</p>
              <p className="text-xs text-gray-400 mt-0.5">Searching manuals and maintenance logs</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isQuerying && !graphData && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">No active session</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                Describe a machine problem in the left panel or say{' '}
                <span className="text-blue-500 font-medium">"Hey Bruno"</span> to begin
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Node detail modal */}
      {expandedNode && (
        <NodeModal node={expandedNode} onClose={() => setExpandedNode(null)} />
      )}

      {/* ── FAB + Upload popup ─────────────────────────────────────────── */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        {/* Popup — appears above the button */}
        {showUpload && (
          <UploadPopup onClose={() => setShowUpload(false)} />
        )}

        {/* Backdrop dismiss */}
        {showUpload && (
          <div
            className="fixed inset-0 z-[-1]"
            onClick={() => setShowUpload(false)}
          />
        )}

        {/* FAB */}
        <button
          onClick={() => setShowUpload((v) => !v)}
          aria-label="Add document"
          className={`
            w-11 h-11 rounded-full flex items-center justify-center shadow-lg
            transition-all duration-200 active:scale-90
            ${showUpload
              ? 'bg-gray-700 shadow-gray-700/30 rotate-45'
              : 'bg-[#1e293b] hover:bg-slate-700 shadow-slate-800/30'
            }
          `}
          style={{ transition: 'transform 0.2s, background 0.2s' }}
        >
          <Plus size={18} className="text-white" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

export default function TroubleshootingCanvas(props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
