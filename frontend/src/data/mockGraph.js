/**
 * Mock graph response — mirrors the shape that the backend /query endpoint will return.
 * Used during development and as a fallback when the API is unavailable.
 *
 * Node types: 'actionNode' | 'manualNode' | 'caseNode' | 'deviceNode'
 */

export function getMockGraphData(problem = '') {
  const lower = problem.toLowerCase()

  if (lower.includes('vibrat') || lower.includes('bearing')) {
    return bearingVibrationScenario(problem)
  }
  if (lower.includes('leak') || lower.includes('hydraulic') || lower.includes('oil')) {
    return hydraulicLeakScenario(problem)
  }

  return overheatBeltScenario(problem)
}

// ─── Demo Scenario: Allinol — Goulds 3196 Pump Cavitation ────────────────────

export function allinolDemoScenario(demoDocUrl = '') {
  return {
    session_id: 'demo-session-allinol-001',
    problem: 'Pump starts normally, but after ~2 minutes it begins vibrating heavily and making a loud rattling noise. Flow rate also seems inconsistent.',
    graph: {
      nodes: [
        {
          id: 'action-1',
          type: 'actionNode',
          position: { x: 360, y: 100 },
          data: {
            title: "Bruno's Final Recommendation",
            reasoning:
              'This recommendation is grounded in the vibration and cavitation guidelines from the Goulds 3196 operation manual, cross-referenced with prior maintenance cases involving similar vibration signatures. The combination of excessive vibration, noise, and unstable pressure strongly indicates cavitation or suction-related issues. The manual specifies that insufficient suction head (NPSH) and improper priming can lead to these exact symptoms, and immediate shutdown is required when vibration exceeds normal levels.',
            likelyCauses: [
              'Cavitation due to insufficient NPSH (low suction head)',
              'Air or vapor pockets in the suction line',
              'Pump not properly primed before operation',
              'Partial blockage in suction line or impeller',
            ],
            actions: [
              'Shut down the pump immediately to prevent damage to bearings and seals.',
              'Inspect suction line to ensure it is fully open and free of obstructions.',
              'Check for air leaks or vapor pockets in suction piping.',
              'Re-prime the pump to ensure proper fluid fill before restart.',
              'Restart and monitor vibration levels, pressure stability, and noise.',
            ],
            sources: [
              { type: 'manual', title: 'Goulds 3196 Operation Manual', ref: 'page 73', confidence: 'high' },
              { type: 'manual', title: 'Goulds 3196 Startup Procedure', ref: 'page 72', confidence: 'high' },
              { type: 'log', title: 'Maintenance Log', ref: '2026 Feb 12 entry', confidence: 'high' },
            ],
          },
        },
        {
          id: 'manual-1',
          type: 'manualNode',
          position: { x: 20, y: 280 },
          data: {
            title: 'Supporting Manual Extract',
            confidence: 87,
            docType: 'Operational',
            bullets: [
              'Pump must be immediately shut down if excessive vibration or noise occurs.',
              'Cavitation risk arises when suction head is insufficient (NPSHA below required threshold).',
              'Re-prime the pump if rated pressure is not reached after startup.',
            ],
            sourceRef: 'Goulds 3196 Operation Manual — page 73',
            fullText:
              'TROUBLESHOOTING — VIBRATION & NOISE\n\nExcessive vibration or unusual noise during operation is a critical warning sign that must not be ignored. The pump must be shut down immediately to prevent damage to bearings, mechanical seals, and internal wetted components.\n\nCommon causes:\n• Cavitation: occurs when the available NPSH (NPSHA) falls below the required NPSH (NPSHR). Symptoms include rattling, vibration, and inconsistent flow.\n• Air/vapor in suction line: can cause erratic operation and pressure fluctuation.\n• Improper priming: pump must be fully primed before starting.\n• Clogged impeller or suction strainer: restricts flow and can induce cavitation.\n\nCorrective action:\n1. Shut down immediately.\n2. Verify suction line is fully open and unobstructed.\n3. Bleed air from suction piping.\n4. Re-prime pump per startup procedure (page 72).\n5. Restart and monitor.',
            demoDocUrl,
          },
        },
        {
          id: 'case-1',
          type: 'caseNode',
          position: { x: 760, y: 420 },
          data: {
            title: 'Past Maintenance Case',
            confidence: 87,
            docType: 'Operational',
            technician: { name: 'Daniel R. Costa', initials: 'DC' },
            date: '2026 Feb 12',
            manualRef: 'Goulds 3196 Operation Manual',
            symptom: 'Excessive vibration and rattling noise observed during operation, especially after startup. Pump output pressure fluctuating.',
            cause: 'Insufficient suction conditions leading to cavitation (NPSHA below required threshold), causing unstable flow and vibration.',
            fix: 'Shut down pump immediately. Verified suction line fully open and unobstructed. Eliminated air pockets in suction line. Re-primed pump and restarted system.',
            sourceRef: 'Maintenance Log — 2026 Feb 12',
            similarNote:
              'Similar vibration pattern recorded in prior operation logs; resolved by correcting suction conditions and ensuring proper priming. No component replacement required; issue was operational rather than mechanical.',
          },
        },
        {
          id: 'device-1',
          type: 'deviceNode',
          position: { x: 860, y: 80 },
          data: {
            analysis:
              'Excessive vibration and rattling noise detected approximately 2 minutes after startup. Flow rate inconsistent; output pressure fluctuating. Pattern is consistent with cavitation or a suction-side fault (air ingestion or insufficient NPSH).',
          },
        },
      ],
      edges: [
        dashedEdge('e-action-manual', 'action-1', 'manual-1'),
        dashedEdge('e-action-case',   'action-1', 'case-1'),
        dashedEdge('e-action-device', 'action-1', 'device-1'),
      ],
    },
  }
}

// Shared edge style helpers
const dashedEdge = (id, source, target, extra = {}) => ({
  id,
  source,
  target,
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '6 4' },
  markerEnd: { type: 'arrowclosed', color: '#94a3b8', width: 14, height: 14 },
  ...extra,
})

// ─── Scenario 1: Overheating / Belt ─────────────────────────────────────────

function overheatBeltScenario(problem) {
  return {
    session_id: 'mock-session-001',
    problem: problem || 'Overheating detected in packaging conveyor belt — Pulley Unit NF-83C',
    graph: {
      nodes: [
        {
          id: 'action-1',
          type: 'actionNode',
          position: { x: 360, y: 100 },
          data: {
            title: "Bruno's Final Recommendation",
            reasoning:
              'This recommendation is grounded in the belt slippage prevention guidelines from the NF-83C operations manual and cross-referenced with three historical maintenance entries. The thermal signature and symptom pattern match prior incidents that were resolved by correcting belt tension.',
            likelyCauses: [
              'Loose or worn drive belt',
              'Improper belt tension outside specified range',
              'Pulley slippage on the NF-83C unit',
            ],
            actions: [
              'Power down the machine and apply lockout/tagout protocol.',
              'Inspect the NF-83C pulley and measure belt tension against spec (page 12).',
              'Tighten the belt or replace if wear exceeds 15 % elongation.',
              'Check pulley alignment with calibration gauge — tolerance ±0.2 mm.',
              'Restart and monitor belt temperature for 20 minutes.',
            ],
            sources: [
              { type: 'manual', title: 'Operations Manual NF-83C Pulley', ref: 'page 12', confidence: 'high' },
              { type: 'log', title: 'Maintenance Log', ref: '2023 Apr 18 entry', confidence: 'high' },
            ],
          },
        },
        {
          id: 'manual-1',
          type: 'manualNode',
          position: { x: 20, y: 280 },
          data: {
            title: 'Supporting Manual Extract',
            confidence: 87,
            docType: 'Operational',
            bullets: [
              'Secure the drive belt firmly around the NF-83C pulley before each shift.',
              'Adjust belt tension to prevent slippage and overheating as shown in Figure 5a.',
              'Replace drive belt if surface cracks or fraying are visible.',
            ],
            sourceRef: 'Operations Manual NF-83C Pulley — page 12',
            fullText:
              '5.3 BELT MAINTENANCE\n\nThe NF-83C drive belt must be inspected every 500 operating hours or at the first sign of abnormal heat output. Correct tension is critical to prevent slip-induced thermal buildup.\n\n• Secure the drive belt firmly around the NF-83C pulley before each shift.\n• Adjust belt tension to prevent slippage and overheating as shown in Figure 5a.\n• Replace drive belt if surface cracks or fraying are visible.\n• Lubricate contact points with manufacturer-approved grease (Part No. L-2240) every 1000 h.\n\nCaution: Operating with incorrect belt tension voids the warranty and may damage the thermal sensor array.',
          },
        },
        {
          id: 'case-1',
          type: 'caseNode',
          position: { x: 760, y: 420 },
          data: {
            title: 'Past Maintenance Case',
            confidence: 81,
            docType: 'Operational',
            technician: { name: 'Marco A. Diorent', initials: 'MD' },
            date: '3 days ago',
            manualRef: 'Operations Manual NF-83C Pulley',
            symptom: 'Overheating detected in the packaging belt — Pulley NF-83C',
            cause: 'Drive belt was loose and slipping intermittently under load',
            fix: 'Tightened drive belt to correct tension (12 N·m) and recalibrated belt-ratio sensor on page 9',
            sourceRef: 'Maintenance Log — 2023 Apr 18',
            similarNote:
              'Identical failure pattern with NF-83C pulley recorded six months prior; resolved by belt retension. No component replacement required.',
          },
        },
        {
          id: 'device-1',
          type: 'deviceNode',
          position: { x: 860, y: 80 },
          data: {
            analysis:
              'Unusual thermal signature detected. Temperature at belt contact point 18 °C above baseline. Consistent with friction-induced heat from belt slippage.',
          },
        },
      ],
      edges: [
        dashedEdge('e-action-manual', 'action-1', 'manual-1'),
        dashedEdge('e-action-case',   'action-1', 'case-1'),
        dashedEdge('e-action-device', 'action-1', 'device-1'),
      ],
    },
  }
}

// ─── Scenario 2: Bearing Vibration ──────────────────────────────────────────

function bearingVibrationScenario(problem) {
  return {
    session_id: 'mock-session-002',
    problem: problem || 'Excessive vibration and noise in motor drive shaft — Bearing Unit MDS-12',
    graph: {
      nodes: [
        {
          id: 'action-1',
          type: 'actionNode',
          position: { x: 360, y: 100 },
          data: {
            title: "Bruno's Final Recommendation",
            reasoning:
              'Vibration spectrum analysis in the MDS-12 manual points to bearing fatigue as the primary failure mode at this RPM range. Two previous cases with similar signatures were resolved through bearing replacement combined with shaft realignment.',
            likelyCauses: [
              'Bearing fatigue or spalling on inner race',
              'Shaft misalignment exceeding 0.05 mm tolerance',
              'Insufficient lubrication causing metal-to-metal contact',
            ],
            actions: [
              'Halt machine and isolate power — lockout/tagout required.',
              'Remove drive-end bearing cover and inspect bearing surface for spalling.',
              'Measure shaft runout with dial indicator — compare to MDS-12 spec (page 8).',
              'Replace bearing if vibration amplitude exceeds 4.5 mm/s RMS.',
              'Realign shaft and verify coupling clearance before restart.',
            ],
            sources: [
              { type: 'manual', title: 'Motor Drive Shaft Manual MDS-12', ref: 'page 8', confidence: 'high' },
              { type: 'log', title: 'Vibration Log', ref: '2024 Jan 09 entry', confidence: 'high' },
            ],
          },
        },
        {
          id: 'manual-1',
          type: 'manualNode',
          position: { x: 20, y: 280 },
          data: {
            title: 'Supporting Manual Extract',
            confidence: 91,
            docType: 'Operational',
            bullets: [
              'Vibration levels above 4.5 mm/s RMS indicate bearing replacement is required.',
              'Inspect bearing every 250 operating hours in high-load environments.',
              'Use only approved SKF 6205-2RS bearings for MDS-12 drive end.',
            ],
            sourceRef: 'Motor Drive Shaft Manual MDS-12 — page 8',
            fullText:
              '4.2 VIBRATION & BEARING INSPECTION\n\nAbnormal vibration in the MDS-12 is most commonly attributed to bearing wear or shaft imbalance. The following thresholds apply:\n\n• Acceptable: < 2.8 mm/s RMS\n• Warning: 2.8 – 4.5 mm/s RMS — schedule inspection within 48 h\n• Critical: > 4.5 mm/s RMS — immediate shutdown required\n\nProcedure:\n1. Remove drive-end bearing cover.\n2. Inspect bearing surface for spalling, pitting, or discolouration.\n3. Measure shaft runout with dial indicator at coupling end.\n4. Replace bearing if inner race shows any wear depth > 0.3 mm.',
          },
        },
        {
          id: 'case-1',
          type: 'caseNode',
          position: { x: 760, y: 420 },
          data: {
            title: 'Past Maintenance Case',
            confidence: 88,
            docType: 'Operational',
            technician: { name: 'Priya S. Nair', initials: 'PN' },
            date: '12 days ago',
            manualRef: 'Motor Drive Shaft Manual MDS-12',
            symptom: 'Loud grinding noise and 6.2 mm/s vibration reading on drive shaft',
            cause: 'Inner race spalling on drive-end bearing, amplified by insufficient grease',
            fix: 'Replaced SKF 6205-2RS bearing; regreased with Mobilux EP 2; realigned shaft to 0.03 mm runout',
            sourceRef: 'Vibration Log — 2024 Jan 09',
            similarNote:
              'Same bearing model failed identically on Line 3 motor six weeks earlier; root cause was extended grease interval. Maintenance schedule updated.',
          },
        },
        {
          id: 'device-1',
          type: 'deviceNode',
          position: { x: 860, y: 80 },
          data: {
            analysis:
              'High-frequency vibration spike at 84 Hz detected. Amplitude 5.8 mm/s RMS — exceeds critical threshold. Pattern consistent with inner race bearing wear.',
          },
        },
      ],
      edges: [
        dashedEdge('e-action-manual', 'action-1', 'manual-1'),
        dashedEdge('e-action-case',   'action-1', 'case-1'),
        dashedEdge('e-action-device', 'action-1', 'device-1'),
      ],
    },
  }
}

// ─── Scenario 3: Hydraulic Leak ──────────────────────────────────────────────

function hydraulicLeakScenario(problem) {
  return {
    session_id: 'mock-session-003',
    problem: problem || 'Hydraulic fluid leak detected at cylinder rod seal — Press Unit HP-400',
    graph: {
      nodes: [
        {
          id: 'action-1',
          type: 'actionNode',
          position: { x: 360, y: 100 },
          data: {
            title: "Bruno's Final Recommendation",
            reasoning:
              'The leak profile and fluid loss rate described are consistent with rod seal degradation at elevated operating pressures. Historical logs show this is a recurring failure mode on HP-400 units operating above 280 bar, and the OEM manual provides a specific seal replacement procedure.',
            likelyCauses: [
              'Rod seal degradation due to pressure cycling fatigue',
              'Contaminated hydraulic fluid accelerating seal wear',
              'Rod surface scoring creating a leak path past the seal',
            ],
            actions: [
              'Depressurise the hydraulic circuit fully before any inspection.',
              'Inspect rod surface for scoring — use magnifying glass or dye penetrant.',
              'Replace rod seal kit (Part No. HP-400-SK2) per procedure on page 15.',
              'Flush and replace hydraulic fluid if contamination is confirmed.',
              'Pressurise to 100 bar and hold for 10 min to verify seal integrity.',
            ],
            sources: [
              { type: 'manual', title: 'HP-400 Hydraulic Press Manual', ref: 'page 15', confidence: 'high' },
              { type: 'log', title: 'Maintenance Log', ref: '2023 Nov 22 entry', confidence: 'medium' },
            ],
          },
        },
        {
          id: 'manual-1',
          type: 'manualNode',
          position: { x: 20, y: 280 },
          data: {
            title: 'Supporting Manual Extract',
            confidence: 93,
            docType: 'Operational',
            bullets: [
              'Fully depressurise circuit before removing any hydraulic seals.',
              'Use only approved seal kit HP-400-SK2 — substitutes may fail under cyclic load.',
              'Inspect rod chrome surface for pitting before installing new seal.',
            ],
            sourceRef: 'HP-400 Hydraulic Press Manual — page 15',
            fullText:
              '7.1 ROD SEAL REPLACEMENT\n\nRod seal leakage is the most common maintenance action on the HP-400. Seals have a rated life of 500,000 cycles at ≤ 280 bar. Operation above this pressure reduces service life significantly.\n\n• Depressurise circuit fully (gauge must read 0 bar).\n• Remove gland nut using spanner HP-GN40.\n• Carefully extract the worn seal with a plastic pick — avoid scoring the bore.\n• Clean bore and rod with lint-free cloth and ISO VG46 fluid.\n• Install new seal (HP-400-SK2) ensuring correct lip orientation (lip faces pressure side).\n• Torque gland nut to 95 N·m.\n• Pressurise gradually and check for seepage at each 50 bar increment.',
          },
        },
        {
          id: 'case-1',
          type: 'caseNode',
          position: { x: 760, y: 420 },
          data: {
            title: 'Past Maintenance Case',
            confidence: 79,
            docType: 'Operational',
            technician: { name: 'David R. Okonkwo', initials: 'DO' },
            date: '18 days ago',
            manualRef: 'HP-400 Hydraulic Press Manual',
            symptom: 'Visible fluid weeping around cylinder rod at full extension, ~0.5 L/day loss',
            cause: 'Rod seal lip torn — likely caused by contaminated ISO VG46 fluid (particles found in filter)',
            fix: 'Replaced seal kit HP-400-SK2; flushed full hydraulic circuit; replaced 20 µm filter element',
            sourceRef: 'Maintenance Log — 2023 Nov 22',
            similarNote:
              'Contamination root cause traced to worn reservoir breather filter. Breather replaced and fluid analysis now scheduled quarterly.',
          },
        },
        {
          id: 'device-1',
          type: 'deviceNode',
          position: { x: 860, y: 80 },
          data: {
            analysis:
              'Pressure drop of 4.2 bar/min detected on cylinder circuit. Fluid level sensor reading 11 % below nominal. Leak rate consistent with rod seal failure.',
          },
        },
      ],
      edges: [
        dashedEdge('e-action-manual', 'action-1', 'manual-1'),
        dashedEdge('e-action-case',   'action-1', 'case-1'),
        dashedEdge('e-action-device', 'action-1', 'device-1'),
      ],
    },
  }
}
