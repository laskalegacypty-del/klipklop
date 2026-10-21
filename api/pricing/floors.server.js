// SERVER ONLY. Minimum acceptable per-seat prices for client counter-proposals.
// Never import this from src/, never return it in an API response.
// Override without a deploy by setting the PRICING_FLOORS secret to JSON,
// e.g. {"rider":8,"supporter":1.5,"producer":40,"admin":80}.

const DEFAULT_FLOORS = {
  rider: 8,
  supporter: 1.5,
  producer: 40,
  admin: 80,
}

export function getFloors() {
  const raw = process.env.PRICING_FLOORS
  if (!raw) return DEFAULT_FLOORS
  try {
    const parsed = JSON.parse(raw)
    const out = {}
    for (const k of Object.keys(DEFAULT_FLOORS)) {
      const n = Number(parsed[k])
      out[k] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_FLOORS[k]
    }
    return out
  } catch {
    return DEFAULT_FLOORS
  }
}
