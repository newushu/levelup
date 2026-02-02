"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type TemplateSummary = {
  id: string;
  name: string;
};

type PlanSummary = {
  id: string;
  template_id: string;
  class_id?: string | null;
  session_date?: string | null;
  week_label?: string | null;
  archived_at?: string | null;
  classes?: { name?: string | null } | null;
};

type VideoRow = {
  id: string;
  name: string;
  url: string;
  categories: string[];
  levels: string[];
  tags: string[];
};

type SoundEffect = {
  id: string;
  key: string;
  label: string;
  audio_url: string | null;
  category?: string | null;
};

type SectionDraft = {
  title: string;
  tools: {
    timer: { enabled: boolean; seconds: number; end_sound_key: string };
    video: { enabled: boolean; video_ids: string[]; search: string; category: string; level: string; tags: string };
    music: { enabled: boolean; music_url: string };
    skill_tracker: { enabled: boolean };
    group_skill_tracker: { enabled: boolean };
    scorekeeper: { enabled: boolean; mode: string };
    roulette_task: { enabled: boolean; wheel_id: string };
  };
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function newSection(): SectionDraft {
  return {
    title: "",
    tools: {
      timer: { enabled: false, seconds: 60, end_sound_key: "" },
      video: { enabled: false, video_ids: [], search: "", category: "", level: "", tags: "" },
      music: { enabled: false, music_url: "" },
      skill_tracker: { enabled: false },
      group_skill_tracker: { enabled: false },
      scorekeeper: { enabled: false, mode: "ctf" },
      roulette_task: { enabled: false, wheel_id: "" },
    },
  };
}

function normalizeList(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function filterVideos(videos: VideoRow[], search: string, category: string, level: string, tags: string) {
  const nameQuery = search.trim().toLowerCase();
  const categories = normalizeList(category);
  const levels = normalizeList(level);
  const tagList = normalizeList(tags);
  return videos.filter((v) => {
    const matchName = !nameQuery || v.name.toLowerCase().includes(nameQuery);
    const matchCategories = categories.every((c) => (v.categories ?? []).map((x) => String(x).toLowerCase()).includes(c));
    const matchLevels = levels.every((l) => (v.levels ?? []).map((x) => String(x).toLowerCase()).includes(l));
    const matchTags = tagList.every((t) => (v.tags ?? []).map((x) => String(x).toLowerCase()).includes(t));
    return matchName && matchCategories && matchLevels && matchTags;
  });
}

export default function LessonForgeBuilderPage() {
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([newSection()]);
  const [titles, setTitles] = useState<string[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [taskWheels, setTaskWheels] = useState<Array<{ id: string; name: string }>>([]);
  const [effects, setEffects] = useState<SoundEffect[]>([]);
  const [musicTracks, setMusicTracks] = useState<SoundEffect[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

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
      const [templatesRes, titlesRes, videosRes, fxRes, musicRes, wheelsRes] = await Promise.all([
        fetch("/api/lesson-forge/templates", { cache: "no-store" }),
        fetch("/api/lesson-forge/section-titles", { cache: "no-store" }),
        fetch("/api/videos/list", { cache: "no-store" }),
        fetch("/api/sound-effects/list?category=effect", { cache: "no-store" }),
        fetch("/api/sound-effects/list?category=music", { cache: "no-store" }),
        fetch("/api/roulette/wheels", { cache: "no-store" }),
      ]);
      const [templatesJson, titlesJson, videosJson, fxJson, musicJson, wheelsJson] = await Promise.all([
        safeJson(templatesRes),
        safeJson(titlesRes),
        safeJson(videosRes),
        safeJson(fxRes),
        safeJson(musicRes),
        safeJson(wheelsRes),
      ]);
      if (templatesJson.ok) setTemplates((templatesJson.json?.templates ?? []) as TemplateSummary[]);
      if (titlesJson.ok) setTitles((titlesJson.json?.titles ?? []).map((t: any) => String(t.name ?? "")));
      if (videosJson.ok) setVideos((videosJson.json?.videos ?? []) as VideoRow[]);
      if (fxJson.ok) setEffects((fxJson.json?.effects ?? []) as SoundEffect[]);
      if (musicJson.ok) setMusicTracks((musicJson.json?.effects ?? []) as SoundEffect[]);
      if (wheelsJson.ok) {
        const allWheels = (wheelsJson.json?.wheels ?? []) as Array<{ id: string; name: string; wheel_type: string }>;
        setTaskWheels(allWheels.filter((w) => w.wheel_type === "task").map((w) => ({ id: w.id, name: w.name })));
      }
    })();
  }, []);

  async function loadTemplate(id: string) {
    setMsg("");
    const res = await fetch(`/api/lesson-forge/template?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load template");
    const template = sj.json?.template;
    const rawSections = (sj.json?.sections ?? []) as Array<any>;
    const rawTools = (sj.json?.tools ?? []) as Array<any>;
    const toolsBySection = new Map<string, any[]>();
    rawTools.forEach((tool) => {
      const sid = String(tool.section_id ?? "");
      toolsBySection.set(sid, [...(toolsBySection.get(sid) ?? []), tool]);
    });
    setTemplateName(String(template?.name ?? ""));
    setSections(
      rawSections.map((s) => {
        const toolList = toolsBySection.get(String(s.id ?? "")) ?? [];
        const draft = newSection();
        draft.title = String(s.title ?? "");
        toolList.forEach((tool) => {
          const type = String(tool.tool_type ?? "");
          const config = tool.config ?? {};
          if (type === "timer") {
            draft.tools.timer.enabled = true;
            draft.tools.timer.seconds = Number(config.seconds ?? 60);
            draft.tools.timer.end_sound_key = String(config.end_sound_key ?? "");
          }
          if (type === "video") {
            draft.tools.video.enabled = true;
            draft.tools.video.video_ids = Array.isArray(config.video_ids) ? config.video_ids.map(String) : [];
          }
          if (type === "music") {
            draft.tools.music.enabled = true;
            draft.tools.music.music_url = String(config.music_url ?? "");
          }
          if (type === "skill_tracker") {
            draft.tools.skill_tracker.enabled = true;
          }
          if (type === "group_skill_tracker") {
            draft.tools.group_skill_tracker.enabled = true;
          }
          if (type === "scorekeeper") {
            draft.tools.scorekeeper.enabled = true;
            draft.tools.scorekeeper.mode = String(config.mode ?? "ctf");
          }
          if (type === "roulette_task") {
            draft.tools.roulette_task.enabled = true;
            draft.tools.roulette_task.wheel_id = String(config.wheel_id ?? "");
          }
        });
        return draft;
      })
    );
    await loadPlans(id);
  }

  async function loadPlans(templateId: string) {
    const res = await fetch(`/api/lesson-forge/plans?template_id=${encodeURIComponent(templateId)}&archived=1`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setPlans((sj.json?.plans ?? []) as PlanSummary[]);
  }

  async function saveTemplate() {
    if (!templateName.trim()) return setMsg("Enter a template name.");
    setSaving(true);
    setMsg("");
    const payload = {
      id: selectedId || undefined,
      name: templateName.trim(),
      sections: sections.map((s, idx) => ({
        title: s.title.trim() || `Section ${idx + 1}`,
        sort_order: idx,
        tools: [
          s.tools.timer.enabled
            ? { tool_type: "timer", sort_order: 0, config: { seconds: s.tools.timer.seconds, end_sound_key: s.tools.timer.end_sound_key } }
            : null,
          s.tools.video.enabled ? { tool_type: "video", sort_order: 1, config: { video_ids: s.tools.video.video_ids } } : null,
          s.tools.music.enabled ? { tool_type: "music", sort_order: 2, config: { music_url: s.tools.music.music_url } } : null,
          s.tools.skill_tracker.enabled ? { tool_type: "skill_tracker", sort_order: 3, config: {} } : null,
          s.tools.group_skill_tracker.enabled ? { tool_type: "group_skill_tracker", sort_order: 4, config: {} } : null,
          s.tools.scorekeeper.enabled ? { tool_type: "scorekeeper", sort_order: 5, config: { mode: s.tools.scorekeeper.mode } } : null,
          s.tools.roulette_task.enabled
            ? { tool_type: "roulette_task", sort_order: 6, config: { wheel_id: s.tools.roulette_task.wheel_id } }
            : null,
        ].filter(Boolean),
      })),
    };
    const res = await fetch("/api/lesson-forge/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save template");
    const saved = sj.json?.template;
    setSelectedId(String(saved?.id ?? ""));
    await refreshTemplates();
    setMsg("Saved.");
  }

  async function refreshTemplates() {
    const res = await fetch("/api/lesson-forge/templates", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setTemplates((sj.json?.templates ?? []) as TemplateSummary[]);
  }

  async function deleteTemplate() {
    if (!selectedId) return;
    if (!window.confirm("Delete this LessonForge template?")) return;
    const res = await fetch("/api/lesson-forge/template", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete template");
    setSelectedId("");
    setTemplateName("");
    setSections([newSection()]);
    await refreshTemplates();
  }

  function setSection(idx: number, next: SectionDraft) {
    setSections((prev) => prev.map((s, i) => (i === idx ? next : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, newSection()]);
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <AuthGate>
      {studentBlocked ? (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>LessonForge is coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
        </div>
      ) : (
      <main style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>LessonForge Builder</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Build class templates with timers, videos, and game tools.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/tools/lesson-forge" style={linkBtn()}>
              Open Runner →
            </Link>
            <Link href="/tools" style={ghostBtn()}>
              Back to Tools
            </Link>
          </div>
        </div>

        {msg ? <div style={notice()}>{msg}</div> : null}

        <section style={card()}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={label()}>
              Existing templates
              <select
                value={selectedId}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedId(next);
                  if (next) {
                    loadTemplate(next);
                  } else {
                    setTemplateName("");
                    setSections([newSection()]);
                    setPlans([]);
                  }
                }}
                style={input()}
              >
                <option value="">New template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={label()}>
              Template name
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} style={input()} />
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btn()} onClick={saveTemplate} disabled={saving}>
                {saving ? "Saving..." : "Save Template"}
              </button>
              {selectedId ? (
                <button style={ghostBtn()} onClick={deleteTemplate}>
                  Delete Template
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>Sections</div>
            <button style={ghostBtn()} onClick={addSection}>Add Section</button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {sections.map((section, idx) => {
              const draft = section;
              const filteredVideos = filterVideos(videos, draft.tools.video.search, draft.tools.video.category, draft.tools.video.level, draft.tools.video.tags);
              return (
                <div key={`section-${idx}`} style={panel()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <div style={{ fontWeight: 1000 }}>Section {idx + 1}</div>
                    <button style={ghostBtn()} onClick={() => removeSection(idx)}>Remove</button>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={label()}>
                      Title
                      <input
                        value={draft.title}
                        onChange={(e) => setSection(idx, { ...draft, title: e.target.value })}
                        style={input()}
                      />
                    </label>
                    <label style={label()}>
                      Pick a saved title
                      <select
                        value=""
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next) setSection(idx, { ...draft, title: next });
                        }}
                        style={input()}
                      >
                        <option value="">Choose</option>
                        {titles.map((t) => (
                          <option key={`${idx}-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Tools</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        style={toolToggle(draft.tools.timer.enabled)}
                        onClick={() => setSection(idx, { ...draft, tools: { ...draft.tools, timer: { ...draft.tools.timer, enabled: !draft.tools.timer.enabled } } })}
                      >
                        Timer
                      </button>
                      <button
                        style={toolToggle(draft.tools.video.enabled)}
                        onClick={() => setSection(idx, { ...draft, tools: { ...draft.tools, video: { ...draft.tools.video, enabled: !draft.tools.video.enabled } } })}
                      >
                        Video
                      </button>
                      <button
                        style={toolToggle(draft.tools.music.enabled)}
                        onClick={() => setSection(idx, { ...draft, tools: { ...draft.tools, music: { ...draft.tools.music, enabled: !draft.tools.music.enabled } } })}
                      >
                        Music
                      </button>
                      <button
                        style={toolToggle(draft.tools.skill_tracker.enabled)}
                        onClick={() =>
                          setSection(idx, { ...draft, tools: { ...draft.tools, skill_tracker: { enabled: !draft.tools.skill_tracker.enabled } } })
                        }
                      >
                        Skill Tracker
                      </button>
                      <button
                        style={toolToggle(draft.tools.group_skill_tracker.enabled)}
                        onClick={() =>
                          setSection(idx, { ...draft, tools: { ...draft.tools, group_skill_tracker: { enabled: !draft.tools.group_skill_tracker.enabled } } })
                        }
                      >
                        Group Skill Tracker
                      </button>
                      <button
                        style={toolToggle(draft.tools.scorekeeper.enabled)}
                        onClick={() =>
                          setSection(idx, { ...draft, tools: { ...draft.tools, scorekeeper: { ...draft.tools.scorekeeper, enabled: !draft.tools.scorekeeper.enabled } } })
                        }
                      >
                        Scorekeeper
                      </button>
                      <button
                        style={toolToggle(draft.tools.roulette_task.enabled)}
                        onClick={() =>
                          setSection(idx, {
                            ...draft,
                            tools: { ...draft.tools, roulette_task: { ...draft.tools.roulette_task, enabled: !draft.tools.roulette_task.enabled } },
                          })
                        }
                      >
                        Task Wheel
                      </button>
                    </div>
                  </div>

                  {draft.tools.timer.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Timer settings</div>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                        <label style={label()}>
                          Seconds
                          <input
                            type="number"
                            min={5}
                            value={draft.tools.timer.seconds}
                            onChange={(e) =>
                              setSection(idx, {
                                ...draft,
                                tools: { ...draft.tools, timer: { ...draft.tools.timer, seconds: Number(e.target.value || 0) } },
                              })
                            }
                            style={input()}
                          />
                        </label>
                        <label style={label()}>
                          End sound
                          <select
                            value={draft.tools.timer.end_sound_key}
                            onChange={(e) =>
                              setSection(idx, {
                                ...draft,
                                tools: { ...draft.tools, timer: { ...draft.tools.timer, end_sound_key: e.target.value } },
                              })
                            }
                            style={input()}
                          >
                            <option value="">No sound</option>
                            {effects.map((fx) => (
                              <option key={fx.id} value={fx.key}>
                                {fx.label || fx.key}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {draft.tools.roulette_task.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Task Wheel</div>
                      <label style={label()}>
                        Wheel
                        <select
                          value={draft.tools.roulette_task.wheel_id}
                          onChange={(e) =>
                            setSection(idx, {
                              ...draft,
                              tools: { ...draft.tools, roulette_task: { enabled: true, wheel_id: e.target.value } },
                            })
                          }
                          style={input()}
                        >
                          <option value="">Select task wheel</option>
                          {taskWheels.map((wheel) => (
                            <option key={`${idx}-${wheel.id}`} value={wheel.id}>
                              {wheel.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {draft.tools.video.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Video picker</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                          <label style={label()}>
                            Search name
                            <input
                              value={draft.tools.video.search}
                              onChange={(e) =>
                                setSection(idx, { ...draft, tools: { ...draft.tools, video: { ...draft.tools.video, search: e.target.value } } })
                              }
                              style={input()}
                            />
                          </label>
                          <label style={label()}>
                            Categories (comma)
                            <input
                              value={draft.tools.video.category}
                              onChange={(e) =>
                                setSection(idx, { ...draft, tools: { ...draft.tools, video: { ...draft.tools.video, category: e.target.value } } })
                              }
                              style={input()}
                            />
                          </label>
                          <label style={label()}>
                            Levels (comma)
                            <input
                              value={draft.tools.video.level}
                              onChange={(e) =>
                                setSection(idx, { ...draft, tools: { ...draft.tools, video: { ...draft.tools.video, level: e.target.value } } })
                              }
                              style={input()}
                            />
                          </label>
                          <label style={label()}>
                            Tags (comma)
                            <input
                              value={draft.tools.video.tags}
                              onChange={(e) =>
                                setSection(idx, { ...draft, tools: { ...draft.tools, video: { ...draft.tools.video, tags: e.target.value } } })
                              }
                              style={input()}
                            />
                          </label>
                        </div>
                        <div style={videoGrid()}>
                          {filteredVideos.map((video) => {
                            const checked = draft.tools.video.video_ids.includes(video.id);
                            return (
                              <label key={video.id} style={videoCard(checked)}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...draft.tools.video.video_ids, video.id]
                                      : draft.tools.video.video_ids.filter((id) => id !== video.id);
                                    setSection(idx, { ...draft, tools: { ...draft.tools, video: { ...draft.tools.video, video_ids: next } } });
                                  }}
                                />
                                <div>
                                  <div style={{ fontWeight: 900 }}>{video.name}</div>
                                  <div style={{ fontSize: 11, opacity: 0.7 }}>{video.url}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {draft.tools.music.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Music track</div>
                      <select
                        value={draft.tools.music.music_url}
                        onChange={(e) => setSection(idx, { ...draft, tools: { ...draft.tools, music: { enabled: true, music_url: e.target.value } } })}
                        style={input()}
                      >
                        <option value="">Select music</option>
                        {musicTracks.map((track) => (
                          <option key={track.id} value={track.audio_url ?? ""}>
                            {track.label || track.key}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {draft.tools.scorekeeper.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Scorekeeper mode</div>
                      <select
                        value={draft.tools.scorekeeper.mode}
                        onChange={(e) =>
                          setSection(idx, { ...draft, tools: { ...draft.tools, scorekeeper: { ...draft.tools.scorekeeper, mode: e.target.value } } })
                        }
                        style={input()}
                      >
                        <option value="ctf">CTF</option>
                        <option value="crack-a-bat" disabled>
                          Crack a Bat (coming soon)
                        </option>
                        <option value="fishy-fishy" disabled>
                          Fishy Fishy Cross My Ocean (coming soon)
                        </option>
                      </select>
                    </div>
                  ) : null}

                  {draft.tools.skill_tracker.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Skill Tracker</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Opens the Skill Tracker in a new tab during class.</div>
                    </div>
                  ) : null}

                  {draft.tools.group_skill_tracker.enabled ? (
                    <div style={toolPanel()}>
                      <div style={{ fontWeight: 900 }}>Group Skill Tracker</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Creates trackers for all selected students with a single skill selection.
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {selectedId ? (
          <section style={card()}>
            <div style={{ fontWeight: 1000 }}>Saved Lesson Plans</div>
            {!plans.length ? (
              <div style={{ opacity: 0.7, fontSize: 12 }}>No plans yet for this template.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {plans.map((plan) => (
                  <div key={plan.id} style={planRow()}>
                    <div style={{ fontWeight: 900 }}>{plan.week_label || "Lesson Plan"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {plan.session_date ? `Class date: ${plan.session_date}` : "No class date"}
                      {plan.classes?.name ? ` • ${plan.classes.name}` : ""}
                      {plan.archived_at ? " • archived" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
      )}
    </AuthGate>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 12,
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.18)",
    display: "grid",
    gap: 10,
  };
}

function toolPanel(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 10,
  };
}

function label(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, display: "grid", gap: 6 };
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
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(59,130,246,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
  };
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
  };
}

function notice(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 12px",
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.12)",
    fontSize: 12,
    fontWeight: 900,
  };
}

function toolToggle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.8)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function videoGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function videoCard(active: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.2)",
    display: "grid",
    gap: 6,
    cursor: "pointer",
  };
}

function planRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    display: "grid",
    gap: 4,
  };
}
