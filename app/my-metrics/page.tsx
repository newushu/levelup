"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AuthGate from "../../components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

type TrackerRow = {
  id?: string;
  student_id?: string;
  skill_id: string;
  skill_name: string;
  skill_category?: string | null;
  attempts?: number;
  successes?: number;
  rate?: number;
  lifetime_attempts: number;
  lifetime_successes: number;
  lifetime_rate: number;
  last30_attempts: number;
  last30_successes: number;
  last30_rate: number;
};

type StatRow = {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
};

type PerfRecord = {
  stat_id: string;
  value: number;
  recorded_at: string;
};

type PerfRank = {
  rank: number;
  total: number;
  value: number | null;
};

type HistoryLog = {
  id: string;
  successes: number;
  attempts: number;
  target: number;
  created_at: string;
  rate: number;
  is_battle?: boolean;
  vs_name?: string | null;
  skill_name?: string;
  skill_id?: string;
  skill_category?: string | null;
};

type PerfLeaderboardRow = {
  rank: number;
  student_id: string;
  student_name: string;
  value: number;
  recorded_at: string;
};

type PerfLeaderboard = {
  stat_id: string;
  stat_name: string;
  unit?: string | null;
  higher_is_better?: boolean;
  rows: PerfLeaderboardRow[];
};

type TaoluSummary = {
  forms: Array<{ id: string; name: string }>;
  session_history: Array<{
    session_id: string;
    taolu_form_id: string;
    created_at: string;
    deductions: Array<{ id: string; occurred_at: string; voided?: boolean | null; code_id?: string | null; section_number?: number | null }>;
  }>;
  preps_session_history: Array<{ session_id: string; taolu_form_id: string; created_at: string; remediation_points: number }>;
  codes?: Array<{ id: string; code_number?: string | null; name?: string | null; description?: string | null }>;
  form_section_code_totals?: Record<string, Record<string, Record<string, number>>>;
  form_section_code_notes?: Record<string, Record<string, Record<string, string[]>>>;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function MyMetricsPage() {
  return (
    <AuthGate>
      <MyMetricsInner />
    </AuthGate>
  );
}

function MyMetricsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inStudentWorkspace = pathname.startsWith("/student/");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [trackers, setTrackers] = useState<TrackerRow[]>([]);
  const [taoluSummary, setTaoluSummary] = useState<TaoluSummary | null>(null);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [perfRecords, setPerfRecords] = useState<PerfRecord[]>([]);
  const [perfRanks, setPerfRanks] = useState<Record<string, PerfRank>>({});
  const [tab, setTab] = useState("Skill Pulse");
  const [msg, setMsg] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [skillCategory, setSkillCategory] = useState("all");
  const [skillLast30, setSkillLast30] = useState(false);
  const [taoluQuery, setTaoluQuery] = useState("");
  const [perfQuery, setPerfQuery] = useState("");
  const [perfFilter, setPerfFilter] = useState("all");
  const [now, setNow] = useState(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);
  const [selectedSkillName, setSelectedSkillName] = useState("");
  const [skillLogs, setSkillLogs] = useState<HistoryLog[]>([]);
  const [skillTrend, setSkillTrend] = useState<HistoryLog[]>([]);
  const [skillAnchor, setSkillAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [taoluSectionDetail, setTaoluSectionDetail] = useState<{ formId: string; section: string } | null>(null);
  const [leaderboard, setLeaderboard] = useState<PerfLeaderboard | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [avatarCatalog, setAvatarCatalog] = useState<Array<{ id: string; storage_path: string | null; enabled?: boolean | null }>>([]);
  const [avatarId, setAvatarId] = useState("");
  const [avatarBg, setAvatarBg] = useState("rgba(15,23,42,0.6)");
  const [avatarEffectKey, setAvatarEffectKey] = useState<string | null>(null);
  const [cornerBorderKey, setCornerBorderKey] = useState<string | null>(null);
  const [effectCatalog, setEffectCatalog] = useState<Array<{ key: string; config?: any; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null }>>([]);
  const [cornerBorders, setCornerBorders] = useState<Array<{ key: string; image_url?: string | null; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null; offset_x?: number | null; offset_y?: number | null; offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null; enabled?: boolean | null }>>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/students/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load student");
      const list = (sj.json?.students ?? []) as StudentRow[];
      let selectedId = "";
      try {
        selectedId = localStorage.getItem("active_student_id") || "";
      } catch {}
      if (!selectedId) return setMsg("Please select student.");
      const selected = list.find((s) => String(s.id) === String(selectedId));
      if (!selected?.id) return setMsg("Please select student.");
      setStudent(selected);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [avatarsRes, effectsRes, bordersRes] = await Promise.all([
        fetch("/api/avatars/list", { cache: "no-store" }),
        fetch("/api/avatar-effects/list", { cache: "no-store" }),
        fetch("/api/corner-borders", { cache: "no-store" }),
      ]);
      const avatarsJson = await avatarsRes.json().catch(() => ({}));
      if (avatarsRes.ok) setAvatarCatalog((avatarsJson?.avatars ?? []) as any[]);
      const effectsJson = await effectsRes.json().catch(() => ({}));
      if (effectsRes.ok) setEffectCatalog((effectsJson?.effects ?? []) as any[]);
      const bordersJson = await bordersRes.json().catch(() => ({}));
      if (bordersRes.ok) setCornerBorders((bordersJson?.borders ?? []) as any[]);
    })();
  }, []);

  useEffect(() => {
    const nextTab = searchParams?.get("tab");
    if (!nextTab) return;
    const decoded = decodeURIComponent(nextTab);
    const allowed = ["Skill Pulse", "Taolu Tracker", "Performance Lab", "Coming Soon", "Coming Soon 2"];
    if (allowed.includes(decoded)) setTab(decoded);
  }, [searchParams]);

  useEffect(() => {
    setNow(Date.now());
  }, [perfFilter, perfQuery, perfRecords]);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const [trackerRes, taoluRes, statsRes, perfRes, rankRes] = await Promise.all([
        fetch(`/api/skill-tracker/list?student_id=${student.id}`, { cache: "no-store" }),
        fetch(`/api/taolu/student-summary?student_id=${student.id}`, { cache: "no-store" }),
        fetch("/api/performance-lab/stats", { cache: "no-store" }),
        fetch(`/api/performance-lab/records?student_id=${student.id}`, { cache: "no-store" }),
        fetch("/api/performance-lab/ranks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: student.id }),
        }),
      ]);

      const tJson = await safeJson(trackerRes);
      if (tJson.ok) {
        let rows = (tJson.json?.trackers ?? []) as TrackerRow[];
        rows = rows.filter((t) => String(t.student_id ?? "") === String(student.id));
        if (!rows.length) {
          const fallbackRes = await safeJson(await fetch("/api/skill-tracker/list", { cache: "no-store" }));
          if (fallbackRes.ok) {
            const fallbackRows = (fallbackRes.json?.trackers ?? []) as TrackerRow[];
            rows = fallbackRows.filter((t) => String(t.student_id ?? "") === String(student.id));
          }
        }
        if (!rows.length) {
          const historyRes = await safeJson(
            await fetch("/api/skill-tracker/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ student_id: student.id, limit: 50 }),
            })
          );
          if (historyRes.ok) {
            const history = (historyRes.json?.history ?? []) as HistoryLog[];
            const map = new Map<string, TrackerRow>();
            const now = Date.now();
            const last30 = now - 30 * 24 * 60 * 60 * 1000;
            history.forEach((h) => {
              const skillId = String(h.skill_id ?? h.id ?? "");
              if (!skillId) return;
              const prev = map.get(skillId);
              const createdAt = Date.parse(h.created_at);
              const attempts = Number(h.attempts ?? 0);
              const successes = Number(h.successes ?? 0);
              const addLast30 = createdAt >= last30 ? attempts : 0;
              const addLast30Success = createdAt >= last30 ? successes : 0;
              if (!prev) {
                map.set(skillId, {
                  id: `history-${skillId}`,
                  skill_id: skillId,
                  skill_name: h.skill_name ?? "Skill",
                  skill_category: h.skill_category ?? "",
                  lifetime_attempts: attempts,
                  lifetime_successes: successes,
                  lifetime_rate: attempts ? successes / attempts : 0,
                  last30_attempts: addLast30,
                  last30_successes: addLast30Success,
                  last30_rate: addLast30 ? addLast30Success / addLast30 : 0,
                });
                return;
              }
              const nextAttempts = prev.lifetime_attempts + attempts;
              const nextSuccess = prev.lifetime_successes + successes;
              const nextLast30Attempts = prev.last30_attempts + addLast30;
              const nextLast30Success = prev.last30_successes + addLast30Success;
              map.set(skillId, {
                ...prev,
                lifetime_attempts: nextAttempts,
                lifetime_successes: nextSuccess,
                lifetime_rate: nextAttempts ? nextSuccess / nextAttempts : 0,
                last30_attempts: nextLast30Attempts,
                last30_successes: nextLast30Success,
                last30_rate: nextLast30Attempts ? nextLast30Success / nextLast30Attempts : 0,
              });
            });
            rows = Array.from(map.values());
          }
        }
        setTrackers(rows);
      }

      const taoluJson = await safeJson(taoluRes);
      if (taoluJson.ok) setTaoluSummary((taoluJson.json ?? null) as TaoluSummary | null);

      const statsJson = await safeJson(statsRes);
      if (statsJson.ok) setStats((statsJson.json?.stats ?? []) as StatRow[]);

      const perfJson = await safeJson(perfRes);
      if (perfJson.ok) setPerfRecords((perfJson.json?.records ?? []) as PerfRecord[]);

      const rankJson = await safeJson(rankRes);
      if (rankJson.ok) setPerfRanks((rankJson.json?.ranks ?? {}) as Record<string, PerfRank>);
    })();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const res = await fetch("/api/avatar/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      const s = sj.json?.settings ?? null;
      setAvatarId(String(s?.avatar_id ?? "").trim());
      const bg = String(s?.bg_color ?? "").trim();
      setAvatarBg(bg || "rgba(15,23,42,0.6)");
      const effectKey = String(s?.particle_style ?? "").trim();
      setAvatarEffectKey(effectKey || null);
      const borderKey = String(s?.corner_border_key ?? "").trim();
      setCornerBorderKey(borderKey || null);
    })();
  }, [student?.id]);

  const pointsDisplay = Number(student?.points_balance ?? student?.points_total ?? 0);
  const levelDisplay = Number(student?.level ?? 1);
  const avatarSrc = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    if (avatarId) {
      const row = avatarCatalog.find((a) => String(a.id) === String(avatarId));
      const mapped = String(row?.storage_path ?? "").trim();
      if (mapped) return `${base}/storage/v1/object/public/avatars/${mapped}`;
    }
    const path = String(student?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    return `${base}/storage/v1/object/public/avatars/${path}`;
  }, [avatarId, avatarCatalog, student?.avatar_storage_path]);
  const selectedEffect = useMemo(() => {
    if (!avatarEffectKey) return null;
    return effectCatalog.find((e) => String(e.key) === String(avatarEffectKey)) ?? { key: avatarEffectKey };
  }, [avatarEffectKey, effectCatalog]);
  const selectedBorder = useMemo(() => {
    if (!cornerBorderKey) return null;
    return cornerBorders.find((b) => String(b.key) === String(cornerBorderKey) && b.enabled !== false) ?? null;
  }, [cornerBorderKey, cornerBorders]);
  const avatarZoomPct = Math.max(50, Math.min(200, Number(student?.avatar_zoom_pct ?? 100)));
  const displayAvatarZoom = Math.min(100, avatarZoomPct);
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";

  const skillsAgg = useMemo(() => {
    const map = new Map<string, TrackerRow>();
    trackers.forEach((t) => {
      const key = String(t.skill_id);
      const prev = map.get(key);
      const baseAttempts = Number(t.lifetime_attempts ?? t.attempts ?? 0);
      const baseSuccesses = Number(t.lifetime_successes ?? t.successes ?? 0);
      const baseLast30Attempts = Number(t.last30_attempts ?? 0);
      const baseLast30Successes = Number(t.last30_successes ?? 0);
      if (!prev) {
        map.set(key, {
          ...t,
          id: t.id,
          lifetime_attempts: baseAttempts,
          lifetime_successes: baseSuccesses,
          last30_attempts: baseLast30Attempts,
          last30_successes: baseLast30Successes,
        });
        return;
      }
      const useCurrent = baseAttempts > prev.lifetime_attempts;
      const nextAttempts = useCurrent ? baseAttempts : prev.lifetime_attempts;
      const nextSuccesses = useCurrent ? baseSuccesses : prev.lifetime_successes;
      const nextLast30Attempts = useCurrent ? baseLast30Attempts : prev.last30_attempts;
      const nextLast30Successes = useCurrent ? baseLast30Successes : prev.last30_successes;
      const pickId = useCurrent ? t.id : prev.id;
      map.set(key, {
        ...prev,
        id: pickId,
        lifetime_attempts: nextAttempts,
        lifetime_successes: nextSuccesses,
        last30_attempts: nextLast30Attempts,
        last30_successes: nextLast30Successes,
      });
    });
    return Array.from(map.values()).map((row) => {
      const lifetime_rate = row.lifetime_attempts ? row.lifetime_successes / row.lifetime_attempts : 0;
      const last30_rate = row.last30_attempts ? row.last30_successes / row.last30_attempts : 0;
      return { ...row, lifetime_rate, last30_rate };
    });
  }, [trackers]);

  const totalSkillsTracked = skillsAgg.filter((s) => (s.lifetime_attempts ?? 0) > 0 || (s.last30_attempts ?? 0) > 0).length;
  const mostTracked = useMemo(() => {
    const tracked = skillsAgg.filter((s) => (s.lifetime_attempts ?? 0) > 0 || (s.last30_attempts ?? 0) > 0);
    return tracked.reduce((max, row) => (row.lifetime_attempts > (max?.lifetime_attempts ?? 0) ? row : max), null as TrackerRow | null);
  }, [skillsAgg]);
  const lowestSuccessSkill = useMemo(() => {
    const candidates = skillsAgg.filter((s) => (s.lifetime_attempts ?? 0) >= 8);
    return candidates.reduce((min, row) => {
      if (!min) return row;
      if (row.lifetime_rate < min.lifetime_rate) return row;
      if (row.lifetime_rate === min.lifetime_rate && row.lifetime_attempts > min.lifetime_attempts) return row;
      return min;
    }, null as TrackerRow | null);
  }, [skillsAgg]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    skillsAgg.forEach((s) => {
      const c = String(s.skill_category ?? "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [skillsAgg]);

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    let list = skillsAgg.filter((s) => (s.lifetime_attempts ?? 0) > 0 || (s.last30_attempts ?? 0) > 0);
    list = list.filter((s) => {
      if (skillCategory !== "all" && String(s.skill_category ?? "") !== skillCategory) return false;
      if (q && !String(s.skill_name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      const aScore = skillLast30 ? a.last30_attempts : a.lifetime_attempts;
      const bScore = skillLast30 ? b.last30_attempts : b.lifetime_attempts;
      if (aScore !== bScore) return bScore - aScore;
      return String(a.skill_name).localeCompare(String(b.skill_name));
    });
    return list;
  }, [skillsAgg, skillCategory, skillQuery, skillLast30]);

  useEffect(() => {
    if (!selectedSkillId && !selectedSkillKey) {
      setSkillLogs([]);
      setSkillTrend([]);
      return;
    }
    (async () => {
      let logs: HistoryLog[] = [];
      let trend: HistoryLog[] = [];
      if (selectedSkillId && !String(selectedSkillId).startsWith("history-")) {
        const [logsRes, trendRes] = await Promise.all([
          fetch(`/api/skill-tracker/logs?tracker_id=${encodeURIComponent(selectedSkillId)}&limit=5`, { cache: "no-store" }),
          fetch(`/api/skill-tracker/logs?tracker_id=${encodeURIComponent(selectedSkillId)}&limit=60`, { cache: "no-store" }),
        ]);
        const logsJson = await safeJson(logsRes);
        const trendJson = await safeJson(trendRes);
        if (logsJson.ok) logs = (logsJson.json?.logs ?? []) as HistoryLog[];
        if (trendJson.ok) trend = (trendJson.json?.logs ?? []) as HistoryLog[];
      }
      if ((!logs.length || !trend.length) && student?.id && selectedSkillKey) {
        const historyRes = await safeJson(
          await fetch("/api/skill-tracker/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: student.id, limit: 80 }),
          })
        );
        if (historyRes.ok) {
          const history = (historyRes.json?.history ?? []) as HistoryLog[];
          const filtered = history.filter((h) => String(h.skill_id ?? "") === String(selectedSkillKey));
          if (!logs.length) logs = filtered.slice(0, 5);
          if (!trend.length) trend = filtered;
        }
      }
      if (logs.length) setSkillLogs(logs);
      else setSkillLogs([]);
      const ordered = [...trend].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      setSkillTrend(ordered);
    })();
  }, [selectedSkillId, selectedSkillKey, student?.id]);

  async function openLeaderboard(statId: string) {
    const res = await fetch(`/api/performance-lab/leaderboard?stat_id=${encodeURIComponent(statId)}&limit=10`, {
      cache: "no-store",
    });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setLeaderboard((sj.json?.leaderboard ?? null) as PerfLeaderboard | null);
    setLeaderboardOpen(true);
  }

  const taoluFormsById = useMemo(() => {
    const map = new Map<string, string>();
    (taoluSummary?.forms ?? []).forEach((f) => map.set(String(f.id), String(f.name ?? "Form")));
    return map;
  }, [taoluSummary]);

  const perfByStat = useMemo(() => {
    const map = new Map<string, PerfRecord>();
    perfRecords.forEach((r) => {
      map.set(String(r.stat_id), r);
    });
    return map;
  }, [perfRecords]);

  const perfCards = useMemo(() => {
    const list = stats.map((s) => {
      const record = perfByStat.get(String(s.id));
      const rank = perfRanks[String(s.id)];
      return {
        id: s.id,
        name: s.name,
        category: s.category ?? "",
        unit: s.unit ?? "",
        value: record?.value ?? null,
        recorded_at: record?.recorded_at ?? "",
        rank: rank?.rank ?? null,
        total: rank?.total ?? null,
      };
    });
    const q = perfQuery.trim().toLowerCase();
    let filtered = list.filter((s) => (q ? s.name.toLowerCase().includes(q) : true));
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    if (perfFilter === "completed") {
      filtered = filtered.filter((s) => Boolean(s.recorded_at));
    } else if (perfFilter === "incomplete") {
      filtered = filtered.filter((s) => !s.recorded_at);
    } else if (perfFilter === "completed7") {
      filtered = filtered.filter((s) => s.recorded_at && Date.parse(s.recorded_at) >= weekAgo);
    }
    filtered.sort((a, b) => {
      const aComplete = Boolean(a.recorded_at);
      const bComplete = Boolean(b.recorded_at);
      if (aComplete !== bComplete) return aComplete ? -1 : 1;
      const aRank = a.rank ?? Number.POSITIVE_INFINITY;
      const bRank = b.rank ?? Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
      const aTime = a.recorded_at ? Date.parse(a.recorded_at) : 0;
      const bTime = b.recorded_at ? Date.parse(b.recorded_at) : 0;
      return bTime - aTime;
    });
    return filtered;
  }, [stats, perfByStat, perfRanks, perfQuery, perfFilter, now]);

  const taoluSessions = useMemo(() => {
    const list = (taoluSummary?.session_history ?? []).map((s) => ({
      id: s.session_id,
      formId: String(s.taolu_form_id ?? ""),
      created_at: s.created_at,
      deductions: (s.deductions ?? []).filter((d) => !d.voided),
    }));
    const q = taoluQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => (taoluFormsById.get(s.formId) ?? "").toLowerCase().includes(q));
  }, [taoluSummary, taoluFormsById, taoluQuery]);

  const taoluFormCards = useMemo(() => {
    const forms = (taoluSummary?.forms ?? []) as Array<{ id: string; name: string; sections_count?: number }>;
    const codes = (taoluSummary?.codes ?? []) as Array<{ id: string; code_number?: string | null; name?: string | null; description?: string | null }>;
    const codeMap = new Map<string, { label: string; codeNumber?: string; movement?: string; description?: string }>();
    codes.forEach((c) => {
      const codeNumber = String(c.code_number ?? "");
      const movement = String(c.name ?? "");
      const label = codeNumber || movement || "Code";
      codeMap.set(String(c.id), { label, codeNumber, movement, description: String(c.description ?? "") });
    });

    const sessionsByForm = new Map<string, Array<{ id: string; created_at: string; deductions: number }>>();
    (taoluSummary?.session_history ?? []).forEach((s) => {
      const formId = String(s.taolu_form_id ?? "");
      if (!formId) return;
      const list = sessionsByForm.get(formId) ?? [];
      list.push({
        id: String(s.session_id ?? ""),
        created_at: s.created_at,
        deductions: (s.deductions ?? []).filter((d) => !d.voided).length,
      });
      sessionsByForm.set(formId, list);
    });

    const formSectionTotals = (taoluSummary?.form_section_code_totals ?? {}) as Record<string, Record<string, Record<string, number>>>;
    const formSectionNotes = (taoluSummary?.form_section_code_notes ?? {}) as Record<string, Record<string, Record<string, string[]>>>;
    const sectionCodeDates: Record<string, Record<string, Record<string, string[]>>> = {};
    (taoluSummary?.session_history ?? []).forEach((s: any) => {
      const formId = String(s.taolu_form_id ?? "");
      if (!formId) return;
      (s.deductions ?? []).forEach((d: any) => {
        if (d.voided) return;
        const codeId = String(d.code_id ?? "");
        if (!codeId) return;
        const sectionKey = String(d.section_number ?? "unknown");
        if (!sectionCodeDates[formId]) sectionCodeDates[formId] = {};
        if (!sectionCodeDates[formId][sectionKey]) sectionCodeDates[formId][sectionKey] = {};
        if (!sectionCodeDates[formId][sectionKey][codeId]) sectionCodeDates[formId][sectionKey][codeId] = [];
        const date = new Date(d.occurred_at);
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const yy = String(date.getFullYear());
        sectionCodeDates[formId][sectionKey][codeId].push(`${mm}/${dd}/${yy}`);
      });
    });
    const cards = forms
      .map((f) => {
        const formId = String(f.id ?? "");
        const sectionMap = formSectionTotals[formId] ?? {};
        const sectionTotals: Array<{ section: string; count: number; topCodes: Array<{ label: string; count: number; codeNumber?: string }> }> =
          Object.keys(sectionMap).map((sectionKey) => {
            const codes = sectionMap[sectionKey] ?? {};
            const entries = Object.entries(codes).map(([codeId, count]) => ({
              codeId,
              count: Number(count ?? 0),
            }));
            const total = entries.reduce((sum, e) => sum + e.count, 0);
            const topCodes = entries
              .sort((a, b) => b.count - a.count)
              .slice(0, 2)
              .map((e) => ({
                codeId: e.codeId,
                label: codeMap.get(e.codeId)?.label ?? "Code",
                codeNumber: codeMap.get(e.codeId)?.codeNumber ?? "",
                count: e.count,
              }));
            return { section: sectionKey, count: total, topCodes };
          });
        const totalDeductions = sectionTotals.reduce((sum, s) => sum + s.count, 0);
        const sessions = sessionsByForm.get(formId) ?? [];
        const sortedSessions = sessions.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return {
          id: formId,
          name: String(f.name ?? "Form"),
          sections: sectionTotals.sort((a, b) => b.count - a.count),
          totalDeductions,
          sessions: sortedSessions,
          sectionsCount: Number(f.sections_count ?? 0),
          sectionCodeDates: sectionCodeDates[formId] ?? {},
          sectionCodeNotes: formSectionNotes[formId] ?? {},
          sectionCodeTotals: formSectionTotals[formId] ?? {},
        };
      })
      .filter((c) => c.sessions.length > 0 || c.totalDeductions > 0);
    cards.sort((a, b) => {
      if (a.sessions.length !== b.sessions.length) return b.sessions.length - a.sessions.length;
      if (a.totalDeductions !== b.totalDeductions) return b.totalDeductions - a.totalDeductions;
      return a.name.localeCompare(b.name);
    });
    return cards;
  }, [taoluSummary]);

  const trendLine = useMemo(() => {
    if (!skillTrend.length) return { path: "", points: [] as Array<{ x: number; y: number; label: string; stat: string; pct: number }> };
    const width = 700;
    const height = 260;
    const padding = { top: 20, right: 56, bottom: 36, left: 36 };
    const xs = skillTrend.map((_, idx) => idx);
    const ys = skillTrend.map((d) => {
      const raw = Number(d.rate ?? 0);
      const pct = raw > 1 ? raw : raw * 100;
      return Math.max(0, Math.min(100, Math.round(pct)));
    });
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = 0;
    const maxY = 100;
    const mapX = (x: number) => {
      if (maxX === minX) return padding.left;
      return padding.left + ((x - minX) / (maxX - minX)) * (width - padding.left - padding.right);
    };
    const mapY = (y: number) => {
      return padding.top + (1 - (y - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
    };
    const points = skillTrend.map((d, i) => {
      const date = new Date(d.created_at);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yy = String(date.getFullYear()).slice(-2);
      const label = `${mm}/${dd}/${yy}`;
      const pct = ys[i];
      return {
        x: mapX(i),
        y: mapY(pct),
        label,
        stat: `${d.successes}/${d.attempts}`,
        pct,
      };
    });
    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    return { path, points };
  }, [skillTrend]);

  const formatRatePct = (raw: number | null | undefined) => {
    const value = Number(raw ?? 0);
    const pct = value > 1 ? value : value * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };

  const mostTrackedAttempts = Number(mostTracked?.lifetime_attempts ?? 0);
  const mostTrackedSuccesses = Number(mostTracked?.lifetime_successes ?? 0);
  const mostTrackedFails = Math.max(0, mostTrackedAttempts - mostTrackedSuccesses);
  const mostTrackedRatePct = mostTracked ? Math.max(0, Math.round(Number(mostTracked.lifetime_rate ?? 0) * 100)) : 0;
  const mostTrackedTier =
    mostTrackedRatePct >= 75 ? "good" : mostTrackedRatePct >= 50 ? "warn" : "bad";
  const mostTrackedCritical = mostTrackedRatePct <= 20 && mostTrackedAttempts > 0;

  return (
    <main className={`logs-page ${inStudentWorkspace ? "logs-page--workspace" : ""}`}>
      <style>{pageStyles()}</style>
      {!inStudentWorkspace ? <style>{studentNavStyles()}</style> : null}
      {!inStudentWorkspace ? <StudentNavPanel /> : null}
      {!inStudentWorkspace ? <button className="back-btn" onClick={() => window.history.back()}>Back</button> : null}
      <header className="logs-header">
        <div className="logs-header__left">
          <div className="logs-title">{student?.name ?? "Student"}</div>
          <div className="logs-subtitle">Level {levelDisplay} • {pointsDisplay.toLocaleString()} pts</div>
          <div className="logs-avatar">
            <AvatarRender
              size={160}
              bg={avatarBg}
              avatarSrc={avatarSrc}
              avatarZoomPct={displayAvatarZoom}
              effect={selectedEffect as any}
              border={selectedBorder as any}
              showImageBorder={false}
              style={{ borderRadius: 20 }}
              contextKey="student_logs"
              fallback={<div className="logs-avatar__fallback">{initials}</div>}
            />
          </div>
        </div>
        <div className="logs-header__right">
          <div className="always-card always-card--pulse">
            <div className="always-title">Skill Pulse • Lowest Success Rate (≥ 8 attempts)</div>
            <div className="always-value">{lowestSuccessSkill?.skill_name ?? "-"}</div>
            <div className="always-meta">
              {lowestSuccessSkill
                ? `${Math.round((lowestSuccessSkill.lifetime_rate ?? 0) * 100)}% • ${lowestSuccessSkill.lifetime_attempts ?? 0} attempts`
                : "No eligible skills yet"}
            </div>
          </div>
        </div>
      </header>

      {msg ? <div className="notice">{msg}</div> : null}

      <div className="tab-strip">
        {["Skill Pulse", "Taolu Tracker", "Performance Lab", "Coming Soon", "Coming Soon 2"].map((label) => (
          <button key={label} className={`tab ${tab === label ? "tab--active" : ""}`} onClick={() => setTab(label)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "Skill Pulse" ? (
        <section className="tab-panel">
          <div className="panel-row">
            <div className="panel-card">
              <div className="panel-title">Skill Pulse Summary</div>
              <div className="panel-grid">
                <div className="panel-metric">
                  <div className="panel-label">Skills Tracked</div>
                  <div className="panel-value">{totalSkillsTracked}</div>
                </div>
                <div className="panel-metric">
                  <div className="panel-label">Most Tracked Skill</div>
                  <div className="panel-value">{mostTracked?.skill_name ?? "-"}</div>
                </div>
              </div>
            </div>
            <div className="panel-card">
              <div className="panel-title">Most Tracked Skill</div>
              <div className="panel-skill-name">{mostTracked?.skill_name ?? "-"}</div>
              <div className="panel-grid">
                <div className={`panel-metric panel-metric--grade-${mostTrackedTier}`}>
                  <div className="panel-label">Attempts</div>
                  <div className="panel-value">{mostTrackedAttempts}</div>
                </div>
                <div className={`panel-metric panel-metric--grade-${mostTrackedTier}`}>
                  <div className="panel-label">Fails</div>
                  <div className="panel-value">{mostTrackedFails}</div>
                </div>
                <div className={`panel-metric panel-metric--grade-${mostTrackedTier} ${mostTrackedCritical ? "panel-metric--critical" : ""}`}>
                  <div className="panel-label">Success Rate</div>
                  <div className="panel-value">{mostTrackedRatePct}%</div>
                  {mostTrackedCritical ? <div className="panel-metric__alert">!</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title">Search Skills</div>
            <div className="panel-filters">
              <input
                className="panel-input"
                placeholder="Search skill name..."
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
              />
              <select className="panel-select" value={skillCategory} onChange={(e) => setSkillCategory(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className="panel-toggle">
                <input type="checkbox" checked={skillLast30} onChange={(e) => setSkillLast30(e.target.checked)} />
                Last 30 days
              </label>
            </div>
            <div className="skill-grid">
              {filteredSkills.map((s) => (
                <button
                  key={s.skill_id}
                  type="button"
                  className={`skill-card ${selectedSkillId === s.id ? "skill-card--active" : ""}`}
                  onClick={(event) => {
                    const trackerId = String(s.id ?? "");
                    if (!trackerId) return;
                    setSelectedSkillId(trackerId);
                    setSelectedSkillKey(String(s.skill_id ?? ""));
                    setSelectedSkillName(String(s.skill_name ?? ""));
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    if (rect) {
                      const prefersLeft = window.innerWidth - rect.right < 520;
                      const left = prefersLeft
                        ? Math.max(16, rect.left - (rect.width + 700))
                        : rect.left;
                      setSkillAnchor({
                        top: rect.top - 12,
                        left,
                        width: rect.width,
                      });
                    }
                  }}
                >
                  <div className="skill-name">{s.skill_name}</div>
                  <div className="skill-meta">{s.skill_category || "Uncategorized"}</div>
                  <div className="skill-stats">
                    <div>
                      <div className="skill-label">Attempts</div>
                      <div className="skill-value">{skillLast30 ? s.last30_attempts : s.lifetime_attempts}</div>
                    </div>
                    <div>
                      <div className="skill-label">Successes</div>
                      <div className="skill-value">{skillLast30 ? s.last30_successes : s.lifetime_successes}</div>
                    </div>
                    <div>
                      <div className="skill-label">Rate</div>
                      <div className="skill-value">{Math.round((skillLast30 ? s.last30_rate : s.lifetime_rate) * 100)}%</div>
                    </div>
                  </div>
                </button>
              ))}
              {!filteredSkills.length ? <div className="empty">No matching skills.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "Taolu Tracker" ? (
        <section className="tab-panel">
          <div className="panel-card">
            <div className="panel-title">Taolu Tracker Summary</div>
            <div className="panel-grid">
              <div className="panel-metric">
                <div className="panel-label">Sessions</div>
                <div className="panel-value">{taoluSummary?.session_history?.length ?? 0}</div>
              </div>
              <div className="panel-metric">
                <div className="panel-label">Preps Sessions</div>
                <div className="panel-value">{taoluSummary?.preps_session_history?.length ?? 0}</div>
              </div>
              <div className="panel-metric">
                <div className="panel-label">Total Deductions</div>
                <div className="panel-value">
                  {(taoluSummary?.session_history ?? []).reduce((sum, s) => sum + (s.deductions ?? []).filter((d) => !d.voided).length, 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title">Taolu Form Deductions</div>
            <input
              className="panel-input"
              placeholder="Search taolu form..."
              value={taoluQuery}
              onChange={(e) => setTaoluQuery(e.target.value)}
            />
            <div className="taolu-grid">
              {taoluFormCards
                .filter((c) => {
                  const q = taoluQuery.trim().toLowerCase();
                  if (!q) return true;
                  return c.name.toLowerCase().includes(q);
                })
                .map((card) => (
                  <div key={card.id} className="taolu-card">
                    <div className="taolu-card__title">{card.name}</div>
                    <div className="taolu-card__meta">Sessions: {card.sessions.length}</div>
                    <div className="taolu-card__total">Total deductions: {card.totalDeductions}</div>
                    <div className="taolu-card__sections">
                      {card.sections.length ? (
                        card.sections.map((s) => (
                          <button
                            key={s.section}
                            type="button"
                            className="taolu-chip taolu-chip--section"
                            onClick={() => setTaoluSectionDetail({ formId: card.id, section: s.section })}
                          >
                            <div className="taolu-chip__title">Section {s.section}: {s.count}</div>
                            <div className="taolu-chip__sub">
                              {s.topCodes.length
                                ? s.topCodes
                                    .map((c) => `${c.codeNumber || c.label}(${c.count})`)
                                    .join(", ")
                                : "No codes"}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="empty">No deductions yet.</div>
                      )}
                    </div>
                    <div className="taolu-card__sessions">
                      {card.sessions.map((s) => (
                        <div key={s.id} className="taolu-session">
                          <div className="taolu-session__date">{new Date(s.created_at).toLocaleDateString()}</div>
                          <div className="taolu-session__deductions">Deductions: {s.deductions}</div>
                        </div>
                      ))}
                      {!card.sessions.length ? <div className="empty">No sessions found.</div> : null}
                    </div>
                  </div>
                ))}
              {!taoluFormCards.length ? <div className="empty">No taolu sessions found.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "Performance Lab" ? (
        <section className="tab-panel">
          <div className="panel-card">
            <div className="panel-title">Performance Lab Stats</div>
            <div className="panel-controls">
              <input
                className="panel-input"
                placeholder="Search performance stat..."
                value={perfQuery}
                onChange={(e) => setPerfQuery(e.target.value)}
              />
              <select className="panel-select" value={perfFilter} onChange={(e) => setPerfFilter(e.target.value)}>
                <option value="all">All stats</option>
                <option value="completed">Completed</option>
                <option value="incomplete">Incomplete</option>
                <option value="completed7">Completed last 7 days</option>
              </select>
            </div>
            <div className="perf-grid">
              {perfCards.map((stat) => (
                <div
                  key={stat.id}
                  className={`perf-card ${stat.rank === 1 ? "perf-card--top1" : stat.rank && stat.rank <= 5 ? "perf-card--top5" : ""}`}
                  onClick={() => openLeaderboard(String(stat.id))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openLeaderboard(String(stat.id));
                    }
                  }}
                >
                  {stat.rank === 1 ? <div className="perf-badge perf-badge--top1">#1</div> : null}
                  {stat.rank && stat.rank <= 5 && stat.rank !== 1 ? <div className="perf-badge perf-badge--top5">Top 5</div> : null}
                  <div className="perf-name">{stat.name}</div>
                  <div className="perf-meta">{stat.category || "General"}{stat.unit ? ` • Unit: ${stat.unit}` : ""}</div>
                  <div className="perf-value">{stat.value ?? "-"}</div>
                  <div className="perf-rank">{stat.rank && stat.total ? `Rank ${stat.rank} / ${stat.total}` : "Rank -"} </div>
                </div>
              ))}
              {!perfCards.length ? <div className="empty">No metrics yet.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {leaderboardOpen && leaderboard ? (
        <div className="perf-modal">
          <div className="perf-modal__card">
            <div className="perf-modal__header">
              <div>
                <div className="perf-modal__title">{leaderboard.stat_name}</div>
                <div className="perf-modal__sub">Top 10 Rankings</div>
              </div>
              <button className="perf-modal__close" onClick={() => setLeaderboardOpen(false)}>Close</button>
            </div>
            <div className="perf-modal__list">
              {leaderboard.rows.map((row) => (
                <div
                  key={row.student_id}
                  className={`perf-modal__row ${String(row.student_id) === String(student?.id ?? "") ? "perf-modal__row--active" : ""}`}
                >
                  <div className="perf-modal__rank">{row.rank}</div>
                  <div className="perf-modal__name">{row.student_name}</div>
                  <div className="perf-modal__value">
                    {row.value}{leaderboard.unit ? ` ${leaderboard.unit}` : ""}
                  </div>
                </div>
              ))}
              {!leaderboard.rows.length ? <div className="empty">No rankings yet.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab.startsWith("Coming Soon") ? (
        <section className="tab-panel">
          <div className="panel-card">
            <div className="panel-title">Coming Soon</div>
            <div className="empty">More reports will appear here soon.</div>
          </div>
        </section>
      ) : null}

      {skillAnchor && (selectedSkillId || selectedSkillKey) ? (
        <div
          className="skill-overlay"
          onClick={() => setSkillAnchor(null)}
        >
          <div
            className="skill-overlay__card"
            style={{
              top: Math.max(16, skillAnchor.top - 320),
              left: skillAnchor.left,
              width: Math.min(980, skillAnchor.width + 700),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="skill-overlay__header">
              <div>
                <div className="skill-overlay__title">{selectedSkillName || "Skill"}</div>
                <div className="skill-overlay__sub">Last 5 logs and lifetime trend</div>
              </div>
              <button className="skill-overlay__close" onClick={() => setSkillAnchor(null)}>Close</button>
            </div>
            <div className="trend-grid">
              <div className="trend-logs">
                {(skillLogs ?? [])
                  .slice()
                  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                  .map((log) => (
                    <div key={log.id} className="trend-log">
                      <div className="trend-log__date">{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="trend-log__stat">{log.successes}/{log.attempts} • {formatRatePct(log.rate)}%</div>
                    </div>
                  ))}
                {!skillLogs.length ? <div className="empty">No recent logs.</div> : null}
              </div>
              <div className="trend-line">
                {skillTrend.length ? (
                  <svg viewBox="0 0 700 260" role="img" aria-label="Success rate trend">
                    <path className="trend-line__grid" d="M36 50 H644 M36 130 H644 M36 210 H644" />
                    <path className="trend-line__path" d={trendLine.path} />
                    {trendLine.points.map((p, idx) => (
                      <g key={`${p.x}-${p.y}`}>
                        <circle className="trend-line__dot" cx={p.x} cy={p.y} r={3} />
                        <text className="trend-line__label" x={p.x} y={p.y - 30} textAnchor="middle">
                          <tspan x={p.x} dy="0">{p.label}</tspan>
                          <tspan x={p.x} dy="18">{p.stat}</tspan>
                          <tspan x={p.x} dy="18">{p.pct}%</tspan>
                        </text>
                      </g>
                    ))}
                    <text className="trend-line__axis" x={664} y={50} textAnchor="end">100%</text>
                    <text className="trend-line__axis" x={664} y={210} textAnchor="end">0%</text>
                  </svg>
                ) : (
                  <div className="empty">No trend data yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {taoluSectionDetail ? (
        <div className="taolu-modal" onClick={() => setTaoluSectionDetail(null)}>
          <div className="taolu-modal__card" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const card = taoluFormCards.find((c) => c.id === taoluSectionDetail.formId);
              const sectionKey = taoluSectionDetail.section;
              const codeTotals = card?.sectionCodeTotals?.[sectionKey] ?? {};
              const codeNotes = card?.sectionCodeNotes?.[sectionKey] ?? {};
              const codeMap = new Map<string, { label: string; codeNumber?: string; movement?: string; description?: string }>();
              (taoluSummary?.codes ?? []).forEach((c: any) => {
                const codeNumber = String(c.code_number ?? "");
                const movement = String(c.name ?? "");
                const label = codeNumber || movement || "Code";
                codeMap.set(String(c.id), { label, codeNumber, movement, description: String(c.description ?? "") });
              });
              const codes = Object.entries(codeTotals)
                .map(([codeId, count]) => ({
                  codeId,
                  count: Number(count ?? 0),
                  label: codeMap.get(String(codeId))?.label ?? "Code",
                  movement: codeMap.get(String(codeId))?.movement ?? "",
                  description: codeMap.get(String(codeId))?.description ?? "",
                  notes: (codeNotes[String(codeId)] ?? []) as string[],
                }))
                .sort((a, b) => b.count - a.count);
              return (
                <>
                  <div className="taolu-modal__header">
                    <div>
                      <div className="taolu-modal__title">Section {sectionKey} Deductions</div>
                      <div className="taolu-modal__sub">{card?.name ?? "Form"} • {codes.length} codes</div>
                    </div>
                    <button className="taolu-modal__close" onClick={() => setTaoluSectionDetail(null)}>Close</button>
                  </div>
                  <div className="taolu-modal__codes">
                    {codes.map((c) => (
                      <div key={c.codeId} className="taolu-modal__code">
                        <div className="taolu-modal__code-title">
                          {c.label}{c.movement ? ` — ${c.movement}` : ""}
                        </div>
                        {c.description ? <div className="taolu-modal__code-desc">{c.description}</div> : null}
                        <div className="taolu-modal__code-meta">Count: {c.count}</div>
                        <div className="taolu-modal__notes">
                          <div className="taolu-modal__notes-title">Recent Coach Notes</div>
                          {c.notes.length ? (
                            c.notes.slice(-3).map((n, idx) => (
                              <div key={`${c.codeId}-${idx}`} className="taolu-modal__note">{n}</div>
                            ))
                          ) : (
                            <div className="empty">No notes yet.</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {!codes.length ? <div className="empty">No deductions found.</div> : null}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function pageStyles() {
  return `
    .logs-page {
      padding: 36px 24px 80px 276px;
      display: grid;
      gap: 20px;
      width: min(1400px, 96vw);
      margin: 0 auto;
    }

    .logs-page--workspace {
      padding-left: 16px;
    }

    .back-btn {
      justify-self: start;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
    }

    .logs-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }

    .logs-header__left {
      display: grid;
      gap: 8px;
    }

    .logs-header__right {
      display: grid;
      align-content: start;
      justify-items: end;
    }

    .logs-title {
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 1000;
    }

    .logs-subtitle {
      opacity: 0.7;
    }

    .logs-avatar {
      margin-top: 8px;
    }

    .logs-avatar__fallback {
      width: 160px;
      height: 160px;
      border-radius: 20px;
      display: grid;
      place-items: center;
      font-weight: 900;
      font-size: 30px;
      background: rgba(30,41,59,0.8);
    }


    .notice {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(239,68,68,0.3);
      background: rgba(239,68,68,0.12);
      color: white;
      font-weight: 900;
      font-size: 12px;
    }

    .tab-strip {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: flex-end;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(148,163,184,0.25);
    }

    .tab {
      padding: 10px 16px;
      border-radius: 14px 14px 0 0;
      border: 1px solid rgba(148,163,184,0.25);
      background: rgba(15,23,42,0.5);
      color: inherit;
      font-weight: 900;
      letter-spacing: 0.6px;
      cursor: pointer;
      position: relative;
      top: 2px;
    }

    .tab--active {
      background: rgba(15,23,42,0.98);
      border-bottom-color: rgba(15,23,42,0.98);
      top: 0;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.35);
    }

    .tab-panel {
      display: grid;
      gap: 18px;
    }

    .panel-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .panel-card {
      padding: 18px;
      border-radius: 20px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 12px;
    }

    .always-row {
      display: grid;
      gap: 12px;
    }

    .always-title {
      font-size: 13px;
      font-weight: 1000;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      opacity: 0.9;
      text-align: center;
    }

    .always-card {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(15,23,42,0.85);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 6px;
      position: relative;
      width: min(520px, 100%);
    }

    .always-card--pulse {
      box-shadow: 0 0 18px rgba(56,189,248,0.35);
      animation: pulseBorder 2.4s ease-in-out infinite;
    }

    .always-value {
      font-size: 18px;
      font-weight: 1000;
    }

    .always-meta {
      font-size: 12px;
      opacity: 0.7;
    }

    @keyframes pulseBorder {
      0% { box-shadow: 0 0 10px rgba(56,189,248,0.25); border-color: rgba(56,189,248,0.25); }
      50% { box-shadow: 0 0 22px rgba(56,189,248,0.5); border-color: rgba(56,189,248,0.5); }
      100% { box-shadow: 0 0 10px rgba(56,189,248,0.25); border-color: rgba(56,189,248,0.25); }
    }

    @keyframes alertPulse {
      0% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(1.16); opacity: 1; }
      100% { transform: scale(1); opacity: 0.9; }
    }

    @keyframes criticalPulse {
      0% { box-shadow: 0 0 14px rgba(239,68,68,0.38); }
      50% { box-shadow: 0 0 24px rgba(239,68,68,0.62); }
      100% { box-shadow: 0 0 14px rgba(239,68,68,0.38); }
    }

    .panel-card--trend {
      min-height: 220px;
    }

    .panel-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.8;
    }

    .panel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    .trend-header {
      display: grid;
      gap: 4px;
    }

    .trend-name {
      font-size: 18px;
      font-weight: 900;
    }

    .trend-sub {
      font-size: 12px;
      opacity: 0.7;
    }

    .trend-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2.2fr);
      gap: 14px;
      align-items: start;
    }

    .trend-logs {
      display: grid;
      gap: 8px;
    }

    .trend-log {
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 4px;
    }

    .trend-log__date {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.7;
    }

    .trend-log__stat {
      font-weight: 900;
    }

    .trend-line {
      height: 320px;
      padding: 10px;
      border-radius: 14px;
      background: rgba(2,6,23,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      align-items: center;
      justify-items: center;
    }

    .trend-line svg {
      width: 100%;
      height: 100%;
    }

    .trend-line__grid {
      stroke: rgba(148,163,184,0.18);
      stroke-width: 1;
      fill: none;
    }

    .trend-line__path {
      stroke: rgba(56,189,248,0.9);
      stroke-width: 2.5;
      fill: none;
    }

    .trend-line__dot {
      fill: rgba(56,189,248,0.9);
      stroke: rgba(2,6,23,0.8);
      stroke-width: 1.5;
    }

    .trend-line__label {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.4px;
      fill: rgba(148,163,184,0.9);
    }

    .trend-line__axis {
      font-size: 11px;
      fill: rgba(148,163,184,0.7);
    }

    .panel-metric {
      padding: 12px;
      border-radius: 14px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 6px;
      position: relative;
    }

    .panel-skill-name {
      font-size: 18px;
      font-weight: 1000;
      letter-spacing: 0.2px;
    }

    .panel-metric--grade-good {
      background: linear-gradient(145deg, rgba(22,163,74,0.28), rgba(20,83,45,0.32));
      border-color: rgba(74,222,128,0.48);
    }

    .panel-metric--grade-warn {
      background: linear-gradient(145deg, rgba(234,179,8,0.26), rgba(113,63,18,0.3));
      border-color: rgba(250,204,21,0.5);
    }

    .panel-metric--grade-bad {
      background: linear-gradient(145deg, rgba(220,38,38,0.24), rgba(127,29,29,0.3));
      border-color: rgba(248,113,113,0.52);
    }

    .panel-metric--critical {
      box-shadow: 0 0 18px rgba(239,68,68,0.5);
      animation: criticalPulse 1.2s ease-in-out infinite;
    }

    .panel-metric__alert {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 1000;
      color: #fee2e2;
      border: 1px solid rgba(254,202,202,0.75);
      background: rgba(220,38,38,0.9);
      box-shadow: 0 0 14px rgba(239,68,68,0.6);
      animation: alertPulse 1s ease-in-out infinite;
    }

    .panel-label {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.7;
    }

    .panel-value {
      font-size: 20px;
      font-weight: 1000;
    }

    .panel-filters {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .panel-controls {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .panel-input {
      flex: 1;
      min-width: 240px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(2,6,23,0.8);
      color: white;
      font-weight: 900;
      font-size: 14px;
    }

    .panel-select {
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(2,6,23,0.8);
      color: white;
      font-weight: 900;
    }

    .panel-toggle {
      display: flex;
      gap: 8px;
      align-items: center;
      font-weight: 900;
      font-size: 12px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    .skill-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .skill-card {
      padding: 14px;
      border-radius: 16px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 8px;
      text-align: left;
      cursor: pointer;
      color: inherit;
      font: inherit;
      appearance: none;
    }

    .skill-card--active {
      border-color: rgba(56,189,248,0.45);
      box-shadow: 0 0 18px rgba(56,189,248,0.25);
    }

    .skill-overlay {
      position: fixed;
      inset: 0;
      z-index: 70;
    }

    .skill-overlay__card {
      position: fixed;
      border-radius: 18px;
      background: rgba(15,23,42,0.96);
      border: 1px solid rgba(148,163,184,0.2);
      box-shadow: 0 20px 40px rgba(0,0,0,0.55);
      padding: 14px;
      display: grid;
      gap: 12px;
      max-width: 980px;
    }

    .skill-overlay__card::before {
      content: "";
      position: absolute;
      top: -8px;
      left: 30px;
      width: 16px;
      height: 16px;
      background: rgba(15,23,42,0.96);
      border-left: 1px solid rgba(148,163,184,0.2);
      border-top: 1px solid rgba(148,163,184,0.2);
      transform: rotate(45deg);
    }

    .skill-overlay__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .skill-overlay__title {
      font-size: 18px;
      font-weight: 1000;
    }

    .skill-overlay__sub {
      font-size: 12px;
      opacity: 0.7;
    }

    .skill-overlay__close {
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      cursor: pointer;
    }

    .skill-name {
      font-weight: 900;
    }

    .skill-meta {
      font-size: 12px;
      opacity: 0.7;
    }

    .skill-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .skill-label {
      font-size: 12px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .skill-value {
      font-weight: 1000;
    }

    .timeline {
      display: grid;
      gap: 10px;
    }

    .timeline-item {
      padding: 12px;
      border-radius: 14px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 4px;
    }

    .timeline-title {
      font-weight: 900;
    }

    .timeline-meta {
      font-size: 12px;
      opacity: 0.7;
    }

    .timeline-count {
      font-size: 12px;
      font-weight: 900;
    }

    .taolu-grid {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: calc((100% - 36px) / 4);
      grid-template-rows: 1fr;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 6px;
    }

    .taolu-grid > .taolu-card {
      min-width: 240px;
    }

    .taolu-card {
      padding: 14px;
      border-radius: 16px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 8px;
    }

    .taolu-card__title {
      font-weight: 1000;
      font-size: 14px;
    }

    .taolu-card__meta {
      font-size: 13px;
      opacity: 0.75;
    }

    .taolu-card__total {
      font-weight: 900;
      font-size: 12px;
    }

    .taolu-card__sections {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .taolu-chip {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.2);
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .taolu-chip--section {
      border-radius: 12px;
      padding: 6px 8px;
      display: grid;
      gap: 2px;
      position: relative;
      color: #ffffff;
    }

    .taolu-chip--section::after {
      content: "↗";
      position: absolute;
      top: 6px;
      right: 8px;
      font-size: 10px;
      opacity: 0.7;
    }

    .taolu-chip__title {
      font-size: 11px;
      color: #ffffff;
    }

    .taolu-chip__sub {
      font-size: 10px;
      opacity: 0.7;
      text-transform: none;
      letter-spacing: 0.2px;
      color: #ffffff;
    }

    .taolu-chip--section {
      cursor: pointer;
    }

    .taolu-card__sessions {
      display: grid;
      gap: 6px;
    }

    .taolu-session {
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(2,6,23,0.8);
      border: 1px solid rgba(148,163,184,0.16);
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 900;
    }

    .taolu-session__date {
      opacity: 0.8;
    }

    .taolu-session__deductions {
      opacity: 0.8;
    }

    .taolu-modal {
      position: fixed;
      inset: 0;
      background: rgba(2,6,23,0.65);
      display: grid;
      place-items: center;
      z-index: 80;
      padding: 24px;
    }

    .taolu-modal__card {
      width: min(720px, 92vw);
      max-height: 70vh;
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 20px;
      background: rgba(15,23,42,0.96);
      border: 1px solid rgba(148,163,184,0.2);
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      overflow: auto;
    }

    .taolu-modal__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .taolu-modal__title {
      font-size: 18px;
      font-weight: 1000;
    }

    .taolu-modal__sub {
      font-size: 12px;
      opacity: 0.7;
    }

    .taolu-modal__close {
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      cursor: pointer;
    }

    .taolu-modal__codes {
      display: grid;
      gap: 12px;
    }

    .taolu-modal__code {
      padding: 10px;
      border-radius: 14px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 8px;
    }

    .taolu-modal__code-title {
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .taolu-modal__code-meta {
      font-size: 12px;
      opacity: 0.8;
    }

    .taolu-modal__code-desc {
      font-size: 12px;
      opacity: 0.7;
    }

    .taolu-modal__notes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .taolu-modal__notes-title {
      width: 100%;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.8;
    }

    .taolu-modal__note {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.2);
      font-size: 11px;
      font-weight: 900;
    }

    .metrics-list {
      display: grid;
      gap: 10px;
    }

    .metrics-item {
      padding: 12px;
      border-radius: 14px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 4px;
    }

    .metrics-name {
      font-weight: 900;
    }

    .metrics-meta {
      font-size: 12px;
      opacity: 0.7;
    }

    .perf-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(160px, 1fr));
      gap: 12px;
    }

    .perf-card {
      padding: 14px;
      border-radius: 16px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 6px;
      text-align: center;
      position: relative;
      justify-items: center;
      cursor: pointer;
    }

    .perf-card--top5 {
      border-color: rgba(56,189,248,0.5);
      box-shadow: 0 0 22px rgba(56,189,248,0.35), 0 8px 22px rgba(0,0,0,0.35);
    }

    .perf-card--top1 {
      border-color: rgba(251,191,36,0.7);
      box-shadow: 0 0 26px rgba(251,191,36,0.45), 0 10px 26px rgba(0,0,0,0.4);
    }

    .perf-name {
      font-weight: 1000;
      font-size: 15px;
    }

    .perf-meta {
      font-size: 11px;
      opacity: 0.7;
    }

    .perf-value {
      font-size: 26px;
      font-weight: 1000;
    }

    .perf-rank {
      font-size: 13px;
      font-weight: 900;
      opacity: 0.8;
    }

    .perf-badge {
      position: absolute;
      bottom: 10px;
      right: 10px;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 1000;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      transform: rotate(-6deg);
    }

    .perf-badge--top5 {
      background: rgba(56,189,248,0.9);
      color: #0f172a;
      box-shadow: 0 6px 16px rgba(56,189,248,0.35);
    }

    .perf-badge--top1 {
      background: rgba(251,191,36,0.95);
      color: #0f172a;
      box-shadow: 0 6px 16px rgba(251,191,36,0.45);
    }

    .perf-modal {
      position: fixed;
      inset: 0;
      background: rgba(2,6,23,0.7);
      display: grid;
      place-items: center;
      z-index: 60;
      padding: 24px;
    }

    .perf-modal__card {
      width: min(560px, 92vw);
      max-height: 70vh;
      display: grid;
      gap: 12px;
      padding: 18px;
      border-radius: 20px;
      background: rgba(15,23,42,0.95);
      border: 1px solid rgba(148,163,184,0.18);
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }

    .perf-modal__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .perf-modal__title {
      font-size: 18px;
      font-weight: 1000;
    }

    .perf-modal__sub {
      font-size: 12px;
      opacity: 0.7;
    }

    .perf-modal__close {
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      cursor: pointer;
    }

    .perf-modal__list {
      overflow-y: auto;
      display: grid;
      gap: 8px;
      padding-right: 4px;
    }

    .perf-modal__row {
      display: grid;
      grid-template-columns: 40px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
    }

    .perf-modal__row--active {
      border-color: rgba(56,189,248,0.6);
      box-shadow: 0 0 18px rgba(56,189,248,0.3);
      background: rgba(56,189,248,0.12);
    }

    .perf-modal__rank {
      font-weight: 1000;
      font-size: 16px;
      text-align: center;
    }

    .perf-modal__name {
      font-weight: 900;
    }

    .perf-modal__value {
      font-weight: 1000;
    }

    .empty {
      font-size: 13px;
      opacity: 0.65;
    }

    @media (max-width: 1200px) {
      .logs-page {
        padding: 24px 16px 108px;
      }
      .perf-grid {
        grid-template-columns: repeat(3, minmax(160px, 1fr));
      }
      .taolu-grid {
        grid-auto-columns: minmax(0, 1fr);
      }
      .logs-header {
        grid-template-columns: 1fr;
      }
      .logs-header__right {
        justify-items: start;
      }
    }

    @media (max-width: 720px) {
      .perf-grid {
        grid-template-columns: repeat(2, minmax(160px, 1fr));
      }
      .taolu-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}
