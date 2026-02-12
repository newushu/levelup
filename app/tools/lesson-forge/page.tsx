"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";

type TemplateSummary = {
  id: string;
  name: string;
};

type PlanSummary = {
  id: string;
  template_id: string;
  class_id?: string | null;
  session_start_date?: string | null;
  session_end_date?: string | null;
  session_date?: string | null;
  week_index?: number | null;
  week_label?: string | null;
  archived_at?: string | null;
  classes?: { name?: string | null } | null;
};

type SectionRow = {
  id: string;
  title: string;
  sort_order: number;
};

type ToolRow = {
  id: string;
  section_id: string;
  tool_type: string;
  config: any;
  sort_order: number;
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
  volume?: number | null;
};

type SkillRow = {
  id: string;
  name: string;
  category?: string | null;
  active?: boolean | null;
  archived_at?: string | null;
};

type RosterRow = {
  student?: { id?: string | null; name?: string | null } | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function toEmbed(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("youtube.com/embed/")) return trimmed;
  const match = trimmed.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const id = match?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : trimmed;
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function SectionTimer({
  seconds,
  endSoundKey,
  effects,
}: {
  seconds: number;
  endSoundKey: string;
  effects: SoundEffect[];
}) {
  const [duration, setDuration] = useState(Math.max(1, Math.floor(seconds || 60)));
  const [remaining, setRemaining] = useState(Math.max(1, Math.floor(seconds || 60)));
  const [running, setRunning] = useState(false);
  const endRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const next = Math.max(1, Math.floor(seconds || 60));
    setDuration(next);
    setRemaining(next);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (event.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setRunning((prev) => !prev);
        return;
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        setRunning(false);
        setRemaining(duration);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration]);

  useEffect(() => {
    if (!running) return;
    if (remaining > 0) return;
    setRunning(false);
    playEndSound();
  }, [remaining, running]);

  function playEndSound() {
    const effect = effects.find((e) => e.key === endSoundKey);
    const url = effect?.audio_url || "";
    if (!url) return;
    if (!endRef.current || endRef.current.src !== url) {
      endRef.current = new Audio(url);
    }
    const volume = Math.min(1, Math.max(0, Number(effect?.volume ?? 1)));
    endRef.current.volume = volume;
    endRef.current.loop = false;
    endRef.current.play().catch(() => {});
  }

  return (
    <div style={toolBox()}>
      <div style={{ fontWeight: 900 }}>Timer</div>
      <div style={timerDisplay()}>{formatSeconds(remaining)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btn()} onClick={() => { setRemaining(duration); setRunning(true); }}>Start</button>
        <button style={ghostBtn()} onClick={() => setRunning((prev) => !prev)}>{running ? "Pause" : "Resume"}</button>
        <button style={ghostBtn()} onClick={() => { setRunning(false); setRemaining(duration); }}>Reset</button>
      </div>
    </div>
  );
}

function MusicPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play() {
    if (!url) return;
    if (!audioRef.current || audioRef.current.src !== url) {
      audioRef.current = new Audio(url);
    }
    audioRef.current.loop = true;
    audioRef.current.volume = 1;
    audioRef.current.play().catch(() => {});
  }

  function stop() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  return (
    <div style={toolBox()}>
      <div style={{ fontWeight: 900 }}>Music</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{url ? "Selected track ready." : "No music selected."}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn()} onClick={play} disabled={!url}>Play</button>
        <button style={ghostBtn()} onClick={stop} disabled={!url}>Stop</button>
      </div>
    </div>
  );
}

function toolSummaryLabel(tool: ToolRow, videoMap: Map<string, VideoRow>) {
  const type = String(tool.tool_type || "");
  if (type === "timer") {
    const seconds = Math.max(1, Math.floor(Number(tool.config?.seconds ?? 60)));
    return `Timer • ${formatSeconds(seconds)}`;
  }
  if (type === "video") {
    const ids = Array.isArray(tool.config?.video_ids) ? tool.config.video_ids : [];
    if (ids.length === 1) {
      const vid = videoMap.get(String(ids[0]));
      return `Video • ${vid?.name || "1 clip"}`;
    }
    return `Video • ${ids.length || 0} clips`;
  }
  if (type === "music") {
    return "Music • Track";
  }
  if (type === "skill_tracker") {
    return "Skill Tracker";
  }
  if (type === "group_skill_tracker") {
    return "Group Skill Tracker";
  }
  if (type === "scorekeeper") {
    return "Scorekeeper";
  }
  if (type === "roulette_task") {
    return "Task Wheel";
  }
  return "Tool";
}

export default function LessonForgeRunnerPage() {
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [planEntries, setPlanEntries] = useState<Record<string, string>>({});
  const [planEditMode, setPlanEditMode] = useState(false);
  const [planSessionDate, setPlanSessionDate] = useState("");
  const [currentPlanId, setCurrentPlanId] = useState("");
  const [planStatus, setPlanStatus] = useState("");
  const [pastPlans, setPastPlans] = useState<PlanSummary[]>([]);
  const [copyPlanId, setCopyPlanId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [effects, setEffects] = useState<SoundEffect[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState("");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [groupOverlayOpen, setGroupOverlayOpen] = useState(false);
  const [groupSkillSearch, setGroupSkillSearch] = useState("");
  const [groupSkillId, setGroupSkillId] = useState("");
  const [groupReps, setGroupReps] = useState(10);
  const [groupRoster, setGroupRoster] = useState<RosterRow[]>([]);
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupMsg, setGroupMsg] = useState("");

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
      const [templatesRes, videosRes, effectsRes, classesRes, skillsRes] = await Promise.all([
        fetch("/api/lesson-forge/templates", { cache: "no-store" }),
        fetch("/api/videos/list", { cache: "no-store" }),
        fetch("/api/sound-effects/list?category=effect", { cache: "no-store" }),
        fetch("/api/classes/list", { cache: "no-store" }),
        fetch("/api/tracker-skills/list", { cache: "no-store" }),
      ]);
      const [templatesJson, videosJson, effectsJson, classesJson, skillsJson] = await Promise.all([
        safeJson(templatesRes),
        safeJson(videosRes),
        safeJson(effectsRes),
        safeJson(classesRes),
        safeJson(skillsRes),
      ]);
      if (templatesJson.ok) setTemplates((templatesJson.json?.templates ?? []) as TemplateSummary[]);
      if (videosJson.ok) setVideos((videosJson.json?.videos ?? []) as VideoRow[]);
      if (effectsJson.ok) setEffects((effectsJson.json?.effects ?? []) as SoundEffect[]);
      if (classesJson.ok) setClasses((classesJson.json?.classes ?? []) as Array<{ id: string; name: string }>);
      if (skillsJson.ok) {
        const list = (skillsJson.json?.skills ?? []) as SkillRow[];
        setSkills(list.filter((s) => !s.archived_at));
      }
    })();
  }, []);

  useEffect(() => {
    if (!planSessionDate) setPlanSessionDate(todayISO());
  }, [planSessionDate]);

  useEffect(() => {
    if (!selectedTemplateId || !classId || !planSessionDate) return;
    loadCurrentPlan(selectedTemplateId, classId, planSessionDate);
  }, [selectedTemplateId, classId, planSessionDate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }
      if (event.code === "KeyQ") {
        event.preventDefault();
        setOverlayOpen(false);
      }
      if (event.code === "KeyE") {
        event.preventDefault();
        if (sections.length) setOverlayOpen(true);
      }
      if (event.code === "KeyD") {
        event.preventDefault();
        if (!sections.length) return;
        setActiveSectionIndex((prev) => {
          const next = Math.min(sections.length - 1, prev + 1);
          return next;
        });
        setOverlayOpen(true);
      }
      if (event.code === "KeyA") {
        event.preventDefault();
        if (!sections.length) return;
        setActiveSectionIndex((prev) => {
          const next = Math.max(0, prev - 1);
          return next;
        });
        setOverlayOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections.length]);

  async function loadTemplate(id: string) {
    const res = await fetch(`/api/lesson-forge/template?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const template = sj.json?.template;
    setTemplateName(String(template?.name ?? ""));
    setSelectedTemplateId(id);
    setPlanEntries({});
    setPlanSessionDate((prev) => prev || todayISO());
    setCurrentPlanId("");
    setPlanStatus("");
    const sectionRows = (sj.json?.sections ?? []) as SectionRow[];
    const toolRows = (sj.json?.tools ?? []) as ToolRow[];
    setSections(sectionRows.sort((a, b) => Number(a.sort_order) - Number(b.sort_order)));
    setTools(toolRows);
    setActiveSectionIndex(0);
    setOverlayOpen(false);
    await loadPastPlans(id);
  }

  async function loadPastPlans(templateId: string) {
    const res = await fetch(`/api/lesson-forge/plans?template_id=${encodeURIComponent(templateId)}&archived=1`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setPastPlans((sj.json?.plans ?? []) as PlanSummary[]);
  }

  async function loadCurrentPlan(templateId: string, classId: string, sessionDate: string) {
    if (!templateId || !classId || !sessionDate) return;
    const qs = new URLSearchParams({
      template_id: templateId,
      class_id: classId,
      session_date: sessionDate,
    });
    const res = await fetch(`/api/lesson-forge/plans?${qs.toString()}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const list = (sj.json?.plans ?? []) as PlanSummary[];
    if (list.length) {
      const planId = String(list[0]?.id ?? "");
      if (planId) {
        setCurrentPlanId(planId);
        await loadPlanEntries(planId, { keepClass: true, keepDate: true });
        setPlanStatus("Loaded saved plan.");
        return;
      }
    }
    setCurrentPlanId("");
    setPlanEntries({});
    setPlanStatus("No saved plan yet.");
  }

  async function loadPlanEntries(planId: string, opts?: { keepClass?: boolean; keepDate?: boolean }) {
    const res = await fetch(`/api/lesson-forge/plan?id=${encodeURIComponent(planId)}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const plan = sj.json?.plan as PlanSummary;
    if (!opts?.keepDate) setPlanSessionDate(String(plan?.session_date ?? ""));
    if (plan?.class_id && !opts?.keepClass) setClassId(String(plan.class_id));
    const entries: Record<string, string> = {};
    (sj.json?.sections ?? []).forEach((row: any) => {
      entries[String(row.section_order ?? row.section_title ?? "")] = String(row.entry ?? "");
    });
    setPlanEntries(entries);
  }

  const filteredSkills = useMemo(() => {
    const query = groupSkillSearch.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((s) => String(s.name || "").toLowerCase().includes(query));
  }, [skills, groupSkillSearch]);

  async function openGroupSkillOverlay() {
    setGroupMsg("");
    setGroupOverlayOpen(true);
    if (!classId) {
      setGroupMsg("Pick a class before creating a group tracker.");
      return;
    }
    try {
      const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGroupMsg(data?.error || "Failed to load class sessions.");
        return;
      }
      const match = (data.sessions ?? []).find((s: any) => String(s.class_id ?? "") === classId);
      const instanceId = String(match?.instance_id ?? "");
      if (!instanceId) {
        setGroupMsg("No active class session found for today.");
        return;
      }
      const rosterRes = await fetch("/api/classroom/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      const rosterJson = await rosterRes.json().catch(() => ({}));
      if (!rosterRes.ok) {
        setGroupMsg(rosterJson?.error || "Failed to load class roster.");
        return;
      }
      const rosterRows = (rosterJson?.roster ?? []) as RosterRow[];
      const ids = rosterRows
        .map((row) => String(row?.student?.id ?? ""))
        .filter(Boolean);
      setGroupRoster(rosterRows);
      setGroupSelectedIds(ids);
    } catch (err: any) {
      setGroupMsg(err?.message || "Failed to load roster.");
    }
  }

  function toggleGroupStudent(id: string) {
    setGroupSelectedIds((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  }

  function clearGroupSelection() {
    setGroupSelectedIds([]);
  }

  function selectAllGroup() {
    const ids = groupRoster.map((row) => String(row?.student?.id ?? "")).filter(Boolean);
    setGroupSelectedIds(Array.from(new Set(ids)));
  }

  async function startGroupTracker() {
    if (!groupSkillId) return setGroupMsg("Select a skill first.");
    if (!groupSelectedIds.length) return setGroupMsg("Select at least one student.");
    setGroupBusy(true);
    setGroupMsg("");
    try {
      const res = await fetch("/api/skill-tracker/group/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_ids: groupSelectedIds,
          skill_id: groupSkillId,
          repetitions_target: groupReps,
          created_source: "skill_pulse",
        }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) {
        setGroupMsg(sj.json?.error || "Failed to create group tracker.");
      } else {
        setGroupMsg(`Created group tracker for ${groupSelectedIds.length} students.`);
        setGroupOverlayOpen(false);
        window.open("/skill-pulse", "_blank");
      }
    } catch (err: any) {
      setGroupMsg(err?.message || "Failed to create group tracker.");
    } finally {
      setGroupBusy(false);
    }
  }

  async function savePlan() {
    if (!selectedTemplateId) return;
    if (!classId) return setPlanStatus("Pick a class before saving.");
    if (!planSessionDate) return setPlanStatus("Pick a class date before saving.");
    const label = `Class Plan • ${planSessionDate}`;
    const weekIndex = 1;
    const sectionsPayload = sections.map((s, idx) => ({
      section_order: idx,
      section_title: s.title,
      entry: String(planEntries[String(idx)] ?? ""),
    }));
    const res = await fetch("/api/lesson-forge/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: currentPlanId || undefined,
        template_id: selectedTemplateId,
        class_id: classId || null,
        session_start_date: planSessionDate,
        session_end_date: planSessionDate,
        session_date: planSessionDate,
        week_index: weekIndex,
        week_label: label,
        sections: sectionsPayload,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const planId = String(sj.json?.plan?.id ?? "");
    if (planId) setCurrentPlanId(planId);
    await loadPastPlans(selectedTemplateId);
    setCopyPlanId("");
    setPlanStatus("Plan saved.");
  }

  const activeSection = sections[activeSectionIndex];
  const sectionTools = useMemo(() => {
    if (!activeSection) return [];
    return tools
      .filter((t) => t.section_id === activeSection.id)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  }, [tools, activeSection]);

  useEffect(() => {
    if (!activeSection) return;
    const timerTool = sectionTools.find((t) => t.tool_type === "timer");
    const timerSeconds = Math.max(0, Math.floor(Number(timerTool?.config?.seconds ?? 0) || 0));
    fetch("/api/coach/display-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_key: "lesson_forge",
        tool_payload: {
          display_url: "/tools/lesson-forge?display=1",
          section_title: activeSection.title,
          timer_seconds: timerSeconds || null,
        },
      }),
    }).catch(() => {});
  }, [activeSection?.id, activeSection?.title, sectionTools]);

  const videoMap = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);

  useEffect(() => {
    if (!activeSection) return;
    const videoTool = sectionTools.find((t) => t.tool_type === "video");
    const ids = Array.isArray(videoTool?.config?.video_ids) ? videoTool?.config?.video_ids : [];
    const first = ids?.[0] ?? "";
    setActiveVideoId(first);
  }, [activeSection?.id, sectionTools]);

  return (
    <AuthGate>
      {studentBlocked ? (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>LessonForge is coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
        </div>
      ) : (
      <main style={{ display: "grid", gap: 16 }}>
        <section style={topBar()}>
          <div style={miniMenu()}>
            <a href="/tools" style={miniLink()}>Tools</a>
            <a href="/tools/lesson-forge/builder" style={miniLink()}>Builder</a>
            <button
              style={miniBtn(planEditMode)}
              onClick={() => setPlanEditMode((prev) => !prev)}
              disabled={!selectedTemplateId}
            >
              {planEditMode ? "Notes On" : "Notes"}
            </button>
            <button style={miniBtn()} onClick={savePlan} disabled={!selectedTemplateId || !classId || !planSessionDate}>
              Save Plan
            </button>
          </div>
          <div style={templateCenter()}>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                const next = e.target.value;
                if (!next) {
                  setSelectedTemplateId("");
                  setTemplateName("");
                  setSections([]);
                  setTools([]);
                  setOverlayOpen(false);
                  setPastPlans([]);
                  setPlanEntries({});
                  setPlanSessionDate("");
                  setCurrentPlanId("");
                  setPlanStatus("");
                  setCopyPlanId("");
                  return;
                }
                loadTemplate(next);
              }}
              style={templateSelect()}
            >
              <option value="">Select a template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>A = back • D = next • E = open • Q = close</div>
            {planStatus ? <div style={{ fontSize: 11, opacity: 0.7 }}>{planStatus}</div> : null}
          </div>
          <div style={classPick()}>
            <label style={{ fontSize: 11, opacity: 0.75 }}>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} style={miniSelect()}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 11, opacity: 0.75 }}>Class date</label>
            <input
              type="date"
              value={planSessionDate}
              onChange={(e) => setPlanSessionDate(e.target.value)}
              style={miniInput()}
            />
            <label style={{ fontSize: 11, opacity: 0.75 }}>Copy from past</label>
            <select
              value={copyPlanId}
              onChange={async (e) => {
                const next = e.target.value;
                setCopyPlanId(next);
                if (!next) return;
                await loadPlanEntries(next, { keepClass: true, keepDate: true });
                setCurrentPlanId("");
                setPlanStatus("Copied past plan. Save to create a new plan.");
              }}
              style={miniSelect()}
            >
              <option value="">Select past plan</option>
              {pastPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.week_label || plan.session_date || "Past plan"}
                </option>
              ))}
            </select>
          </div>
        </section>

        {selectedTemplateId ? (
          <section style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>{templateName}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {classId ? `Class: ${classes.find((c) => c.id === classId)?.name ?? "Class"}` : "Class: not set"}
              </div>
            </div>
            <div style={sectionGrid()}>
              {sections.map((section, idx) => {
                const active = idx === activeSectionIndex;
                const entry = planEntries[String(idx)] ?? "";
                const sectionTools = tools
                  .filter((t) => t.section_id === section.id)
                  .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
                return (
                  <div
                    key={section.id}
                    style={sectionCard(active, idx)}
                    onClick={() => {
                      setActiveSectionIndex(idx);
                      setOverlayOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveSectionIndex(idx);
                        setOverlayOpen(true);
                      }
                    }}
                  >
                    <div style={sectionIndexBadge(idx)}>{idx + 1}</div>
                    <div style={{ fontWeight: 1000, fontSize: 22, letterSpacing: 0.2 }}>Section {idx + 1}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, opacity: 0.9 }}>{section.title}</div>
                    {sectionTools.length ? (
                      <div style={toolSummaryGrid()}>
                        {sectionTools.map((tool) => (
                          <div key={tool.id} style={toolChip()}>
                            {toolSummaryLabel(tool, videoMap)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.55 }}>No tools selected</div>
                    )}
                    {planEditMode ? (
                      <textarea
                        value={entry}
                        onChange={(e) => setPlanEntries((prev) => ({ ...prev, [String(idx)]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        style={planEntryInput()}
                        placeholder="Write notes here..."
                      />
                    ) : entry ? (
                      <div style={planEntryBox()}>{entry}</div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.55 }}>No plan notes yet</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {overlayOpen && activeSection ? (
          <div style={overlay()} onClick={() => setOverlayOpen(false)}>
            <div style={overlayPanel()} onClick={(e) => e.stopPropagation()}>
              <div style={flowHeader()}>
                <div style={flowRow()}>
                  {sections.map((section, idx) => (
                    <div key={section.id} style={flowPill(idx === activeSectionIndex)}>
                      {idx + 1}. {section.title}
                    </div>
                  ))}
                </div>
                <div style={overlayTitle()}>{activeSection.title}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                A = previous • D = next • Q = close
              </div>
              </div>

              <div style={toolGrid(sectionTools.length)}>
                {sectionTools.map((tool) => {
                  if (tool.tool_type === "video") {
                    const ids = Array.isArray(tool.config?.video_ids) ? tool.config.video_ids : [];
                    const activeVideo = videoMap.get(String(activeVideoId || ids[0] || "")) ?? null;
                    return (
                      <div key={tool.id} style={toolBox()}>
                        <div style={{ fontWeight: 900 }}>Video Library</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {ids.map((vid: string) => {
                              const v = videoMap.get(String(vid));
                              if (!v) return null;
                              const active = String(vid) === String(activeVideo?.id);
                              return (
                                <button
                                  key={vid}
                                  style={pillBtn(active)}
                                  onClick={() => setActiveVideoId(String(vid))}
                                >
                                  {v.name}
                                </button>
                              );
                            })}
                          </div>
                          {activeVideo ? (
                            <div style={{ position: "relative", paddingTop: "56.25%" }}>
                              <iframe
                                src={toEmbed(activeVideo.url)}
                                title={activeVideo.name}
                                allow="autoplay; fullscreen"
                                allowFullScreen
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 12, border: "none" }}
                              />
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, opacity: 0.7 }}>No video selected.</div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (tool.tool_type === "timer") {
                    return (
                      <SectionTimer
                        key={tool.id}
                        seconds={Number(tool.config?.seconds ?? 60)}
                        endSoundKey={String(tool.config?.end_sound_key ?? "")}
                        effects={effects}
                      />
                    );
                  }
                  if (tool.tool_type === "music") {
                    return <MusicPlayer key={tool.id} url={String(tool.config?.music_url ?? "")} />;
                  }
                  if (tool.tool_type === "skill_tracker") {
                    return (
                      <div key={tool.id} style={toolBox()}>
                        <div style={{ fontWeight: 900 }}>Skill Tracker</div>
                        <button style={btn()} onClick={() => window.open("/skill-tracker", "_blank")}>
                          Open Skill Tracker
                        </button>
                      </div>
                    );
                  }
                  if (tool.tool_type === "group_skill_tracker") {
                    return (
                      <div key={tool.id} style={toolBox()}>
                        <div style={{ fontWeight: 900 }}>Group Skill Tracker</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          Select a skill and students to create trackers for the whole class.
                        </div>
                        <button style={btn()} onClick={openGroupSkillOverlay}>
                          Select Group Tracker
                        </button>
                      </div>
                    );
                  }
                  if (tool.tool_type === "scorekeeper") {
                    return (
                      <div key={tool.id} style={toolBox()}>
                        <div style={{ fontWeight: 900 }}>Scorekeeper</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>CTF mode</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          <button style={btn()} onClick={() => window.open("/tools/scorekeeper", "_blank")}>
                            Open Scorekeeper
                          </button>
                          <iframe
                            title="CTF Scorekeeper"
                            src="/tools/scorekeeper"
                            style={{ width: "100%", height: 360, border: "none", borderRadius: 12 }}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (tool.tool_type === "roulette_task") {
                    const wheelId = String(tool.config?.wheel_id ?? "");
                    const wheelUrl = wheelId ? `/spin?wheelId=${encodeURIComponent(wheelId)}` : "/spin";
                    return (
                      <div key={tool.id} style={toolBox()}>
                        <div style={{ fontWeight: 900 }}>Task Wheel</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          Spin a task wheel (no student required).
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          <button style={btn()} onClick={() => window.open(wheelUrl, "_blank")}>
                            Open Task Wheel
                          </button>
                          <iframe
                            title="Task Wheel"
                            src={wheelUrl}
                            style={{ width: "100%", height: 360, border: "none", borderRadius: 12 }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        ) : null}

        {groupOverlayOpen ? (
          <div style={overlay()} onClick={() => setGroupOverlayOpen(false)}>
            <div style={overlayPanel()} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 1000, fontSize: 22 }}>Group Skill Tracker</div>
                <button style={ghostBtn()} onClick={() => setGroupOverlayOpen(false)}>Close</button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {classId ? `Class: ${classes.find((c) => c.id === classId)?.name ?? "Class"}` : "No class selected."}
              </div>
              {groupMsg ? <div style={{ fontSize: 12, opacity: 0.8 }}>{groupMsg}</div> : null}

              <div style={groupGrid()}>
                <div style={{ display: "grid", gap: 10 }}>
                  <label style={label()}>
                    Skill
                    <input
                      value={groupSkillSearch}
                      onChange={(e) => setGroupSkillSearch(e.target.value)}
                      placeholder="Search skill..."
                      style={input()}
                    />
                    <select value={groupSkillId} onChange={(e) => setGroupSkillId(e.target.value)} style={input()}>
                      <option value="">Select a skill</option>
                      {filteredSkills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={label()}>
                    Reps target
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={groupReps}
                      onChange={(e) => setGroupReps(Math.max(1, Math.min(20, Number(e.target.value || 1))))}
                      style={input()}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={ghostBtn()} onClick={selectAllGroup}>Select all</button>
                    <button style={ghostBtn()} onClick={clearGroupSelection}>Clear</button>
                    <button style={btn()} onClick={startGroupTracker} disabled={groupBusy}>
                      {groupBusy ? "Starting..." : "Start tracker"}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {groupSelectedIds.length} selected
                  </div>
                </div>

                <div style={groupStudentList()}>
                  {groupRoster.map((row) => {
                    const id = String(row?.student?.id ?? "");
                    if (!id) return null;
                    const label = String(row?.student?.name ?? "Student");
                    const selected = groupSelectedIds.includes(id);
                    return (
                      <button
                        key={id}
                        style={groupStudentCard(selected)}
                        onClick={() => toggleGroupStudent(id)}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                  {!groupRoster.length ? <div style={{ opacity: 0.7 }}>No students found.</div> : null}
                </div>
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
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 12,
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

function sectionGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 20,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  };
}

function sectionCard(active: boolean, idx: number): React.CSSProperties {
  const colors = [
    "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(2,6,23,0.7))",
    "linear-gradient(135deg, rgba(34,197,94,0.32), rgba(2,6,23,0.7))",
    "linear-gradient(135deg, rgba(250,204,21,0.32), rgba(2,6,23,0.7))",
    "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(2,6,23,0.7))",
    "linear-gradient(135deg, rgba(14,116,144,0.3), rgba(2,6,23,0.7))",
    "linear-gradient(135deg, rgba(148,163,184,0.28), rgba(2,6,23,0.7))",
  ];
  return {
    borderRadius: 18,
    padding: 24,
    border: active ? "2px solid rgba(250,204,21,0.75)" : "1px solid rgba(255,255,255,0.12)",
    background: colors[idx % colors.length],
    display: "grid",
    gap: 8,
    cursor: "pointer",
    textAlign: "center",
    boxShadow: active ? "0 18px 40px rgba(250,204,21,0.18)" : "0 12px 30px rgba(0,0,0,0.35)",
    transform: active ? "translateY(-2px)" : "none",
    minHeight: 260,
    justifyItems: "center",
    alignContent: "start",
    color: "rgba(255,255,255,0.92)",
  };
}

function overlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    backdropFilter: "blur(6px)",
    zIndex: 80,
    display: "grid",
    placeItems: "center",
    padding: 18,
  };
}

function overlayPanel(): React.CSSProperties {
  return {
    width: "min(1400px, 98vw)",
    maxHeight: "94vh",
    overflow: "auto",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(8,12,20,0.95)",
    padding: 16,
    display: "grid",
    gap: 14,
  };
}

function toolGrid(count: number): React.CSSProperties {
  if (count <= 1) {
    return { display: "grid", gap: 12 };
  }
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  };
}

function toolBox(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 10,
  };
}

function timerDisplay(): React.CSSProperties {
  return {
    fontSize: 32,
    fontWeight: 1000,
    letterSpacing: 1,
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
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function pillBtn(active: boolean): React.CSSProperties {
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

function topBar(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr minmax(240px, 360px) 1fr",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  };
}

function miniMenu(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
  };
}

function miniLink(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontSize: 11,
    fontWeight: 900,
  };
}

function miniBtn(active = false): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(250,204,21,0.7)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function templateCenter(): React.CSSProperties {
  return {
    display: "grid",
    justifyItems: "center",
    gap: 4,
  };
}

function templateSelect(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontWeight: 900,
    width: "100%",
    textAlign: "center",
  };
}

function classPick(): React.CSSProperties {
  return {
    display: "grid",
    justifyItems: "end",
    gap: 6,
  };
}

function miniSelect(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
  };
}

function miniInput(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
  };
}

function sectionIndexBadge(idx: number): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(255,255,255,0.2)",
    fontSize: 14,
    fontWeight: 1000,
  };
}

function planEntryBox(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.35)",
    fontSize: 12,
    opacity: 0.9,
    minHeight: 46,
    width: "100%",
    whiteSpace: "pre-wrap",
  };
}

function planEntryInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(0,0,0,0.45)",
    color: "white",
    fontSize: 12,
    minHeight: 70,
    width: "100%",
    outline: "none",
    resize: "vertical",
  };
}

function toolSummaryGrid(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
  };
}

function toolChip(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function flowHeader(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    justifyItems: "center",
    textAlign: "center",
  };
}

function flowRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  };
}

function flowPill(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: active ? "1px solid rgba(250,204,21,0.9)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(250,204,21,0.25)" : "rgba(255,255,255,0.06)",
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

function overlayTitle(): React.CSSProperties {
  return {
    fontSize: 52,
    fontWeight: 1100,
    letterSpacing: 0.6,
  };
}

function groupGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "minmax(260px, 360px) minmax(280px, 1fr)",
    alignItems: "start",
  };
}

function groupStudentList(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    maxHeight: 420,
    overflowY: "auto",
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
  };
}

function groupStudentCard(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: active ? "1px solid rgba(34,197,94,0.8)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
  };
}
