import { Handle, Position } from '@xyflow/react'
import tractianDevice from '../../assets/tractian_device.png'

export default function DeviceNode({ data, selected }) {
  const { analysis } = data

  return (
    <>
      <Handle type="target" position={Position.Top} className="device-handle" />

      <div
        className={`device-node-card ${selected ? 'ring-2 ring-blue-400/60' : ''}`}
        style={{ width: 210 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <span className="text-white text-sm font-semibold tracking-tight">Synced Device</span>
          <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded-full px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            <span className="text-red-400 text-[9px] font-bold tracking-wide">LIVE</span>
          </div>
        </div>

        {/* Device illustration */}
        <div className="flex items-center justify-center px-4 py-3">
          <img
            src={tractianDevice}
            alt="TRACTIAN sensor device"
            className="h-[130px] w-auto object-contain select-none"
            draggable={false}
          />
        </div>

        {/* Analysis */}
        <div className="px-4 pb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Analysis
          </p>
          <p className="text-[11px] text-slate-300 leading-relaxed">{analysis}</p>
        </div>

        {/* Bottom pulse bar */}
        <div className="h-0.5 w-full">
          <div className="h-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent device-pulse-bar" />
        </div>
      </div>
    </>
  )
}
