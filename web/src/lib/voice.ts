import { Device, type Call } from '@twilio/voice-sdk';

// Empty in production (same-origin). Set in web/.env to point local dev at a deployed service.
const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_BASE ?? '';

export interface Runner {
  bib: string;
  name: string;
}

export interface SeedResult extends Runner {
  listen_link: string;
}

export async function lookupRunner(bib: string): Promise<Runner> {
  const res = await fetch(`${FUNCTIONS_BASE}/lookup?bib=${encodeURIComponent(bib)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Lookup failed.');
  return data as Runner;
}

export async function createDevice(): Promise<Device> {
  const res = await fetch(`${FUNCTIONS_BASE}/token`);
  if (!res.ok) throw new Error('Could not get an access token.');
  const { token } = (await res.json()) as { token: string };
  return new Device(token, { logLevel: 'error' });
}

/** Replace the roster. Returns each runner's private listen link. */
export async function seedRoster(
  rows: Runner[],
  secret: string
): Promise<{ count: number; results: SeedResult[] }> {
  const res = await fetch(`${FUNCTIONS_BASE}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body: JSON.stringify({ rows }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.details) ? `: ${data.details.join('; ')}` : '';
    throw new Error((data.error || 'Upload failed.') + detail);
  }
  return data as { count: number; results: SeedResult[] };
}

export type { Call, Device };
