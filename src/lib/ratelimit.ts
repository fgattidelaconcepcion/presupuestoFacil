import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv({
        // Sin esto el SDK reintenta 5 veces con backoff y el login tarda >4s
        // cuando Upstash no responde.
        retry: { retries: 1, backoff: () => 200 },
      }),
      limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 intentos por minuto
      prefix: "ratelimit",
    })
  : null;

// Si Upstash tarda más que esto, no vale la pena seguir esperando:
// el rate limit es una protección, no un requisito para poder entrar.
const TIMEOUT_MS = 2000;

/**
 * Devuelve true si el intento está permitido.
 *
 * IMPORTANTE: falla "abierto". Si Upstash no está configurado, no responde,
 * o tira error, se PERMITE el intento. Antes cualquier problema de red con
 * Upstash lanzaba una excepción que subía hasta authorize() y hacía que
 * TODOS los logins devolvieran 401, sin importar la contraseña.
 */
export async function checkRateLimit(key: string): Promise<boolean> {
  if (!ratelimit) return true;

  try {
    const resultado = await Promise.race([
      ratelimit.limit(key),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);

    if (resultado === null) {
      console.error(`[ratelimit] Upstash no respondió en ${TIMEOUT_MS}ms — se permite el intento (${key})`);
      return true;
    }

    return resultado.success;
  } catch (error) {
    console.error("[ratelimit] Upstash falló — se permite el intento:", error);
    return true;
  }
}
