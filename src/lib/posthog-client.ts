export interface PostHogEventDef {
  id: string;
  name: string;
  last_seen_at: string | null;
  volume_30_day: number | null;
}

export interface PostHogProjectInfo {
  id: number;
  name: string;
}

/** Fetch all event definitions for a PostHog project. */
export async function getProjectEvents(
  projectId: string,
  apiKey: string,
  host: string
): Promise<PostHogEventDef[]> {
  const url = `${host}/api/projects/${projectId}/event_definitions/?limit=500&order_by=-volume_30_day`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    // 10 second timeout via AbortController
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`PostHog API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { results?: PostHogEventDef[] };
  return data.results ?? [];
}

/** Verify PostHog API key + project access. Returns project info on success. */
export async function testPostHogConnection(
  projectId: string,
  apiKey: string,
  host: string
): Promise<{ ok: true; projectName: string } | { ok: false; error: string }> {
  try {
    const url = `${host}/api/projects/${projectId}/`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json() as PostHogProjectInfo;
    return { ok: true, projectName: data.name ?? `Project ${projectId}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, error: message };
  }
}
