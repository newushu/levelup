"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VideoRow = {
  id?: string;
  name: string;
  url: string;
  categories: string[];
  levels: string[];
  tags: string[];
  created_at?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function normalizeTags(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeList(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function getYouTubeId(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(?:v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return match?.[1] ?? "";
}

function getYouTubeThumb(url: string) {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

export default function VideoLibraryAdminPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [newVideo, setNewVideo] = useState({ id: "", name: "", url: "", categories: "", levels: "", tags: "" });

  async function load() {
    const res = await fetch("/api/admin/videos", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load videos");
    setVideos((sj.json?.videos ?? []) as VideoRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveVideo(row: VideoRow) {
    setSaving(true);
    const res = await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, tags: row.tags }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save video");
    await load();
  }

  async function createVideo() {
    if (!newVideo.name.trim()) return setMsg("Enter a video name.");
    if (!newVideo.url.trim()) return setMsg("Enter a video URL.");
    const categories = normalizeList(newVideo.categories);
    const levels = normalizeList(newVideo.levels);
    const tags = normalizeTags(newVideo.tags);
    await saveVideo({
      id: newVideo.id || undefined,
      name: newVideo.name.trim(),
      url: newVideo.url.trim(),
      categories,
      levels,
      tags,
    });
    setNewVideo({ id: "", name: "", url: "", categories: "", levels: "", tags: "" });
  }

  async function removeVideo(id?: string) {
    if (!id) return;
    const res = await fetch("/api/admin/videos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete video");
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  const sorted = useMemo(
    () => [...videos].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))),
    [videos]
  );
  const derived = useMemo(() => {
    const categories = new Set<string>();
    const levels = new Set<string>();
    const tags = new Set<string>();
    videos.forEach((v) => {
      (v.categories ?? []).forEach((c) => categories.add(String(c)));
      (v.levels ?? []).forEach((l) => levels.add(String(l)));
      (v.tags ?? []).forEach((t) => tags.add(String(t).toLowerCase()));
    });
    return {
      categories: Array.from(categories).sort(),
      levels: Array.from(levels).sort(),
      tags: Array.from(tags).sort(),
    };
  }, [videos]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Video Library</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Manage YouTube videos and searchable tags.</div>
        </div>
        <Link href="/admin/custom" style={{ color: "white", textDecoration: "underline", fontSize: 12 }}>
          Back to Admin Custom
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>{newVideo.id ? "Edit Video" : "Add Video"}</div>
        <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <label style={label()}>
            Name
            <input value={newVideo.name} onChange={(e) => setNewVideo((p) => ({ ...p, name: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            YouTube URL
            <input value={newVideo.url} onChange={(e) => setNewVideo((p) => ({ ...p, url: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            Categories (comma-separated)
            <input
              value={newVideo.categories}
              onChange={(e) => setNewVideo((p) => ({ ...p, categories: e.target.value }))}
              style={input()}
            />
          </label>
          {!!derived.categories.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {derived.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setNewVideo((p) => ({
                      ...p,
                      categories: p.categories ? `${p.categories}, ${cat}` : cat,
                    }))
                  }
                  style={tagPick()}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}
          <label style={label()}>
            Levels (comma-separated)
            <input
              value={newVideo.levels}
              onChange={(e) => setNewVideo((p) => ({ ...p, levels: e.target.value }))}
              style={input()}
            />
          </label>
          {!!derived.levels.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {derived.levels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    setNewVideo((p) => ({
                      ...p,
                      levels: p.levels ? `${p.levels}, ${lvl}` : lvl,
                    }))
                  }
                  style={tagPick()}
                >
                  {lvl}
                </button>
              ))}
            </div>
          ) : null}
          <label style={label()}>
            Tags (comma-separated)
            <input value={newVideo.tags} onChange={(e) => setNewVideo((p) => ({ ...p, tags: e.target.value }))} style={input()} />
          </label>
          {!!derived.tags.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {derived.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setNewVideo((p) => ({
                      ...p,
                      tags: p.tags ? `${p.tags}, ${tag}` : tag,
                    }))
                  }
                  style={tagPick()}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
          <button onClick={createVideo} style={btn()} disabled={saving}>
            {newVideo.id ? "Update Video" : "Save Video"}
          </button>
          {newVideo.id ? (
            <button
              type="button"
              onClick={() => setNewVideo({ id: "", name: "", url: "", categories: "", levels: "", tags: "" })}
              style={btnGhost()}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Current Library</div>
        <div style={{ display: "grid", gap: 12 }}>
          {!sorted.length && <div style={{ opacity: 0.7 }}>No videos yet.</div>}
          {sorted.map((video) => (
            <div key={video.id} style={videoRow()}>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "120px 1fr", alignItems: "center" }}>
                <div style={thumbWrap()}>
                  {getYouTubeThumb(video.url) ? (
                    <img src={getYouTubeThumb(video.url)} alt={video.name} style={thumbImg()} />
                  ) : (
                    <div style={{ fontSize: 11, opacity: 0.7 }}>No thumbnail</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>{video.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{video.url}</div>
                {!!(video.categories ?? []).length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(video.categories ?? []).map((cat) => (
                      <span key={cat} style={pill("rgba(59,130,246,0.25)")}>{cat}</span>
                    ))}
                  </div>
                ) : null}
                {!!(video.levels ?? []).length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(video.levels ?? []).map((lvl) => (
                      <span key={lvl} style={pill("rgba(34,197,94,0.22)")}>{lvl}</span>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(video.tags ?? []).map((tag) => (
                    <span key={tag} style={tagPill()}>{tag}</span>
                  ))}
                </div>
              </div>
              </div>
              <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                <button
                  onClick={() =>
                    setNewVideo({
                      id: String(video.id ?? ""),
                      name: video.name ?? "",
                      url: video.url ?? "",
                      categories: (video.categories ?? []).join(", "),
                      levels: (video.levels ?? []).join(", "),
                      tags: (video.tags ?? []).join(", "),
                    })
                  }
                  style={btnGhost()}
                >
                  Edit
                </button>
                <button onClick={() => removeVideo(video.id)} style={btnGhost()}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
  };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, fontWeight: 900 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.90), rgba(59,130,246,0.70))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 12px",
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(248,113,113,0.12)",
    fontSize: 12,
    fontWeight: 900,
  };
}

function tagPick(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 11,
    fontWeight: 900,
    color: "white",
    cursor: "pointer",
  };
}

function pill(tint: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: tint,
  };
}

function videoRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
  };
}

function thumbWrap(): React.CSSProperties {
  return {
    width: 120,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "grid",
    placeItems: "center",
  };
}

function thumbImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

function tagPill(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
  };
}
