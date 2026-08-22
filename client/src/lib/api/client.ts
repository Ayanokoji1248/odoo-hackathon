/**
 * Mock API client. Simulates network latency so components can be written
 * against an async data layer that a real backend can later replace.
 */
export function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
