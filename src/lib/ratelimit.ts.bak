import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 intentos por minuto
      prefix: "ratelimit",
    })
  : null;

// Si Upstash no está configurado, devuelve true (no bloquea nada).
export async function checkRateLimit(key: string): Promise<boolean> {
  if (!ratelimit) return true;
  const { success } = await ratelimit.limit(key);
  return success;
}
