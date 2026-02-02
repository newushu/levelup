"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type VideoRow = {
  id: string;
  name: string;
  url: string;
  categories: string[];
  levels: string[];
  tags: string[];
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

function toEmbed(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("youtube.com/embed/")) return trimmed;
  const match = trimmed.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const id = match?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : trimmed;
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

export default function VideoLibraryPage() {
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [msg, setMsg] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [levelQuery, setLevelQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [searchName, setSearchName] = useState("");
  const [activeVideo, setActiveVideo] = useState<VideoRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data?.role === "student") setStudentBlocked(true);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/videos/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load videos");
      setVideos((sj.json?.videos ?? []) as VideoRow[]);
    })();
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => (v.tags ?? []).forEach((t) => set.add(String(t).toLowerCase())));
    return Array.from(set).sort();
  }, [videos]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => (v.categories ?? []).forEach((c) => set.add(String(c))));
    return Array.from(set).sort();
  }, [videos]);

  const allLevels = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => (v.levels ?? []).forEach((l) => set.add(String(l))));
    return Array.from(set).sort();
  }, [videos]);

  const filtered = useMemo(() => {
    const nameQuery = searchName.trim().toLowerCase();
    return videos.filter((v) => {
      const tags = (v.tags ?? []).map((t) => String(t).toLowerCase());
      const categories = (v.categories ?? []).map((c) => String(c));
      const levels = (v.levels ?? []).map((l) => String(l));
      const matchTags = selectedTags.every((t) => tags.includes(t));
      const matchCategories = selectedCategories.every((c) => categories.includes(c));
      const matchLevels = selectedLevels.every((l) => levels.includes(l));
      const matchName = !nameQuery || v.name.toLowerCase().includes(nameQuery);
      return matchTags && matchCategories && matchLevels && matchName;
    });
  }, [videos, selectedTags, selectedCategories, selectedLevels, searchName]);

  function applyTagQuery() {
    const next = normalizeTags(tagQuery);
    setSelectedTags(next);
  }

  function applyCategoryQuery() {
    const next = normalizeList(categoryQuery);
    setSelectedCategories(next);
  }

  function applyLevelQuery() {
    const next = normalizeList(levelQuery);
    setSelectedLevels(next);
  }

  return (
    <AuthGate>
      {studentBlocked ? (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Video Library is coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
        </div>
      ) : (
        <main style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 1000 }}>Video Library</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Search technique clips by tags and level.</div>
            </div>
          </div>

          {msg ? <div style={notice()}>{msg}</div> : null}

          <div style={card()}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={label()}>Category filter (comma-separated)</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder="striking, basics, forms"
                    style={{ ...input(), minWidth: 260 }}
                  />
                  <button onClick={applyCategoryQuery} style={btnGhost()}>Apply Categories</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {allCategories.map((cat) => {
                    const active = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() =>
                          setSelectedCategories((prev) => (active ? prev.filter((c) => c !== cat) : [...prev, cat]))
                        }
                        style={tagBtn(active)}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={label()}>Level filter (comma-separated)</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={levelQuery}
                    onChange={(e) => setLevelQuery(e.target.value)}
                    placeholder="beginner, intermediate"
                    style={{ ...input(), minWidth: 260 }}
                  />
                  <button onClick={applyLevelQuery} style={btnGhost()}>Apply Levels</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {allLevels.map((lvl) => {
                    const active = selectedLevels.includes(lvl);
                    return (
                      <button
                        key={lvl}
                        onClick={() =>
                          setSelectedLevels((prev) => (active ? prev.filter((l) => l !== lvl) : [...prev, lvl]))
                        }
                        style={tagBtn(active)}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={label()}>Tag filter (comma-separated)</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    placeholder="beginner, jumps, power"
                    style={{ ...input(), minWidth: 260 }}
                  />
                  <button onClick={applyTagQuery} style={btnGhost()}>Apply Tags</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {allTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                      }
                      style={tagBtn(active)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <label style={label()}>
                Search by name
                <input value={searchName} onChange={(e) => setSearchName(e.target.value)} style={input()} />
              </label>
            </div>
          </div>

          <div style={card()}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>
              Results ({filtered.length})
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {!filtered.length && <div style={{ opacity: 0.7 }}>No videos match those tags.</div>}
              {filtered.map((video) => (
                <button key={video.id} style={videoCard()} onClick={() => setActiveVideo(video)}>
                  {getYouTubeThumb(video.url) ? (
                    <div style={thumbWrap()}>
                      <img src={getYouTubeThumb(video.url)} alt={video.name} style={thumbImg()} />
                    </div>
                  ) : null}
                  <div style={{ fontWeight: 900 }}>{video.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>{video.url}</div>
                  {!!(video.categories ?? []).length ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {(video.categories ?? []).map((cat) => (
                        <span key={cat} style={pill("rgba(59,130,246,0.25)")}>{cat}</span>
                      ))}
                    </div>
                  ) : null}
                  {!!(video.levels ?? []).length ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {(video.levels ?? []).map((lvl) => (
                        <span key={lvl} style={pill("rgba(34,197,94,0.22)")}>{lvl}</span>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {(video.tags ?? []).map((tag) => (
                      <span key={tag} style={tagPill()}>{tag}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {activeVideo ? (
            <div style={overlay()} onClick={() => setActiveVideo(null)}>
              <div style={overlayPanel()} onClick={(e) => e.stopPropagation()}>
                <button style={closeBtn()} onClick={() => setActiveVideo(null)}>
                  ✕
                </button>
                <div style={{ fontWeight: 1000, marginBottom: 10 }}>{activeVideo.name}</div>
                <div style={{ position: "relative", paddingTop: "56.25%" }}>
                  <iframe
                    src={toEmbed(activeVideo.url)}
                    title={activeVideo.name}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 12, border: "none" }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </main>
      )}
    </AuthGate>
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
  return { fontSize: 12, fontWeight: 900 };
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

function tagBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.8)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
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

function videoCard(): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    display: "grid",
    gap: 6,
    cursor: "pointer",
  };
}

function thumbWrap(): React.CSSProperties {
  return {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function thumbImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };
}

function overlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "grid",
    placeItems: "center",
    zIndex: 1200,
    padding: 20,
  };
}

function overlayPanel(): React.CSSProperties {
  return {
    width: "min(1100px, 100%)",
    background: "rgba(2,6,23,0.95)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 16,
    position: "relative",
  };
}

function closeBtn(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.08)",
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
