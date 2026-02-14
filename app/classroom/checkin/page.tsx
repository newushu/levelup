"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AvatarRender from "@/components/AvatarRender";

type ClassRow = { id: string; name: string; class_color?: string | null; image_url?: string | null; class_image_url?: string | null };
type ScheduleEntry = {
  id: string;
  schedule_entry_id?: string | null;
  class_id: string;
  location_name?: string | null;
  session_date?: string | null;
  start_time: string;
  end_time?: string | null;
  instructor_name?: string | null;
  class_name?: string | null;
};
type ScheduleCard = {
  id: string;
  class_id: string;
  name: string;
  location_name?: string | null;
  time: string;
  start_time: string;
  instructors: string[];
  class_color?: string | null;
  image_url?: string | null;
};
type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  avatar_storage_path?: string | null;
  avatar_bg?: string | null;
  avatar_effect?: string | null;
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
  corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
};
type RosterRow = {
  checkin_id: string;
  student: {
    id: string;
    name: string;
    level: number;
    points_total: number;
    avatar_storage_path?: string | null;
    avatar_bg?: string | null;
    avatar_effect?: string | null;
    corner_border_url?: string | null;
    corner_border_render_mode?: string | null;
    corner_border_html?: string | null;
    corner_border_css?: string | null;
    corner_border_js?: string | null;
    corner_border_offset_x?: number | null;
    corner_border_offset_y?: number | null;
    corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
  };
};
type ClassEmote = {
  id: string;
  key: string;
  label: string;
  emoji: string;
};
type SuggestedRow = {
  id: string;
  name: string;
  short_name: string;
  level: number;
  points_total: number;
  avatar_storage_path?: string | null;
  visits: number;
};
type RedeemStatusLite = {
  can_redeem: boolean;
  available_points: number;
};

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toEasternDateKey(value: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(value);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  if (year && month && day) return `${year}-${month}-${day}`;
  return toLocalDateKey(value);
}

function shiftDateKey(key: string, deltaDays: number) {
  const [y, m, d] = key.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return key;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function safeTime(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const [h, m] = raw.split(":");
  if (!h || !m) return raw;
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function formatTime(input: string) {
  const parts = String(input ?? "").split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return input;
  const h = parts[0];
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

function chunk6<T>(list: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 6) out.push(list.slice(i, i + 6));
  return out;
}

function avatarUrl(path?: string | null) {
  const p = String(path ?? "").trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!p || !base) return "";
  return `${base}/storage/v1/object/public/avatars/${p}`;
}

function safeAccentColor(input?: string | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return "#38bdf8";
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
  if (/^rgb(a)?\(/i.test(raw)) return raw;
  return "#38bdf8";
}

function renderAvatarModel(row: {
  avatar_storage_path?: string | null;
  avatar_bg?: string | null;
  avatar_effect?: string | null;
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
  corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
}) {
  const effectKey = String(row.avatar_effect ?? "").trim();
  return {
    src: avatarUrl(row.avatar_storage_path),
    bg: row.avatar_bg || "rgba(15,23,42,0.08)",
    border: row.corner_border_url
      ? {
          image_url: row.corner_border_url,
          render_mode: row.corner_border_render_mode || "image",
          html: row.corner_border_html || "",
          css: row.corner_border_css || "",
          js: row.corner_border_js || "",
          offset_x: Number(row.corner_border_offset_x ?? 0),
          offset_y: Number(row.corner_border_offset_y ?? 0),
          offsets_by_context: row.corner_border_offsets_by_context || {},
        }
      : null,
    effect: effectKey ? { key: effectKey } : null,
  };
}

export default function ClassroomCheckinPage() {
  const [viewerRole, setViewerRole] = useState("student");
  const [blockedMsg, setBlockedMsg] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(toEasternDateKey(new Date()));
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [instanceId, setInstanceId] = useState("");
  const [query, setQuery] = useState("");
  const [searchRows, setSearchRows] = useState<StudentRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [suggestedRows, setSuggestedRows] = useState<SuggestedRow[]>([]);
  const [redeemByStudent, setRedeemByStudent] = useState<Record<string, RedeemStatusLite>>({});
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [emotes, setEmotes] = useState<ClassEmote[]>([]);
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedEmoteId, setSelectedEmoteId] = useState("");
  const [emotePopup, setEmotePopup] = useState<null | {
    message: string;
    emote: { label: string; emoji: string; image_url?: string | null; html?: string; css?: string; js?: string };
  }>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const easternTodayRef = useRef(selectedDate);

  useEffect(() => {
    (async () => {
      const [meRes, logoRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/public/nav-logo", { cache: "no-store" }),
      ]);
      const me = await safeJson(meRes);
      const logo = await safeJson(logoRes);
      const role = String(me.json?.role ?? "student");
      setViewerRole(role);
      if (!["admin", "coach", "classroom"].includes(role)) {
        setBlockedMsg("Classroom check-in is admin, coach, or classroom only.");
      }
      if (logo.ok && logo.json?.logo_url) setLogoUrl(String(logo.json.logo_url));
    })();
  }, []);

  useEffect(() => {
    if (blockedMsg) return;
    (async () => {
      const [classRes, scheduleRes, countsRes] = await Promise.all([
        fetch("/api/classes/list", { cache: "no-store" }),
        fetch(`/api/schedule/list?date=${selectedDate}`, { cache: "no-store" }),
        fetch(`/api/classroom/counts?date=${selectedDate}`, { cache: "no-store" }),
      ]);
      const classJson = await safeJson(classRes);
      const scheduleJson = await safeJson(scheduleRes);
      const countsJson = await safeJson(countsRes);
      if (classJson.ok) setClasses((classJson.json?.classes ?? []) as ClassRow[]);
      if (scheduleJson.ok) setScheduleEntries((scheduleJson.json?.entries ?? []) as ScheduleEntry[]);
      if (countsJson.ok) setClassCounts((countsJson.json?.counts_by_instance ?? {}) as Record<string, number>);
    })();
  }, [selectedDate, blockedMsg]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/checkin/emotes/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      const rows = (sj.json?.emotes ?? []) as ClassEmote[];
      setEmotes(rows);
      if (rows.length && !selectedEmoteId) setSelectedEmoteId(rows[0].id);
    })();
  }, [selectedEmoteId]);

  const scheduleCards = useMemo(() => {
    const classById = new Map(classes.map((c) => [String(c.id), c]));
    return [...scheduleEntries]
      .sort((a, b) => safeTime(a.start_time).localeCompare(safeTime(b.start_time)))
      .map((entry) => {
        const c = classById.get(String(entry.class_id));
        return {
          id: String(entry.id),
          class_id: String(entry.class_id),
          name: String(entry.class_name || c?.name || "Class"),
          location_name: String(entry.location_name || "").trim(),
          time: formatTime(entry.start_time),
          start_time: safeTime(entry.start_time),
          instructors: entry.instructor_name ? [entry.instructor_name] : ["Coach"],
          class_color: c?.class_color ?? null,
          image_url: (c?.image_url || c?.class_image_url || null) as string | null,
        } as ScheduleCard;
      });
  }, [classes, scheduleEntries]);

  const pages = useMemo(() => chunk6(scheduleCards), [scheduleCards]);
  const activeCard = useMemo(() => scheduleCards.find((c) => c.id === instanceId) ?? null, [scheduleCards, instanceId]);

  useEffect(() => {
    if (!scheduleCards.length) return;
    if (!instanceId || !scheduleCards.some((c) => c.id === instanceId)) setInstanceId(scheduleCards[0].id);
  }, [scheduleCards, instanceId]);

  async function loadRoster(id: string) {
    if (!id) return;
    setRosterLoading(true);
    const res = await fetch("/api/classroom/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: id }),
    });
    const sj = await safeJson(res);
    if (sj.ok) {
      setRoster((sj.json?.roster ?? []) as RosterRow[]);
      const unique = new Set(((sj.json?.roster ?? []) as any[]).map((r) => String(r?.student?.id ?? "")).filter(Boolean));
      setClassCounts((prev) => ({ ...prev, [id]: unique.size }));
    }
    setRosterLoading(false);
  }

  async function loadSuggested(card: ScheduleCard | null) {
    if (!card) return;
    const res = await fetch("/api/checkin/suggested", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: card.class_id,
        start_time: card.start_time,
        selected_date: selectedDate,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setSuggestedRows([]);
    setSuggestedRows((sj.json?.suggestions ?? []) as SuggestedRow[]);
  }

  useEffect(() => {
    if (!instanceId) return;
    loadRoster(instanceId);
  }, [instanceId]);

  useEffect(() => {
    loadSuggested(activeCard);
  }, [activeCard?.id, selectedDate]);

  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...suggestedRows.map((s) => String(s.id)),
        ...searchRows.map((s) => String(s.id)),
        ...roster.map((r) => String(r.student?.id ?? "")),
      ].filter(Boolean))
    );
    if (!ids.length) {
      setRedeemByStudent({});
      return;
    }
    (async () => {
      const res = await fetch("/api/avatar/daily-status-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: ids }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      const map = (sj.json?.statuses ?? {}) as Record<string, RedeemStatusLite>;
      setRedeemByStudent(map);
    })();
  }, [suggestedRows, searchRows, roster]);

  useEffect(() => {
    const q = query.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q) {
      setSearchRows([]);
      setSearching(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const sj = await safeJson(res);
      if (sj.ok) {
        setSearchRows((sj.json?.students ?? []) as StudentRow[]);
        setMsg("");
      } else {
        setSearchRows([]);
        setMsg(String(sj.json?.error || "Student search failed"));
      }
      setSearching(false);
    }, 220);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextEasternToday = toEasternDateKey(new Date());
      if (nextEasternToday === easternTodayRef.current) return;
      const previousEasternToday = easternTodayRef.current;
      easternTodayRef.current = nextEasternToday;
      setSelectedDate((prev) => (prev === previousEasternToday ? nextEasternToday : prev));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function checkIn(student: { id: string; name: string }) {
    if (!instanceId) return setMsg("Select a class first.");
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: instanceId, student_id: student.id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Check-in failed");
    setOkMsg(`✅ ${student.name} checked in`);
    setMsg("");
    setQuery("");
    setSearchRows([]);
    if (sj.json?.emote_popup) {
      setEmotePopup({
        message: String(sj.json?.emote_popup?.message ?? ""),
        emote: {
          label: String(sj.json?.emote_popup?.emote?.label ?? "Emote"),
          emoji: String(sj.json?.emote_popup?.emote?.emoji ?? "✨"),
          image_url: sj.json?.emote_popup?.emote?.image_url ?? null,
          html: String(sj.json?.emote_popup?.emote?.html ?? ""),
          css: String(sj.json?.emote_popup?.emote?.css ?? ""),
          js: String(sj.json?.emote_popup?.emote?.js ?? ""),
        },
      });
      window.setTimeout(() => setEmotePopup(null), 4200);
    }
    await loadRoster(instanceId);
    await loadSuggested(activeCard);
  }

  async function redeemStudentDaily(student: { id: string; name: string }) {
    const status = redeemByStudent[String(student.id)];
    if (!status?.can_redeem) return;
    const res = await fetch("/api/avatar/daily-redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Redeem failed"));
    const points = Math.max(0, Number(sj.json?.points ?? status.available_points ?? 0));
    setOkMsg(`✨ ${student.name} redeemed +${points} pts`);
    setMsg("");
    setRedeemByStudent((prev) => ({
      ...prev,
      [student.id]: { can_redeem: false, available_points: 0 },
    }));
  }

  async function uncheckStudent(row: RosterRow) {
    const res = await fetch("/api/checkin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_id: row.checkin_id, instance_id: instanceId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Uncheck failed"));
    setOkMsg(`Removed ${row.student.name} from roster`);
    await loadRoster(instanceId);
    await loadSuggested(activeCard);
  }

  async function sendEmote() {
    if (!instanceId) return;
    if (!senderName.trim() || !recipientName.trim() || !selectedEmoteId) return setMsg("Fill sender, recipient, and emote.");
    const res = await fetch("/api/checkin/emotes/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instance_id: instanceId,
        sender_name: senderName.trim(),
        recipient_name: recipientName.trim(),
        emote_id: selectedEmoteId,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Send failed"));
    setSendOpen(false);
    setSenderName("");
    setRecipientName("");
    setOkMsg("Emote sent");
  }

  const checkedInIds = useMemo(
    () => new Set(roster.map((r) => String(r.student?.id ?? "")).filter(Boolean)),
    [roster]
  );
  const suggestedFiltered = useMemo(
    () => suggestedRows.filter((s) => !checkedInIds.has(String(s.id))),
    [suggestedRows, checkedInIds]
  );
  const suggestedTop = useMemo(() => suggestedFiltered.slice(0, 5), [suggestedFiltered]);
  const suggestedOverflow = useMemo(() => suggestedFiltered.slice(5), [suggestedFiltered]);

  if (blockedMsg) {
    return (
      <main style={{ padding: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{blockedMsg}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 14 }}>
      <style>{`
        .checkin-shell {
          position: relative;
          overflow: hidden;
          display: grid; grid-template-columns: 250px 1fr; gap: 16px; min-height: calc(100vh - 28px);
          background:
            radial-gradient(circle at 12% 16%, rgba(56,189,248,0.2), transparent 30%),
            radial-gradient(circle at 88% 6%, rgba(251,146,60,0.18), transparent 34%),
            linear-gradient(160deg, #050a1f, #0a1333 42%, #101c3f);
          border-radius: 26px; padding: 12px; border: 1px solid rgba(125,211,252,0.24);
        }
        .checkin-shell > * { position: relative; z-index: 2; }
        .station-bg {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 42%;
          opacity: 0.08;
          pointer-events: none;
          z-index: 1;
          mask-image: linear-gradient(to top, rgba(0,0,0,0.96), rgba(0,0,0,0.65) 58%, rgba(0,0,0,0));
          -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,0.96), rgba(0,0,0,0.65) 58%, rgba(0,0,0,0));
        }
        .station-bg img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          clip-path: inset(10% 0 10% 0);
          transform: scale(1.08);
        }
        .checkin-side {
          position: sticky; top: 14px; align-self: start; border-radius: 20px; border: 1px solid rgba(148,163,184,0.25);
          min-height: calc(100vh - 56px);
          background: linear-gradient(165deg, rgba(5,10,31,0.9), rgba(8,18,48,0.9)); padding: 16px; display: grid; gap: 12px;
          box-shadow: 0 18px 40px rgba(2,6,23,0.5);
          grid-template-rows: auto auto auto auto auto 1fr;
        }
        .side-logo-wrap {
          width: 164px;
          height: 164px;
          margin: 0 auto;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #020617;
          border: 1px solid rgba(56, 189, 248, 0.26);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 16px 30px rgba(2,6,23,0.24);
        }
        .side-level-up {
          margin-top: 8px;
          margin-bottom: 44px;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          letter-spacing: 0.34em;
          font-size: 44px;
          font-weight: 1000;
          color: rgba(14, 165, 233, 0.96);
          text-shadow:
            0 0 12px rgba(56, 189, 248, 0.58),
            0 0 26px rgba(14, 165, 233, 0.42),
            0 12px 24px rgba(14, 165, 233, 0.18);
          justify-self: center;
          animation: sideGlow 2.8s ease-in-out infinite;
        }
        .checkin-main { display: grid; gap: 6px; }
        .checkin-heading {
          font-size: clamp(34px, 6vw, 84px);
          font-weight: 1000;
          line-height: 0.95;
          letter-spacing: 0.06em;
          color: #e2e8f0;
          text-shadow: 0 10px 28px rgba(56,189,248,0.34);
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .date-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin: 2px 0 6px;
        }
        .date-nav-btn {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.38);
          background: linear-gradient(140deg, rgba(15,23,42,0.92), rgba(30,41,59,0.86));
          color: #e2e8f0;
          font-size: 24px;
          line-height: 1;
          font-weight: 900;
          cursor: pointer;
          display: grid;
          place-items: center;
        }
        .date-nav-label {
          min-width: 360px;
          text-align: center;
          font-size: clamp(22px, 3.2vw, 36px);
          font-weight: 1000;
          color: #f8fafc;
          letter-spacing: 0.02em;
          text-shadow: 0 8px 20px rgba(14,165,233,0.22);
        }
        .class-pages {
          overflow-x: auto; overflow-y: hidden; display: grid; grid-auto-flow: column; grid-auto-columns: 100%;
          gap: 12px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
          margin-top: -2px;
        }
        .class-page {
          scroll-snap-align: start; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); grid-template-rows: repeat(2, minmax(0,1fr)); gap: 10px;
          min-height: 320px;
        }
        .class-card {
          position: relative;
          overflow: hidden;
          border-radius: 18px; border: 1px solid color-mix(in srgb, var(--card-accent, #38bdf8) 45%, white 20%);
          background:
            linear-gradient(152deg, color-mix(in srgb, var(--card-accent, #38bdf8) 22%, transparent), rgba(8,13,31,0.1)),
            linear-gradient(195deg, color-mix(in srgb, var(--card-accent, #38bdf8) 14%, transparent), rgba(12,20,45,0.12));
          color: #e2e8f0; cursor: pointer; text-align: center; padding: 12px; display: grid; gap: 6px; justify-items: center;
          box-shadow: 0 14px 34px rgba(2,6,23,0.4), inset 0 0 0 1px rgba(255,255,255,0.04);
          transition: transform 140ms ease, box-shadow 140ms ease;
          backdrop-filter: blur(4px);
        }
        .class-card-aura {
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(circle at 20% 25%, color-mix(in srgb, var(--card-accent, #38bdf8) 62%, white 10%), transparent 44%),
            radial-gradient(circle at 80% 12%, rgba(251,146,60,0.34), transparent 42%),
            radial-gradient(circle at 50% 82%, rgba(16,185,129,0.32), transparent 46%);
          animation: auraShift 9s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        .class-card-sparkles {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.9) 0.7px, transparent 1px),
            radial-gradient(circle, color-mix(in srgb, var(--card-accent, #38bdf8) 80%, white 8%) 0.8px, transparent 1px),
            radial-gradient(circle, rgba(250,204,21,0.78) 0.75px, transparent 1px);
          background-size: 20px 20px, 28px 28px, 34px 34px;
          background-position: 0 0, 14px 12px;
          opacity: 0.44;
          animation: sparkleDrift 9s linear infinite;
          pointer-events: none;
          z-index: 0;
        }
        .class-card-particles {
          position: absolute;
          inset: -16%;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(circle at 10% 20%, color-mix(in srgb, var(--card-accent, #38bdf8) 72%, white 8%) 1.2px, transparent 1.8px),
            radial-gradient(circle at 72% 34%, rgba(255,255,255,0.9) 1.1px, transparent 1.8px),
            radial-gradient(circle at 38% 82%, rgba(250,204,21,0.86) 1.1px, transparent 1.8px),
            radial-gradient(circle at 84% 76%, color-mix(in srgb, var(--card-accent, #38bdf8) 78%, #a78bfa 16%) 1px, transparent 1.7px);
          background-size: 54px 54px, 66px 66px, 72px 72px, 86px 86px;
          opacity: 0.5;
          animation: particlesFloat 7s linear infinite;
        }
        .class-card > * { position: relative; z-index: 1; }
        .class-card:hover { transform: translateY(-2px); box-shadow: 0 20px 34px rgba(2,6,23,0.5), inset 0 0 0 1px rgba(255,255,255,0.06); }
        .class-card.active {
          border-color: color-mix(in srgb, var(--card-accent, #38bdf8) 78%, white 15%);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--card-accent, #38bdf8) 44%, transparent), 0 20px 34px rgba(14,165,233,0.22);
        }
        .class-thumb {
          width: 92px; height: 92px; border-radius: 14px; background: rgba(148,163,184,0.18); border: 1px solid rgba(148,163,184,0.24);
          background-size: cover; background-position: center;
        }
        .card-name {
          font-weight: 1000;
          font-size: 28px;
          line-height: 1.05;
          margin-top: 2px;
        }
        .card-location {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--card-accent, #38bdf8) 65%, white 24%);
          background: linear-gradient(140deg, color-mix(in srgb, var(--card-accent, #38bdf8) 32%, transparent), rgba(30,41,59,0.45));
          color: #ecfeff;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .card-time-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 12px;
          border-radius: 999px;
          border: 1px solid rgba(14,165,233,0.35);
          background: linear-gradient(140deg, rgba(14,165,233,0.3), rgba(15,23,42,0.4));
          font-size: 22px;
          line-height: 1.05;
          font-weight: 1000;
          color: #e0f2fe;
          margin-top: -2px;
          margin-bottom: 1px;
        }
        .card-coach {
          font-size: 14px;
          opacity: 0.88;
          font-weight: 900;
          color: #bae6fd;
        }
        .card-count {
          font-size: 13px;
          opacity: 0.84;
          font-weight: 800;
          color: #dbeafe;
        }
        .overlay-wrap {
          position: fixed; inset: 0; z-index: 240; background: rgba(15,23,42,0.42); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
          animation: overlayIn 140ms ease;
        }
        .overlay-panel {
          width: min(1520px, calc(100vw - 16px)); max-height: calc(100vh - 10px); overflow: auto;
          border-radius: 22px; border: 1px solid rgba(148,163,184,0.32);
          background: linear-gradient(160deg, rgba(248,250,252,0.98), rgba(239,246,255,0.98));
          box-shadow: 0 22px 52px rgba(15,23,42,0.24);
          padding: 16px;
        }
        .checkin-panel {
          border-radius: 20px; border: 1px solid rgba(148,163,184,0.32); background: rgba(255,255,255,0.78); padding: 12px; display: grid; gap: 10px;
        }
        .suggested-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }
        .suggested-overflow {
          display: grid; grid-auto-flow: column; grid-auto-columns: max-content; gap: 8px; overflow-x: auto; overflow-y: hidden;
          -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; padding-bottom: 2px;
        }
        .suggested-chip {
          border-radius: 999px; border: 1px solid rgba(74,222,128,0.45); background: rgba(21,128,61,0.12); color: #064e3b;
          padding: 6px 10px; font-weight: 900; font-size: 12px; cursor: pointer;
        }
        .suggested-chip-lg {
          padding: 12px 16px;
          font-size: 16px;
          border-width: 2px;
          background: linear-gradient(140deg, rgba(16,185,129,0.16), rgba(21,128,61,0.08));
          box-shadow: 0 10px 20px rgba(6,78,59,0.14);
        }
        .input-box { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.35); background: rgba(255,255,255,0.92); color: #0f172a; }
        .search-list { display: grid; gap: 6px; max-height: 220px; overflow: auto; }
        .search-row {
          border-radius: 12px; border: 1px solid rgba(148,163,184,0.26); background: rgba(255,255,255,0.92); padding: 8px 10px;
          display: flex; justify-content: space-between; align-items: center; gap: 10px;
        }
        .redeem-mini {
          border-radius: 999px;
          border: 1px solid rgba(16,185,129,0.46);
          background: linear-gradient(140deg, rgba(16,185,129,0.24), rgba(14,165,233,0.22));
          color: #064e3b;
          padding: 6px 10px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          box-shadow: 0 0 14px rgba(16,185,129,0.28);
          animation: redeemMiniGlow 1.9s ease-in-out infinite;
          white-space: nowrap;
        }
        .roster-grid { display: grid; gap: 8px; max-height: 360px; overflow: auto; }
        .roster-pill {
          border-radius: 10px; border: 1px solid rgba(148,163,184,0.25); background: rgba(255,255,255,0.92); padding: 7px 9px;
          font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 10px;
        }
        .welcome-chip {
          display: inline-flex; gap: 8px; align-items: center; justify-content: center; text-align: center; padding: 7px 11px; border-radius: 999px;
          border: 1px solid rgba(56,189,248,0.35); background: rgba(14,165,233,0.14); color: #e0f2fe; font-weight: 900;
        }
        .float-pulse {
          animation: floatPulse 2.4s ease-in-out infinite;
        }
        .gentle-fade {
          animation: gentleFade 420ms ease;
        }
        @keyframes floatPulse {
          0% { transform: translateY(0); box-shadow: 0 10px 20px rgba(14,165,233,0.18); }
          50% { transform: translateY(-4px); box-shadow: 0 16px 24px rgba(14,165,233,0.22); }
          100% { transform: translateY(0); box-shadow: 0 10px 20px rgba(14,165,233,0.18); }
        }
        @keyframes sideGlow {
          0% { opacity: 0.78; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
          100% { opacity: 0.78; transform: translateY(0); }
        }
        @keyframes auraShift {
          0% { transform: translateX(0) translateY(0) scale(1); }
          50% { transform: translateX(-2.5%) translateY(2%) scale(1.03); }
          100% { transform: translateX(0) translateY(0) scale(1); }
        }
        @keyframes sparkleDrift {
          0% { transform: translate3d(0, 0, 0); opacity: 0.24; }
          50% { opacity: 0.4; }
          100% { transform: translate3d(-12px, -14px, 0); opacity: 0.24; }
        }
        @keyframes particlesFloat {
          0% { transform: translate3d(0, 8px, 0) scale(1); opacity: 0.38; }
          50% { transform: translate3d(-8px, -6px, 0) scale(1.05); opacity: 0.62; }
          100% { transform: translate3d(-14px, -16px, 0) scale(1); opacity: 0.38; }
        }
        @keyframes gentleFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes redeemMiniGlow {
          0% { box-shadow: 0 0 0 rgba(16,185,129,0); transform: translateY(0); }
          50% { box-shadow: 0 0 16px rgba(16,185,129,0.4); transform: translateY(-1px); }
          100% { box-shadow: 0 0 0 rgba(16,185,129,0); transform: translateY(0); }
        }
        @media (max-width: 1150px) {
          .checkin-shell { grid-template-columns: 1fr; }
          .class-page { grid-template-columns: repeat(2, minmax(0,1fr)); grid-template-rows: auto; }
          .suggested-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .date-nav-label { min-width: 220px; font-size: clamp(18px, 5vw, 28px); }
        }
      `}</style>
      <div className="checkin-shell">
        <div className="station-bg" aria-hidden>
          <img src="https://newushu.com/uploads/1/1/1/3/111378341/caal-patriots-final-edit-7_orig.gif" alt="" />
        </div>
        <aside className="checkin-side">
          <div className="side-logo-wrap">
            <img
              src={logoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
              alt="Logo"
              style={{ width: 140, height: 140, objectFit: "contain", filter: "invert(1)" }}
            />
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, textTransform: "uppercase", fontWeight: 900, color: "#bae6fd" }}>Check-In Station</div>
          <div className="welcome-chip">Welcome</div>
          <div style={{ fontSize: 11, opacity: 0.75, color: "#cbd5e1" }}>Role: {viewerRole}</div>
          <div className="side-level-up">LEVEL UP</div>
        </aside>
        <section className="checkin-main">
          <div className="checkin-heading">Check In</div>
          <div className="date-nav">
            <button className="date-nav-btn" onClick={() => setSelectedDate((prev) => shiftDateKey(prev, -1))} aria-label="Previous date">
              ‹
            </button>
            <div className="date-nav-label">{formatDateLabel(selectedDate)}</div>
            <button className="date-nav-btn" onClick={() => setSelectedDate((prev) => shiftDateKey(prev, 1))} aria-label="Next date">
              ›
            </button>
          </div>
          <div className="class-pages">
            {pages.map((rows, idx) => (
              <div key={idx} className="class-page">
                {rows.map((c) => (
                  <button
                    key={c.id}
                    className={`class-card ${c.id === instanceId ? "active" : ""}`}
                    style={{ ["--card-accent" as any]: safeAccentColor(c.class_color) }}
                    onClick={() => {
                      setInstanceId(c.id);
                      setOverlayOpen(true);
                    }}
                  >
                    <div className="class-card-aura" />
                    <div className="class-card-particles" />
                    <div className="class-card-sparkles" />
                    <div
                      className="class-thumb"
                      style={
                        c.image_url
                          ? { backgroundImage: `url(${c.image_url})` }
                          : { backgroundImage: "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(15,23,42,0.9))" }
                      }
                    />
                    <div className="card-location">{c.location_name || "Location"}</div>
                    <div className="card-name">{c.name}</div>
                    <div className="card-time-chip">{c.time}</div>
                    <div className="card-coach">{c.instructors.join(", ")}</div>
                    <div className="card-count">{classCounts[c.id] ?? 0} checked in</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
      {overlayOpen && activeCard ? (
        <div className="overlay-wrap" onClick={() => setOverlayOpen(false)}>
          <div className="overlay-panel gentle-fade" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 22, fontWeight: 1000, color: "#0f172a" }}>{activeCard.name}</div>
                <div style={{ fontSize: 13, opacity: 0.75, color: "#0f172a" }}>
                  {activeCard.time} • {activeCard.instructors.join(", ")} • {classCounts[activeCard.id] ?? 0} checked in
                </div>
              </div>
              <button className="float-pulse" style={{ ...suggestedChipBtn(), background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#991b1b" }} onClick={() => setOverlayOpen(false)}>
                ✕ Close
              </button>
            </div>

            <div className="checkin-panel">
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 1000, fontSize: 17, color: "#0f172a" }}>
                    Suggested (top 5 + swipe for more)
                  </div>
                  <div className="suggested-row">
                    {suggestedTop.map((s) => (
                      <div key={s.id} style={{ display: "grid", gap: 6 }}>
                        <button className="suggested-chip suggested-chip-lg" onClick={() => checkIn({ id: s.id, name: s.name })}>
                          {s.short_name}
                        </button>
                        {redeemByStudent[s.id]?.can_redeem ? (
                          <button className="redeem-mini" onClick={() => redeemStudentDaily({ id: s.id, name: s.name })}>
                            Redeem +{Math.round(Number(redeemByStudent[s.id]?.available_points ?? 0))}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {suggestedOverflow.length ? (
                    <div className="suggested-overflow">
                      {suggestedOverflow.map((s) => (
                        <div key={s.id} style={{ display: "grid", gap: 6 }}>
                          <button className="suggested-chip suggested-chip-lg" onClick={() => checkIn({ id: s.id, name: s.name })}>
                            {s.short_name}
                          </button>
                          {redeemByStudent[s.id]?.can_redeem ? (
                            <button className="redeem-mini" onClick={() => redeemStudentDaily({ id: s.id, name: s.name })}>
                              Redeem +{Math.round(Number(redeemByStudent[s.id]?.available_points ?? 0))}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!suggestedFiltered.length ? <div style={{ opacity: 0.65, fontSize: 12, color: "#0f172a" }}>No historical suggestions yet.</div> : null}
                  <input
                    className="input-box"
                    placeholder="Type student name..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div style={{ fontSize: 12, opacity: 0.72, color: "#0f172a" }}>{searching ? "Searching..." : `${searchRows.length} matches`}</div>
                  <div className="search-list">
                    {searchRows.map((s) => (
                      <div key={s.id} className="search-row">
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {(() => {
                            const avatar = renderAvatarModel(s);
                            return (
                              <AvatarRender
                                size={32}
                                bg={avatar.bg}
                                avatarSrc={avatar.src || undefined}
                                border={avatar.border}
                                effect={avatar.effect}
                                showImageBorder={true}
                                contextKey="classroom_checkin"
                                style={{ borderRadius: 999 }}
                                fallback={<span style={{ fontSize: 10, opacity: 0.7 }}>{s.name.slice(0, 1)}</span>}
                              />
                            );
                          })()}
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>{s.name}</div>
                            <div style={{ fontSize: 11, opacity: 0.75, color: "#334155" }}>Lv {s.level} • {s.points_total} pts</div>
                          </div>
                        </div>
                        <button className="suggested-chip" onClick={() => checkIn({ id: s.id, name: s.name })}>Check In</button>
                        {redeemByStudent[s.id]?.can_redeem ? (
                          <button className="redeem-mini" onClick={() => redeemStudentDaily({ id: s.id, name: s.name })}>
                            Redeem +{Math.round(Number(redeemByStudent[s.id]?.available_points ?? 0))}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      type="button"
                      title="Send class emote"
                      className="suggested-chip"
                      style={{ fontSize: 22, padding: "6px 14px", background: "rgba(14,165,233,0.12)", borderColor: "rgba(14,165,233,0.32)" }}
                      onClick={() => setSendOpen(true)}
                    >
                      🛰️
                    </button>
                  </div>
                  <div style={{ fontWeight: 1000, fontSize: 15, color: "#0f172a" }}>
                    Current Roster
                  </div>
                  <div className="roster-grid">
                    {rosterLoading ? <div style={{ opacity: 0.7, color: "#0f172a" }}>Loading roster...</div> : null}
                    {!rosterLoading && !roster.length ? <div style={{ opacity: 0.7, color: "#0f172a" }}>No students checked in yet.</div> : null}
                    {roster.map((row) => (
                      <div key={row.checkin_id} className="roster-pill">
                        {(() => {
                          const avatar = renderAvatarModel(row.student);
                          return (
                        <AvatarRender
                          size={34}
                          bg={avatar.bg}
                          avatarSrc={avatar.src || undefined}
                          border={avatar.border}
                          effect={avatar.effect}
                          showImageBorder={true}
                          contextKey="classroom_checkin"
                          style={{ borderRadius: 999 }}
                          fallback={<span style={{ fontSize: 10, opacity: 0.7 }}>{row.student.name.slice(0, 1)}</span>}
                        />
                          );
                        })()}
                        <span style={{ color: "#0f172a" }}>{row.student.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.75, color: "#334155" }}>
                          Lv {row.student.level} • {row.student.points_total} pts
                        </span>
                        <button
                          type="button"
                          className="suggested-chip"
                          style={{ marginLeft: 8, background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#991b1b" }}
                          onClick={() => uncheckStudent(row)}
                        >
                          Uncheck
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {msg ? <div style={{ color: "#b91c1c", fontWeight: 900 }}>{msg}</div> : null}
              {okMsg ? <div style={{ color: "#047857", fontWeight: 900 }}>{okMsg}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
      {sendOpen ? (
        <div className="overlay-wrap" onClick={() => setSendOpen(false)}>
          <div className="overlay-panel gentle-fade" style={{ width: "min(760px, calc(100vw - 20px))", maxHeight: "unset" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 22, fontWeight: 1000, color: "#0f172a", marginBottom: 10 }}>Send Emote</div>
            <div style={{ display: "grid", gap: 10 }}>
              <input className="input-box" placeholder="Sender name" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              <input className="input-box" placeholder="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {emotes.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="suggested-chip suggested-chip-lg"
                    style={selectedEmoteId === e.id ? { boxShadow: "0 0 0 2px rgba(14,165,233,0.45) inset" } : undefined}
                    onClick={() => setSelectedEmoteId(e.id)}
                  >
                    {e.emoji} {e.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="suggested-chip" onClick={() => setSendOpen(false)}>Cancel</button>
                <button className="redeem-mini" onClick={sendEmote}>Send</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {emotePopup ? (
        <div className="overlay-wrap" onClick={() => setEmotePopup(null)}>
          <div className="overlay-panel gentle-fade" style={{ width: "min(720px, calc(100vw - 20px))", maxHeight: "unset", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>{emotePopup.emote.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 1000, color: "#0f172a", marginTop: 8 }}>{emotePopup.emote.label}</div>
            {emotePopup.emote.image_url ? (
              <img src={String(emotePopup.emote.image_url)} alt={emotePopup.emote.label} style={{ width: 140, height: 140, objectFit: "contain", margin: "10px auto" }} />
            ) : null}
            <div style={{ fontWeight: 900, color: "#075985", fontSize: 16 }}>{emotePopup.message}</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function suggestedChipBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(74,222,128,0.45)",
    background: "rgba(21,128,61,0.12)",
    color: "#064e3b",
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}
