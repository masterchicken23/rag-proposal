const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

/**
 * Submit a natural-language problem description to the RAG pipeline.
 *
 * Expected response shape:
 * {
 *   session_id: string,
 *   problem:    string,
 *   graph: {
 *     nodes: Array<{ id, type, position, data }>,
 *     edges: Array<{ id, source, target, type, style }>
 *   }
 * }
 */
export async function submitQuery({ problem, sessionId, machineId }) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problem,
      session_id: sessionId,
      machine_id: machineId,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Query failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Retrieve a list of past troubleshooting sessions.
 *
 * Expected response shape:
 * Array<{ id, problem, machine_id, timestamp, status }>
 */
export async function getSessions({ limit = 20 } = {}) {
  const res = await fetch(`${API_BASE}/sessions?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
  return res.json()
}

/**
 * Retrieve a single session by ID, including its full graph and message history.
 *
 * Expected response shape:
 * { id, problem, machine_id, timestamp, graph, messages: Array<{role, text}> }
 */
export async function getSession(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`)
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
  return res.json()
}

/**
 * Semantic search across indexed OEM documents and historical maintenance logs.
 *
 * Expected response shape:
 * { results: Array<{ text, source, score, metadata }> }
 */
export async function searchDocuments({ query, nResults = 5, machineId } = {}) {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      n_results: nResults,
      machine_id: machineId,
    }),
  })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  return res.json()
}

/**
 * Upload an OEM manual or maintenance log to the ingestion pipeline.
 *
 * Expected response shape:
 * { filename, chunks, status }
 */
export async function uploadDocument(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}
