export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, { startedAt: number; count: number }>();

export function checkMcpRateLimit(
  key: string,
  now = Date.now(),
  limit = Number(process.env.MCP_MAX_CALLS_PER_MINUTE ?? 60),
): RateLimitDecision {
  const windowMs = 60_000;
  const current = buckets.get(key);
  const bucket = !current || now - current.startedAt >= windowMs
    ? { startedAt: now, count: 0 }
    : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count <= limit,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1_000)),
  };
}
