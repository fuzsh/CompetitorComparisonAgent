import type { CompareRequest, Comparison, Stage, Status } from "./types";

export const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010";

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res;
}

export const getPresets = () => fetch(`${API}/api/presets`).then(ok).then((r) => r.json() as Promise<{ industries: Record<string, string[]> }>);
export const getExamples = () => fetch(`${API}/api/examples`).then(ok).then((r) => r.json() as Promise<Record<string, CompareRequest>>);
export const getHealth = () => fetch(`${API}/api/health`).then(ok).then((r) => r.json() as Promise<Record<string, string | boolean>>);

/** POST /api/comparisons/stream and parse server-sent events from the response body (EventSource is GET-only). */
export async function streamComparison(
  req: CompareRequest,
  onEvent: (stage: Stage, payload: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await ok(
    await fetch(`${API}/api/comparisons/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    }),
  );
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let stage = "";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) stage = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (stage) onEvent(stage as Stage, data ? JSON.parse(data) : {});
    }
  }
}

export const patchCell = (id: string, patch: { field_id: string; entity_id: string; value: string | null; status: Status }) =>
  fetch(`${API}/api/comparisons/${id}/cell`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    .then(ok)
    .then((r) => r.json() as Promise<Comparison>);

export const exportComparison = (id: string, format: "markdown" | "csv" | "html" | "pptx") =>
  fetch(`${API}/api/comparisons/${id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format }) })
    .then(ok)
    .then((r) => r.blob());
