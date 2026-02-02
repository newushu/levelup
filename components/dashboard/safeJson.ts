export async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: res.status,
      json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` },
    };
  }
}
