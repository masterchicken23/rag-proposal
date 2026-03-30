import { useCallback, useMemo } from 'react'
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
import NodeModal from './NodeModal'
import { useState, useEffect } from 'react'
import { Loader2, Cpu } from 'lucide-react'

// Node type registry — must be defined outside the component to avoid remounts
const NODE_TYPES = {
  actionNode: ActionNode,
  manualNode: ManualNode,
  caseNode: CaseNode,
}

function Canvas({ problem, graphData, isQuerying }) {
  const [expandedNode, setExpandedNode] = useState(null)

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
