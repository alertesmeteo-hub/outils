/**
 * Limiteur de débit en mémoire (fenêtre glissante simple).
 * Suffisant pour une instance unique ; en multi-instances / serverless, remplacer par Redis / Upstash.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
