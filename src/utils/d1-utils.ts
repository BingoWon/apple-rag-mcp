/**
 * D1 Database Utilities - Timeout protection for D1 operations
 */

const D1_TIMEOUT_MS = 3000;

const raceWithTimeout = <T>(
  operation: () => Promise<T>,
  name: string
): Promise<T> =>
  Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`D1 timeout: ${name}`)), D1_TIMEOUT_MS)
    ),
  ]);

export async function withD1Timeout<T>(
  operation: () => Promise<T>,
  fallback: T,
  name: string
): Promise<T> {
  try {
    return await raceWithTimeout(operation, name);
  } catch (error) {
    console.error(`D1 failed (${name}): ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

export function backgroundD1Write(
  ctx: ExecutionContext | undefined,
  operation: () => Promise<void>,
  name: string
): void {
  const run = async () => {
    try {
      await raceWithTimeout(operation, name);
    } catch (error) {
      console.error(`D1 background failed (${name}): ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  ctx ? ctx.waitUntil(run()) : run();
}
