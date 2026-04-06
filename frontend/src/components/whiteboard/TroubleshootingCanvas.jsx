import { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Position,
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
import allinolLogoUrl from '../../assets/alinoil.png'
import gouldsPumpUrl from '../../assets/goulds-imd.png'

// Node type registry — must be defined outside the component to avoid remounts
const NODE_TYPES = {
  actionNode: ActionNode,
  manualNode: ManualNode,
  caseNode: CaseNode,
  deviceNode: DeviceNode,
}

const NODE_LAYOUT = {
  actionNode: { x: 370, y: 20  },
  manualNode: { x: 0,   y: 780 },
  deviceNode: { x: 600, y: 780 },
  caseNode:   { x: 880, y: 780 },
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

function Canvas({ problem, graphData, isQuerying, isDemo }) {
  const [expandedNode, setExpandedNode] = useState(null)
  const [showUpload, setShowUpload]     = useState(false)

  const normalizedGraph = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] }

    const nodes = (graphData.nodes ?? []).map((node) => ({
      ...node,
      position: NODE_LAYOUT[node.type] ?? node.position,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: { ...node.data, onExpand: (expanded) => setExpandedNode(expanded) },
    }))

    const edges = (graphData.edges ?? []).map((edge) => ({
      ...edge,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }))

    return { nodes, edges }
  }, [graphData])

  const [nodes, setNodes, onNodesChange] = useNodesState(normalizedGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(normalizedGraph.edges)

  // Sync when new graph data arrives
  useEffect(() => {
    setNodes(normalizedGraph.nodes)
    setEdges(normalizedGraph.edges)
  }, [normalizedGraph, setNodes, setEdges])

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
        fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
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

        {/* Branding + asset image — top right */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none flex flex-col items-end gap-3">
          {isDemo
            ? <img src={allinolLogoUrl} alt="Allinol" className="h-8 object-contain select-none" />
            : <span className="text-base font-black tracking-widest text-gray-800 select-none">TRACTIAN</span>
          }
          {graphData && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-3">
              <img
                src={gouldsPumpUrl}
                alt="Machine asset"
                className="h-28 w-auto object-contain select-none"
                draggable={false}
              />
              <p className="text-[9px] text-gray-400 text-center mt-1.5 font-medium tracking-wide">ASSET REFERENCE</p>
            </div>
          )}
        </div>

        {/* Problem header — thin clipping tab */}
        {problem && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none max-w-[50%]">
            <div className="bg-gray-800/50 backdrop-blur-md rounded-lg px-3 py-1.5 flex items-center gap-2 overflow-hidden">
              <span className="text-[10px] text-white/40 font-medium whitespace-nowrap flex-shrink-0">Problem</span>
              <span className="text-[11px] text-white/70 truncate">{problem}</span>
            </div>
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

      {/* Empty state — Bruno intro */}
      {!isQuerying && !graphData && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center gap-5 text-center px-8 max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <span className="text-white text-lg font-black tracking-tight">B</span>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800">
                Hi, I'm Bruno
              </p>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                An intelligence by <span className="font-semibold text-gray-700">Tractian</span> helping{' '}
                {isDemo
                  ? <span className="font-semibold text-gray-700">Allinol</span>
                  : <span className="font-semibold text-gray-700">your team</span>
                }.
                <br />
                How can I assist you today?
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Say <span className="text-blue-500 font-medium">"Hey Bruno"</span> or describe a problem below
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

export default function TroubleshootingCanvas({ problem, graphData, isQuerying, isDemo }) {
  return (
    <ReactFlowProvider>
      <Canvas problem={problem} graphData={graphData} isQuerying={isQuerying} isDemo={isDemo} />
    </ReactFlowProvider>
  )
}
