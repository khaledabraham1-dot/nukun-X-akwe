// Appel de l'API serverless de score (GraphSAGE rejoué en NumPy).
// Renvoie null en cas d'échec : le front retombe alors sur engine.json.
const TIMEOUT_MS = 4000

export async function fetchScore(receiver, amount) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const params = new URLSearchParams({ receiver: String(receiver), amount: String(Math.round(Number(amount))) })
    const res = await fetch(`/api/score?${params}`, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data && data.scores ? data : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
