"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ClassRow = { id: string; name: string };
type LocationRow = {
  id: string;
  name: string;
  timezone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};
type PassType = { id: string; name: string; description?: string | null; enabled: boolean };
type ScheduleEntry = {
  id: string;
  class_id: string;
  class_name: string;
  location_id: string;
  location_name: string;
  location_timezone?: string | null;
  day_of_week: number;
  start_time: string;
  end_time?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  instructor_name?: string | null;
  room_name?: string | null;
};
type ScheduleInstance = {
  id: string;
  schedule_entry_id?: string | null;
  class_id: string;
  class_name: string;
  location_id: string;
  location_name: string;
  session_date: string;
  start_time: string;
  end_time?: string | null;
  instructor_name?: string | null;
  room_name?: string | null;
  is_cancelled?: boolean;
  is_fallback?: boolean;
};
type StaffRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  roles?: string[];
  is_coach?: boolean;
  is_staff?: boolean;
};
type StaffMeta = {
  hours: string;
  services: string[];
  roleTag: "coach" | "staff";
  availability: Record<number, { enabled: boolean; start: string; end: string }>;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const serviceOptions = ["Class", "Event", "Test", "Private", "Small Group"] as const;
const STAFF_META_PREFIX = "__schedule_meta_v1__";

function buildDefaultAvailability() {
  return dayLabels.reduce((acc, _label, index) => {
    acc[index] = { enabled: false, start: "16:00", end: "20:00" };
    return acc;
  }, {} as Record<number, { enabled: boolean; start: string; end: string }>);
}

function defaultStaffMeta(roleTag: "coach" | "staff" = "coach"): StaffMeta {
  return { hours: "", services: [], roleTag, availability: buildDefaultAvailability() };
}

function parseStoredStaffMeta(rawHours: string | null | undefined, services: string[] | null | undefined) {
  const base = defaultStaffMeta("coach");
  base.services = Array.isArray(services) ? services.map((s) => String(s || "").trim()).filter(Boolean) : [];
  const hoursText = String(rawHours ?? "");
  if (!hoursText.startsWith(STAFF_META_PREFIX)) {
    base.hours = hoursText;
    return base;
  }
  try {
    const parsed = JSON.parse(hoursText.slice(STAFF_META_PREFIX.length));
    const roleTag = String(parsed?.roleTag ?? "").toLowerCase();
    base.roleTag = roleTag === "staff" ? "staff" : "coach";
    base.hours = String(parsed?.hours ?? "");
    if (parsed?.availability && typeof parsed.availability === "object") {
      const next = buildDefaultAvailability();
      Object.entries(parsed.availability).forEach(([k, v]) => {
        const idx = Number(k);
        if (!Number.isFinite(idx) || idx < 0 || idx > 6 || !v || typeof v !== "object") return;
        next[idx] = {
          enabled: Boolean((v as any).enabled),
          start: String((v as any).start ?? next[idx].start),
          end: String((v as any).end ?? next[idx].end),
        };
      });
      base.availability = next;
    }
  } catch {
    base.hours = "";
  }
  return base;
}

function serializeStaffMetaHours(meta: StaffMeta) {
  return `${STAFF_META_PREFIX}${JSON.stringify({
    roleTag: meta.roleTag,
    hours: meta.hours,
    availability: meta.availability,
  })}`;
}

function normalizeEntryType(value: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "small group" || raw === "small-group" || raw === "small_group") return "small group";
  if (raw === "private" || raw === "privates") return "private";
  if (raw === "event" || raw === "events") return "event";
  if (raw === "test" || raw === "tests") return "test";
  if (raw === "class" || raw === "classes") return "class";
  return "class";
}

function formatStaffName(row: StaffRow) {
  const name = String(row.username ?? "").trim();
  const email = String(row.email ?? "").trim();
  return name || email || row.user_id.slice(0, 8);
}

export default function ScheduleAdminPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [msg, setMsg] = useState("");
  const [passes, setPasses] = useState<PassType[]>([]);

  const [newClassName, setNewClassName] = useState("");
  const [newClassLocationId, setNewClassLocationId] = useState("");
  const [newClassPassIds, setNewClassPassIds] = useState<string[]>([]);
  const [newClassColor, setNewClassColor] = useState("#2563eb");
  const [newPassName, setNewPassName] = useState("");
  const [newPassDesc, setNewPassDesc] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationTimezone, setNewLocationTimezone] = useState("");
  const [newLocationAddress1, setNewLocationAddress1] = useState("");
  const [newLocationAddress2, setNewLocationAddress2] = useState("");
  const [newLocationCity, setNewLocationCity] = useState("");
  const [newLocationState, setNewLocationState] = useState("");
  const [newLocationPostal, setNewLocationPostal] = useState("");
  const [newLocationCountry, setNewLocationCountry] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [assignPassId, setAssignPassId] = useState("");
  const [assignStart, setAssignStart] = useState("");
  const [assignEnd, setAssignEnd] = useState("");
  const [studentPasses, setStudentPasses] = useState<{ id: string; name: string; valid_from: string; valid_to: string | null; active: boolean }[]>([]);

  const [formClassId, setFormClassId] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [baseStart, setBaseStart] = useState("17:00");
  const [baseEnd, setBaseEnd] = useState("18:00");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [formInstructor, setFormInstructor] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formEntryType, setFormEntryType] = useState("Class");
  const [breakDatesInput, setBreakDatesInput] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayTimes, setDayTimes] = useState<Record<number, { start: string; end: string }>>({});
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffMeta, setStaffMeta] = useState<Record<string, StaffMeta>>({});
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<"idle" | "saving" | "scheduled">("idle");
  const scheduleStatusTimer = useRef<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarEntries, setCalendarEntries] = useState<ScheduleInstance[]>([]);
  const [calendarClassFilter, setCalendarClassFilter] = useState("");
  const [calendarInstructorFilter, setCalendarInstructorFilter] = useState("");
  const [calendarRoomFilter, setCalendarRoomFilter] = useState("");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [detailMsg, setDetailMsg] = useState("");
  const [saveToast, setSaveToast] = useState("");
  const [passAccess, setPassAccess] = useState<Record<string, string[]>>({});
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [editRangeOpen, setEditRangeOpen] = useState(false);
  const [editRangeClassId, setEditRangeClassId] = useState("");
  const [editRangeClassName, setEditRangeClassName] = useState("");
  const [editRangeStart, setEditRangeStart] = useState("");
  const [editRangeEnd, setEditRangeEnd] = useState("");
  const [editRangeStartTime, setEditRangeStartTime] = useState("");
  const [editRangeEndTime, setEditRangeEndTime] = useState("");
  const [editRangeInstructor, setEditRangeInstructor] = useState("");
  const [editRangeRoom, setEditRangeRoom] = useState("");
  const [editRangeMode, setEditRangeMode] = useState<"edit" | "cancel">("edit");
  const [editRangeExceptions, setEditRangeExceptions] = useState<string[]>([]);
  const [editRangeOptions, setEditRangeOptions] = useState<string[]>([]);
  const [editRangeLoading, setEditRangeLoading] = useState(false);
  const [locationDrafts, setLocationDrafts] = useState<Record<string, Partial<LocationRow>>>({});

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === formLocationId) ?? null,
    [formLocationId, locations]
  );

  async function loadAll() {
    setMsg("");
    const [cRes, lRes, sRes] = await Promise.all([
      fetch("/api/classes/list", { cache: "no-store" }),
      fetch("/api/locations/list", { cache: "no-store" }),
      fetch("/api/schedule/list", { cache: "no-store" }),
    ]);
    const cData = await cRes.json().catch(() => ({}));
    const lData = await lRes.json().catch(() => ({}));
    const sData = await sRes.json().catch(() => ({}));

    if (cRes.ok) setClasses((cData.classes ?? []) as ClassRow[]);
    if (lRes.ok) setLocations((lData.locations ?? []) as LocationRow[]);
    if (sRes.ok) setEntries((sData.entries ?? []) as ScheduleEntry[]);

    if (!cRes.ok) setMsg(cData?.error || "Failed to load classes");
    if (!lRes.ok) setMsg(lData?.error || "Failed to load locations");
    if (!sRes.ok) setMsg(sData?.error || "Failed to load schedule");
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/passes/list", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPasses((data.passes ?? []) as PassType[]);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes/pass-access", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPassAccess((data.access ?? {}) as Record<string, string[]>);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/staff/list", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setStaff((data.staff ?? []) as StaffRow[]);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/staff/schedule-profiles", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        const next: Record<string, StaffMeta> = {};
        ((data.profiles ?? []) as Array<{ user_id: string; availability_hours?: string | null; services?: string[] | null }>).forEach((row) => {
          const id = String(row.user_id ?? "");
          if (!id) return;
          next[id] = parseStoredStaffMeta(row.availability_hours, row.services);
        });
        setStaffMeta(next);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!newClassLocationId && locations[0]?.id) setNewClassLocationId(locations[0].id);
  }, [newClassLocationId, locations]);

  useEffect(() => {
    if (!formClassId && classes[0]?.id) setFormClassId(classes[0].id);
    if (!formLocationId && locations[0]?.id) setFormLocationId(locations[0].id);
  }, [classes, formClassId, formLocationId, locations]);

  useEffect(() => {
    const drafts: Record<string, Partial<LocationRow>> = {};
    locations.forEach((loc) => {
      drafts[loc.id] = {
        id: loc.id,
        name: loc.name,
        timezone: loc.timezone ?? "",
        address_line1: loc.address_line1 ?? "",
        address_line2: loc.address_line2 ?? "",
        city: loc.city ?? "",
        state: loc.state ?? "",
        postal_code: loc.postal_code ?? "",
        country: loc.country ?? "",
      };
    });
    setLocationDrafts(drafts);
  }, [locations]);

  useEffect(() => {
    setSelectedInstructorIds([]);
  }, [formEntryType]);

  useEffect(() => {
    if (!rangeStart) {
      const today = new Date().toISOString().slice(0, 10);
      setRangeStart(today);
    }
    if (!rangeEnd) {
      const end = new Date();
      end.setDate(end.getDate() + 90);
      setRangeEnd(end.toISOString().slice(0, 10));
    }
  }, [rangeEnd, rangeStart]);

  async function refreshCalendar() {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const start = monthStart.toISOString().slice(0, 10);
    const end = monthEnd.toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/schedule/list?start=${start}&end=${end}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCalendarEntries((data.entries ?? []) as ScheduleInstance[]);
    } catch {}
  }

  useEffect(() => {
    refreshCalendar();
  }, [calendarMonth, entries.length]);

  useEffect(() => {
    if (!studentQuery.trim()) {
      setStudentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/students/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: studentQuery.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
          setStudentResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
        }
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [studentQuery]);

  useEffect(() => {
    if (!selectedStudent?.id) {
      setStudentPasses([]);
      return;
    }
    (async () => {
      const res = await fetch("/api/passes/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudent.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStudentPasses((data.passes ?? []) as any[]);
    })();
  }, [selectedStudent]);

  useEffect(() => {
    if (!editRangeOpen || !editRangeClassId || !editRangeStart || !editRangeEnd) return;
    setEditRangeLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/schedule/list?start=${editRangeStart}&end=${editRangeEnd}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        const entries = (data.entries ?? []) as ScheduleInstance[];
        const dates = entries
          .filter((e) => e.class_id === editRangeClassId)
          .map((e) => e.session_date)
          .filter(Boolean);
        const unique = Array.from(new Set(dates)).sort();
        setEditRangeOptions(unique);
      } catch {
        setEditRangeOptions([]);
      } finally {
        setEditRangeLoading(false);
      }
    })();
  }, [editRangeOpen, editRangeClassId, editRangeStart, editRangeEnd]);

  async function createClass() {
    if (!newClassName.trim() || !newClassLocationId) return;
    setMsg("");
    const res = await fetch("/api/classes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClassName.trim(),
        location_id: newClassLocationId,
        pass_type_ids: newClassPassIds,
        class_color: newClassColor,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to create class");
    setNewClassName("");
    setNewClassColor("#2563eb");
    setNewClassPassIds([]);
    await loadAll();
  }

  async function createPass() {
    if (!newPassName.trim()) return;
    setMsg("");
    const res = await fetch("/api/passes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPassName.trim(), description: newPassDesc.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to create pass");
    setNewPassName("");
    setNewPassDesc("");
    const list = await fetch("/api/passes/list", { cache: "no-store" }).then((r) => r.json());
    setPasses((list.passes ?? []) as PassType[]);
  }

  function isEndAfterStart(start: string, end: string) {
    const [sh, sm] = String(start).split(":").map(Number);
    const [eh, em] = String(end).split(":").map(Number);
    if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return true;
    return eh * 60 + em > sh * 60 + sm;
  }

  function parseBreakDates(input: string) {
    const raw = input.trim();
    if (!raw) return [];
    const results: string[] = [];
    const yearMatches = Array.from(raw.matchAll(/(\d{4})\s*\(([^)]+)\)/g));
    if (yearMatches.length) {
      yearMatches.forEach((match) => {
        const year = match[1];
        const days = match[2]
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean);
        days.forEach((d) => {
          const cleaned = d.replace(/\//g, "-");
          const parts = cleaned.split("-").map((p) => p.trim());
          if (parts.length === 2) {
            const mm = parts[0].padStart(2, "0");
            const dd = parts[1].padStart(2, "0");
            results.push(`${year}-${mm}-${dd}`);
          } else if (parts.length === 3) {
            results.push(`${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`);
          }
        });
      });
    }

    raw
      .split(/[,;\n]/)
      .map((d) => d.trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .forEach((d) => results.push(d));

    return Array.from(new Set(results));
  }

  function openRangeEdit(item: ScheduleInstance) {
    setEditRangeClassId(item.class_id);
    setEditRangeClassName(item.class_name || "Class");
    setEditRangeStart(item.session_date);
    setEditRangeEnd(item.session_date);
    setEditRangeStartTime(item.start_time || "");
    setEditRangeEndTime(item.end_time || "");
    setEditRangeInstructor(item.instructor_name || "");
    setEditRangeRoom(item.room_name || "");
    setEditRangeMode("edit");
    setEditRangeExceptions([]);
    setEditRangeOptions([]);
    setEditRangeOpen(true);
  }

  async function updateRange() {
    if (!editRangeClassId || !editRangeStart || !editRangeEnd) return;
    setDetailMsg("");
    const res = await fetch("/api/schedule/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: editRangeClassId,
        start_date: editRangeStart,
        end_date: editRangeEnd,
        exceptions: editRangeExceptions,
        patch: {
          start_time: editRangeMode === "edit" ? editRangeStartTime || undefined : undefined,
          end_time: editRangeMode === "edit" ? (editRangeEndTime || null) : undefined,
          instructor_name: editRangeMode === "edit" ? (editRangeInstructor || null) : undefined,
          room_name: editRangeMode === "edit" ? (editRangeRoom || null) : undefined,
          is_cancelled: editRangeMode === "cancel",
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDetailMsg(data?.error || "Failed to update classes");
      return;
    }
    setEditRangeOpen(false);
    await refreshCalendar();
    await loadAll();
  }

  async function createEntry() {
    if (!formClassId || !formLocationId || !selectedDays.length || !rangeStart || !rangeEnd) return;
    setMsg("");
    setScheduleStatus("saving");
    const invalidDay = selectedDays.find((day) => {
      const start = dayTimes[day]?.start || baseStart;
      const end = dayTimes[day]?.end || baseEnd;
      return !isEndAfterStart(start, end);
    });
    if (typeof invalidDay === "number") {
      setMsg(`End time must be after start time (${dayLabels[invalidDay]}).`);
      setScheduleStatus("idle");
      return;
    }

    const breakDates = parseBreakDates(breakDatesInput);
    const selectedInstructorNames = selectedInstructorIds
      .map((id) => eligibleInstructorPool.find((row) => row.user_id === id))
      .filter(Boolean)
      .map((row) => formatStaffName(row as StaffRow));
    const instructorNamePayload = selectedInstructorNames.length
      ? selectedInstructorNames.join(", ")
      : (formInstructor || null);
    const normalizedType = (() => {
      const kind = normalizeEntryType(formEntryType);
      if (kind === "small group") return "Small Group";
      if (kind === "private") return "Private";
      if (kind === "event") return "Event";
      if (kind === "test") return "Test";
      return "Class";
    })();
    const payloads = selectedDays.map((day) => ({
      class_id: formClassId,
      location_id: formLocationId,
      day_of_week: day,
      start_time: dayTimes[day]?.start || baseStart,
      end_time: dayTimes[day]?.end || baseEnd || null,
      start_date: rangeStart,
      end_date: rangeEnd,
      instructor_name: instructorNamePayload,
      room_name: formRoom || null,
      entry_type: normalizedType,
      break_dates: breakDates,
    }));

    const results = await Promise.all(
      payloads.map((body) =>
        fetch("/api/schedule/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      )
    );

    const failed = results.find((r) => !r.ok);
    if (failed) {
      setScheduleStatus("idle");
      return setMsg(failed.data?.error || "Failed to create schedule");
    }
    setBreakDatesInput("");
    await loadAll();
    setScheduleStatus("scheduled");
    if (scheduleStatusTimer.current) window.clearTimeout(scheduleStatusTimer.current);
    scheduleStatusTimer.current = window.setTimeout(() => setScheduleStatus("idle"), 1800);
  }

  async function removeEntry(id: string) {
    setMsg("");
    const res = await fetch("/api/schedule/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to delete");
    await loadAll();
  }


  const timeSlots = useMemo(() => {
    const times = Array.from(new Set(entries.map((e) => e.start_time))).sort(timeSort);
    return times;
  }, [entries]);

  const instructorOptions = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.instructor_name).filter(Boolean))) as string[];
  }, [entries]);

  const coachRoster = useMemo(() => {
    return staff.filter((row) => {
      const configuredRole = staffMeta[row.user_id]?.roleTag;
      if (configuredRole === "coach") return true;
      if (configuredRole === "staff") return false;
      const roles = (row.roles ?? []).map((r) => String(r).toLowerCase());
      return row.is_coach || roles.includes("coach") || String(row.role ?? "").toLowerCase() === "coach";
    });
  }, [staff, staffMeta]);

  const staffRoster = useMemo(() => {
    return staff.filter((row) => {
      const configuredRole = staffMeta[row.user_id]?.roleTag;
      if (configuredRole === "coach" || configuredRole === "staff") return true;
      const roles = (row.roles ?? []).map((r) => String(r).toLowerCase());
      const isCoach = row.is_coach || roles.includes("coach") || String(row.role ?? "").toLowerCase() === "coach";
      const isAdminOrStaff =
        row.is_staff || roles.includes("admin") || roles.includes("staff") || ["admin", "staff"].includes(String(row.role ?? "").toLowerCase());
      return isCoach || isAdminOrStaff;
    });
  }, [staff, staffMeta]);

  const eligibleInstructorPool = useMemo(() => {
    const kind = normalizeEntryType(formEntryType);
    const source =
      ["class", "private", "small group"].includes(kind) ? coachRoster :
      ["event", "test"].includes(kind) ? staffRoster :
      coachRoster;
    return source.filter((row) => {
      const meta = staffMeta[row.user_id];
      if (!meta || !Array.isArray(meta.services) || !meta.services.length) return true;
      const normalized = meta.services.map((svc) => normalizeEntryType(svc));
      return normalized.includes(kind);
    });
  }, [coachRoster, formEntryType, staffMeta, staffRoster]);

  useEffect(() => {
    setSelectedInstructorIds((prev) =>
      prev.filter((id) => eligibleInstructorPool.some((row) => row.user_id === id))
    );
  }, [eligibleInstructorPool]);

  const roomOptions = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.room_name).filter(Boolean))) as string[];
  }, [entries]);

  const classColors = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c: any) => {
      if (c.class_color) map.set(String(c.id), String(c.class_color));
    });
    return map;
  }, [classes]);

  const monthCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);
  const filteredCalendarEntries = useMemo(() => {
    const classNeedle = calendarClassFilter.trim().toLowerCase();
    const instructorNeedle = calendarInstructorFilter.trim().toLowerCase();
    const roomNeedle = calendarRoomFilter.trim().toLowerCase();
    return calendarEntries.filter((entry) => {
      if (classNeedle && !String(entry.class_name ?? "").toLowerCase().includes(classNeedle)) return false;
      if (instructorNeedle && !String(entry.instructor_name ?? "").toLowerCase().includes(instructorNeedle)) return false;
      if (roomNeedle && !String(entry.room_name ?? "").toLowerCase().includes(roomNeedle)) return false;
      return true;
    });
  }, [calendarClassFilter, calendarEntries, calendarInstructorFilter, calendarRoomFilter]);
  const calendarByDate = useMemo(() => {
    const map = new Map<string, ScheduleInstance[]>();
    filteredCalendarEntries.forEach((entry) => {
      const date = String(entry.session_date);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(entry);
    });
    map.forEach((list) => list.sort((a, b) => timeSort(a.start_time, b.start_time)));
    return map;
  }, [filteredCalendarEntries]);

  async function updateInstance(
    id: string,
    patch: Partial<ScheduleInstance>,
    originalDateOverride?: string,
    instanceOverride?: ScheduleInstance
  ) {
    setDetailMsg("");
    const instance = instanceOverride ?? calendarEntries.find((row) => row.id === id);
    if (instance) {
      if (!("start_time" in patch)) patch.start_time = instance.start_time;
      if (!("end_time" in patch)) patch.end_time = instance.end_time ?? null;
      if (!("instructor_name" in patch)) patch.instructor_name = instance.instructor_name ?? null;
      if (!("room_name" in patch)) patch.room_name = instance.room_name ?? null;
    }
    const res = await fetch("/api/schedule/instance/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        schedule_entry_id: instance?.schedule_entry_id,
        session_date: patch.session_date ?? instance?.session_date,
        original_date: originalDateOverride ?? instance?.session_date,
        class_id: instance?.class_id,
        location_id: instance?.location_id,
        ...patch,
      }),
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Request failed (${res.status})` };
    }
    if (!res.ok) {
      const errMsg = data?.error || `Failed to update (${res.status})`;
      setDetailMsg(errMsg);
      setSaveToast(errMsg);
      window.setTimeout(() => setSaveToast(""), 2200);
      return;
    }
    const updatedInstance = data?.instance as ScheduleInstance | null | undefined;
    setCalendarEntries((prev) => {
      const next = prev.map((row) => {
        const rowKey =
          row.schedule_entry_id && row.session_date ? `${row.schedule_entry_id}-${row.session_date}` : row.id;
        const updatedKey =
          updatedInstance?.schedule_entry_id && updatedInstance?.session_date
            ? `${updatedInstance.schedule_entry_id}-${updatedInstance.session_date}`
            : updatedInstance?.id ?? id;
        if (row.id === id || rowKey === updatedKey) {
          return {
            ...row,
            ...patch,
            ...(updatedInstance ?? {}),
            id: updatedInstance?.id ?? row.id,
            is_fallback: updatedInstance ? false : row.is_fallback,
          } as ScheduleInstance;
        }
        return row;
      });
      const deduped = new Map<string, ScheduleInstance>();
      next.forEach((row) => {
        const key = row.schedule_entry_id && row.session_date ? `${row.schedule_entry_id}-${row.session_date}` : row.id;
        const existing = deduped.get(key);
        if (!existing || (existing.is_fallback && !row.is_fallback)) {
          deduped.set(key, row);
        }
      });
      return Array.from(deduped.values());
    });
    setDetailMsg(updatedInstance ? "Saved." : "Saved (no instance returned).");
    setSaveToast(updatedInstance ? "Saved changes." : "Saved, but no instance returned.");
    window.setTimeout(() => setSaveToast(""), 1400);
    refreshCalendar();
  }

  async function cancelInstance(item: ScheduleInstance) {
    if (!window.confirm(`Remove ${item.class_name} from ${item.session_date}?`)) return;
    await updateInstance(item.id, { is_cancelled: true }, item.session_date, item);
  }

  function onCardDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropDay(e: React.DragEvent, date: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const instance = calendarEntries.find((row) => row.id === id);
    setCalendarEntries((prev) =>
      prev.map((row) => (row.id === id ? { ...row, session_date: date } : row))
    );
    updateInstance(id, { session_date: date }, instance?.session_date, instance);
  }

  function onDropTime(e: React.DragEvent, slotTime: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const instance = calendarEntries.find((row) => row.id === id);
    if (!instance) return;
    const duration = calcDuration(instance.start_time, instance.end_time);
    const newEnd = minutesToTime(timeToMinutes(slotTime) + duration);
    updateInstance(id, { start_time: slotTime, end_time: newEnd }, undefined, instance);
  }

  async function assignPassToStudent() {
    if (!selectedStudent?.id || !assignPassId || !assignStart) return;
    setMsg("");
    const res = await fetch("/api/passes/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: selectedStudent.id,
        pass_type_id: assignPassId,
        valid_from: assignStart,
        valid_to: assignEnd || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to assign pass");
    setAssignPassId("");
    setAssignStart("");
    setAssignEnd("");
    const list = await fetch("/api/passes/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: selectedStudent.id }),
    }).then((r) => r.json());
    setStudentPasses((list.passes ?? []) as any[]);
  }

  async function createLocation() {
    const name = newLocationName.trim();
    if (!name) return;
    setMsg("");
    const res = await fetch("/api/locations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        timezone: newLocationTimezone.trim() || null,
        address_line1: newLocationAddress1.trim() || null,
        address_line2: newLocationAddress2.trim() || null,
        city: newLocationCity.trim() || null,
        state: newLocationState.trim() || null,
        postal_code: newLocationPostal.trim() || null,
        country: newLocationCountry.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to create location");
    setNewLocationName("");
    setNewLocationTimezone("");
    setNewLocationAddress1("");
    setNewLocationAddress2("");
    setNewLocationCity("");
    setNewLocationState("");
    setNewLocationPostal("");
    setNewLocationCountry("");
    loadAll();
  }

  async function saveLocation(id: string) {
    const draft = locationDrafts[id];
    if (!draft) return;
    setMsg("");
    const res = await fetch("/api/locations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: String(draft.name ?? "").trim(),
        timezone: String(draft.timezone ?? "").trim() || null,
        address_line1: String(draft.address_line1 ?? "").trim() || null,
        address_line2: String(draft.address_line2 ?? "").trim() || null,
        city: String(draft.city ?? "").trim() || null,
        state: String(draft.state ?? "").trim() || null,
        postal_code: String(draft.postal_code ?? "").trim() || null,
        country: String(draft.country ?? "").trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to update location");
    setMsg("Location updated.");
    await loadAll();
  }

  async function saveStaffProfile(userId: string) {
    const row = staffMeta[userId] ?? defaultStaffMeta("coach");
    setMsg("");
    const res = await fetch("/api/admin/staff/schedule-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        availability_hours: serializeStaffMetaHours(row),
        services: row.services,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to save staff profile");
    setMsg("Staff profile updated.");
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={pageHeader()}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 1000 }}>Schedule Builder</div>
          <div style={{ opacity: 0.72, fontSize: 14 }}>
            Build classes, locations, and weekly schedules with a faster flow.
          </div>
        </div>
        <div style={headerChip()}>v2</div>
      </div>

      {msg && (
        <div style={{ padding: 10, borderRadius: 14, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {msg}
        </div>
      )}
      {saveToast ? (
        <div style={saveToastStyle()}>{saveToast}</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <div style={card()}>
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Locations</div>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="Location name"
              style={input()}
            />
            <input
              value={newLocationTimezone}
              onChange={(e) => setNewLocationTimezone(e.target.value)}
              placeholder="Timezone (optional)"
              style={input()}
            />
            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={newLocationAddress1}
                onChange={(e) => setNewLocationAddress1(e.target.value)}
                placeholder="Address line 1"
                style={input()}
              />
              <input
                value={newLocationAddress2}
                onChange={(e) => setNewLocationAddress2(e.target.value)}
                placeholder="Address line 2"
                style={input()}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={newLocationCity}
                  onChange={(e) => setNewLocationCity(e.target.value)}
                  placeholder="City"
                  style={input()}
                />
                <input
                  value={newLocationState}
                  onChange={(e) => setNewLocationState(e.target.value)}
                  placeholder="State / Region"
                  style={input()}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={newLocationPostal}
                  onChange={(e) => setNewLocationPostal(e.target.value)}
                  placeholder="Postal code"
                  style={input()}
                />
                <input
                  value={newLocationCountry}
                  onChange={(e) => setNewLocationCountry(e.target.value)}
                  placeholder="Country"
                  style={input()}
                />
              </div>
            </div>
            <button onClick={createLocation} style={btn()}>
              Add Location
            </button>
            <div style={{ display: "grid", gap: 8 }}>
              {locations.map((loc) => (
                <div key={loc.id} style={locationCard()}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      value={String(locationDrafts[loc.id]?.name ?? "")}
                      onChange={(e) =>
                        setLocationDrafts((prev) => ({
                          ...prev,
                          [loc.id]: { ...(prev[loc.id] ?? {}), name: e.target.value },
                        }))
                      }
                      placeholder="Location name"
                      style={input()}
                    />
                    <input
                      value={String(locationDrafts[loc.id]?.timezone ?? "")}
                      onChange={(e) =>
                        setLocationDrafts((prev) => ({
                          ...prev,
                          [loc.id]: { ...(prev[loc.id] ?? {}), timezone: e.target.value },
                        }))
                      }
                      placeholder="Timezone"
                      style={input()}
                    />
                    <input
                      value={String(locationDrafts[loc.id]?.address_line1 ?? "")}
                      onChange={(e) =>
                        setLocationDrafts((prev) => ({
                          ...prev,
                          [loc.id]: { ...(prev[loc.id] ?? {}), address_line1: e.target.value },
                        }))
                      }
                      placeholder="Address line 1"
                      style={input()}
                    />
                    <input
                      value={String(locationDrafts[loc.id]?.address_line2 ?? "")}
                      onChange={(e) =>
                        setLocationDrafts((prev) => ({
                          ...prev,
                          [loc.id]: { ...(prev[loc.id] ?? {}), address_line2: e.target.value },
                        }))
                      }
                      placeholder="Address line 2"
                      style={input()}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        value={String(locationDrafts[loc.id]?.city ?? "")}
                        onChange={(e) =>
                          setLocationDrafts((prev) => ({
                            ...prev,
                            [loc.id]: { ...(prev[loc.id] ?? {}), city: e.target.value },
                          }))
                        }
                        placeholder="City"
                        style={input()}
                      />
                      <input
                        value={String(locationDrafts[loc.id]?.state ?? "")}
                        onChange={(e) =>
                          setLocationDrafts((prev) => ({
                            ...prev,
                            [loc.id]: { ...(prev[loc.id] ?? {}), state: e.target.value },
                          }))
                        }
                        placeholder="State / Region"
                        style={input()}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        value={String(locationDrafts[loc.id]?.postal_code ?? "")}
                        onChange={(e) =>
                          setLocationDrafts((prev) => ({
                            ...prev,
                            [loc.id]: { ...(prev[loc.id] ?? {}), postal_code: e.target.value },
                          }))
                        }
                        placeholder="Postal code"
                        style={input()}
                      />
                      <input
                        value={String(locationDrafts[loc.id]?.country ?? "")}
                        onChange={(e) =>
                          setLocationDrafts((prev) => ({
                            ...prev,
                            [loc.id]: { ...(prev[loc.id] ?? {}), country: e.target.value },
                          }))
                        }
                        placeholder="Country"
                        style={input()}
                      />
                    </div>
                    <button onClick={() => saveLocation(loc.id)} style={btnGhost()}>
                      Save Location
                    </button>
                  </div>
                </div>
              ))}
              {!locations.length ? <div style={{ opacity: 0.7 }}>No locations yet.</div> : null}
            </div>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Create Class</div>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Class name"
              style={input()}
            />
            <select value={newClassLocationId} onChange={(e) => setNewClassLocationId(e.target.value)} style={input()}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="color" value={newClassColor} onChange={(e) => setNewClassColor(e.target.value)} style={colorInput()} />
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>Calendar card color</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Allowed Passes</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {passes.map((p) => {
                const selected = newClassPassIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setNewClassPassIds((prev) =>
                        selected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    style={{
                      ...pill(),
                      background: selected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                      border: selected ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
              {!passes.length && <div style={{ opacity: 0.7 }}>No passes yet.</div>}
            </div>
            <button onClick={createClass} style={btn()}>
              Create Class
            </button>
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Staff & Coach Roster</div>
          <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 8 }}>
            Schedule builder uses this list. Class/Private/Small Group = coaches only. Event/Test = coach + staff.
          </div>
          <div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
            {staffRoster.map((row) => {
              const defaultRole: "coach" | "staff" = row.is_coach ? "coach" : "staff";
              const meta = staffMeta[row.user_id] ?? defaultStaffMeta(defaultRole);
              const label = formatStaffName(row);
              return (
                <div key={row.user_id} style={entryCard()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{label}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ ...miniPill("coach"), cursor: "pointer", opacity: meta.roleTag === "coach" ? 1 : 0.55 }}
                        onClick={() =>
                          setStaffMeta((prev) => {
                            const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                            return { ...prev, [row.user_id]: { ...current, roleTag: "coach" } };
                          })
                        }
                      >
                        Coach
                      </button>
                      <button
                        type="button"
                        style={{ ...miniPill("staff"), cursor: "pointer", opacity: meta.roleTag === "staff" ? 1 : 0.55 }}
                        onClick={() =>
                          setStaffMeta((prev) => {
                            const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                            return { ...prev, [row.user_id]: { ...current, roleTag: "staff" } };
                          })
                        }
                      >
                        Staff
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Availability (Sun-Sat)</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {dayLabels.map((day, dayIndex) => {
                        const slot = meta.availability[dayIndex] ?? { enabled: false, start: "16:00", end: "20:00" };
                        return (
                          <div key={`${row.user_id}-${day}`} style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: 8, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() =>
                                setStaffMeta((prev) => {
                                  const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                                  const next = current.availability[dayIndex] ?? slot;
                                  return {
                                    ...prev,
                                    [row.user_id]: {
                                      ...current,
                                      availability: { ...current.availability, [dayIndex]: { ...next, enabled: !next.enabled } },
                                    },
                                  };
                                })
                              }
                              style={{
                                ...pill(),
                                fontSize: 11,
                                background: slot.enabled ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                                border: slot.enabled ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(255,255,255,0.12)",
                              }}
                            >
                              {day}
                            </button>
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) =>
                                setStaffMeta((prev) => {
                                  const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                                  const next = current.availability[dayIndex] ?? slot;
                                  return {
                                    ...prev,
                                    [row.user_id]: {
                                      ...current,
                                      availability: { ...current.availability, [dayIndex]: { ...next, start: e.target.value } },
                                    },
                                  };
                                })
                              }
                              style={input()}
                            />
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) =>
                                setStaffMeta((prev) => {
                                  const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                                  const next = current.availability[dayIndex] ?? slot;
                                  return {
                                    ...prev,
                                    [row.user_id]: {
                                      ...current,
                                      availability: { ...current.availability, [dayIndex]: { ...next, end: e.target.value } },
                                    },
                                  };
                                })
                              }
                              style={input()}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <input
                    value={meta.hours}
                    onChange={(e) =>
                      setStaffMeta((prev) => {
                        const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                        return { ...prev, [row.user_id]: { ...current, hours: e.target.value } };
                      })
                    }
                    placeholder="Optional notes (private lessons, constraints, etc.)"
                    style={input()}
                  />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {serviceOptions.map((svc) => {
                      const selected = meta.services.includes(svc);
                      return (
                        <button
                          key={`${row.user_id}-${svc}`}
                          type="button"
                          onClick={() =>
                            setStaffMeta((prev) => {
                              const current = prev[row.user_id] ?? defaultStaffMeta(defaultRole);
                              const next = current.services.includes(svc)
                                ? current.services.filter((v) => v !== svc)
                                : [...current.services, svc];
                              return { ...prev, [row.user_id]: { ...current, services: next } };
                            })
                          }
                          style={{
                            ...pill(),
                            fontSize: 11,
                            background: selected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                            border: selected ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(255,255,255,0.12)",
                          }}
                        >
                          {svc}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => saveStaffProfile(row.user_id)} style={btnGhost()}>
                      Save Staff Profile
                    </button>
                  </div>
                </div>
              );
            })}
            {!staffRoster.length ? <div style={{ opacity: 0.7 }}>No staff/coach accounts found.</div> : null}
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Schedule Entry</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>Entry type</div>
            <select value={formEntryType} onChange={(e) => setFormEntryType(e.target.value)} style={input()}>
              {serviceOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={formClassId} onChange={(e) => setFormClassId(e.target.value)} style={input()}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={formLocationId} onChange={(e) => setFormLocationId(e.target.value)} style={input()}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Timezone: {activeLocation?.timezone || "Not set"} • Date range is inclusive
            </div>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>Date range</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} style={input()} />
              <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} style={input()} />
            </div>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>
              Break dates (YYYY (MM-DD, MM-DD) or YYYY-MM-DD)
            </div>
            <input
              value={breakDatesInput}
              onChange={(e) => setBreakDatesInput(e.target.value)}
              placeholder="2025 (01-12, 02-09), 2026 (03-01)"
              style={input()}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                type="time"
                value={baseStart}
                onChange={(e) => {
                  const next = e.target.value;
                  setBaseStart(next);
                  setDayTimes((prev) => {
                    const updated = { ...prev };
                    selectedDays.forEach((day) => {
                      updated[day] = { start: next, end: updated[day]?.end || baseEnd };
                    });
                    return updated;
                  });
                }}
                style={input()}
              />
              <input
                type="time"
                value={baseEnd}
                onChange={(e) => {
                  const next = e.target.value;
                  setBaseEnd(next);
                  setDayTimes((prev) => {
                    const updated = { ...prev };
                    selectedDays.forEach((day) => {
                      updated[day] = { start: updated[day]?.start || baseStart, end: next };
                    });
                    return updated;
                  });
                }}
                style={input()}
              />
            </div>
            <button
              onClick={() => {
                if (!selectedDays.length) return;
                const firstStart = baseStart;
                const firstEnd = baseEnd;
                setDayTimes((prev) => {
                  const next = { ...prev };
                  selectedDays.forEach((day) => {
                    next[day] = { start: firstStart, end: firstEnd };
                  });
                  return next;
                });
              }}
              style={btnGhost()}
            >
              Same time for all days
            </button>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Repeat Days</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {dayLabels.map((d, i) => {
                  const selected = selectedDays.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setSelectedDays((prev) =>
                          prev.includes(i) ? prev.filter((v) => v !== i) : [...prev, i]
                        );
                        setDayTimes((prev) => {
                          const next = { ...prev };
                          if (!next[i]) next[i] = { start: baseStart, end: baseEnd };
                          return next;
                        });
                      }}
                      style={{
                        ...pill(),
                        background: selected ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.08)",
                        border: selected ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {selectedDays.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                  {selectedDays.map((day) => (
                    <div key={`day-${day}`} style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{dayLabels[day]}</div>
                      <input
                        type="time"
                        value={dayTimes[day]?.start || baseStart}
                        onChange={(e) =>
                          setDayTimes((prev) => ({ ...prev, [day]: { start: e.target.value, end: prev[day]?.end || baseEnd } }))
                        }
                        style={input()}
                      />
                      <input
                        type="time"
                        value={dayTimes[day]?.end || baseEnd}
                        onChange={(e) =>
                          setDayTimes((prev) => ({ ...prev, [day]: { start: prev[day]?.start || baseStart, end: e.target.value } }))
                        }
                        style={input()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>
                Instructors ({["class", "private", "small group"].includes(normalizeEntryType(formEntryType)) ? "Coach only" : "Coach + Staff"})
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {eligibleInstructorPool.map((row) => {
                  const selected = selectedInstructorIds.includes(row.user_id);
                  return (
                    <button
                      key={row.user_id}
                      type="button"
                      onClick={() =>
                        setSelectedInstructorIds((prev) =>
                          prev.includes(row.user_id) ? prev.filter((id) => id !== row.user_id) : [...prev, row.user_id]
                        )
                      }
                      style={{
                        ...pill(),
                        fontSize: 11,
                        background: selected ? "rgba(14,165,233,0.24)" : "rgba(255,255,255,0.08)",
                        border: selected ? "1px solid rgba(56,189,248,0.55)" : "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {formatStaffName(row)}
                    </button>
                  );
                })}
                {!eligibleInstructorPool.length ? <div style={{ opacity: 0.7, fontSize: 12 }}>No eligible instructors</div> : null}
              </div>
              <input
                list="instructor-options"
                value={formInstructor}
                onChange={(e) => setFormInstructor(e.target.value)}
                placeholder="Optional custom/extra instructor text"
                style={input()}
              />
              <datalist id="instructor-options">
                {instructorOptions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <input
              list="room-options"
              value={formRoom}
              onChange={(e) => setFormRoom(e.target.value)}
              placeholder="Room name / number"
              style={input()}
            />
            <datalist id="room-options">
              {roomOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button
              onClick={createEntry}
              style={{
                ...btn(),
                background:
                  scheduleStatus === "scheduled"
                    ? "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.85))"
                    : btn().background,
              }}
            >
              {scheduleStatus === "saving" ? "Scheduling..." : scheduleStatus === "scheduled" ? "Scheduled ✓" : "Schedule Entry"}
            </button>
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Pass Types</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            value={newPassName}
            onChange={(e) => setNewPassName(e.target.value)}
            placeholder="Pass name"
            style={input()}
          />
          <input
            value={newPassDesc}
            onChange={(e) => setNewPassDesc(e.target.value)}
            placeholder="Description"
            style={input()}
          />
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={createPass} style={btn()}>
            Add Pass
          </button>
          {passes.map((p) => (
            <div key={p.id} style={{ ...pill(), cursor: "default" }}>
              {p.name}
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Assign Pass to Student</div>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Search student name"
            style={input()}
          />
          {studentResults.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {studentResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudent(s);
                    setStudentQuery(s.name);
                    setStudentResults([]);
                  }}
                  style={pill()}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : null}

          {selectedStudent ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Selected: {selectedStudent.name}</div>
              <select value={assignPassId} onChange={(e) => setAssignPassId(e.target.value)} style={input()}>
                <option value="">Select pass</option>
                {passes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input type="date" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} style={input()} />
                <input type="date" value={assignEnd} onChange={(e) => setAssignEnd(e.target.value)} style={input()} />
              </div>
              <button onClick={assignPassToStudent} style={btn()}>
                Assign Pass
              </button>
              <div style={{ fontWeight: 900, marginTop: 8 }}>Current Passes</div>
              <div style={{ display: "grid", gap: 6 }}>
                {studentPasses.map((p) => (
                  <div key={p.id} style={entryCard()}>
                    <div style={{ fontWeight: 900 }}>{p.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>
                      {p.valid_from} → {p.valid_to ?? "Open"} {p.active ? "" : "• Inactive"}
                    </div>
                  </div>
                ))}
                {!studentPasses.length && <div style={{ opacity: 0.7 }}>No passes assigned.</div>}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 1000 }}>Monthly Calendar</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              style={btnGhost()}
            >
              Prev
            </button>
            <div style={{ fontWeight: 900 }}>
              {calendarMonth.toLocaleString("default", { month: "long" })} {calendarMonth.getFullYear()}
            </div>
            <button
              onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              style={btnGhost()}
            >
              Next
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
          <input
            style={input()}
            placeholder="Filter class name"
            value={calendarClassFilter}
            onChange={(e) => setCalendarClassFilter(e.target.value)}
          />
          <input
            style={input()}
            placeholder="Filter instructor"
            list="calendar-instructor-options"
            value={calendarInstructorFilter}
            onChange={(e) => setCalendarInstructorFilter(e.target.value)}
          />
          <input
            style={input()}
            placeholder="Filter room"
            list="calendar-room-options"
            value={calendarRoomFilter}
            onChange={(e) => setCalendarRoomFilter(e.target.value)}
          />
          <button
            style={btnGhost()}
            onClick={() => {
              setCalendarClassFilter("");
              setCalendarInstructorFilter("");
              setCalendarRoomFilter("");
            }}
          >
            Clear filters
          </button>
        </div>
        <datalist id="calendar-instructor-options">
          {instructorOptions.map((n) => (
            <option key={`calendar-instructor-${n}`} value={n} />
          ))}
        </datalist>
        <datalist id="calendar-room-options">
          {roomOptions.map((n) => (
            <option key={`calendar-room-${n}`} value={n} />
          ))}
        </datalist>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {dayLabels.map((d) => (
            <div key={d} style={{ fontWeight: 900, textAlign: "center", opacity: 0.8 }}>
              {d}
            </div>
          ))}
          {monthCells.map((cell, idx) => {
            if (!cell) return <div key={`blank-${idx}`} style={calendarEmptyCell()} />;
            const items = calendarByDate.get(cell) ?? [];
            const isToday = cell === todayKey;
            return (
              <div
                key={cell}
                style={{
                  ...calendarCell(),
                  boxShadow: isToday ? "0 0 0 1px rgba(59,130,246,0.8), 0 0 24px rgba(59,130,246,0.35)" : undefined,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropDay(e, cell)}
                onClick={() => setActiveDay(cell)}
              >
                <div style={{ fontWeight: 900, fontSize: 12 }}>{Number(cell.slice(-2))}</div>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {items.map((item, idx) => {
                    const timeLabel = item.end_time
                      ? `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`
                      : formatTime(item.start_time);
                    const durationLabel = `${calcDuration(item.start_time, item.end_time)} min`;
                    return (
                      <div
                        key={`${item.id}-${item.session_date}-${item.start_time}-${idx}`}
                        style={calendarCard(classColors.get(String(item.class_id)))}
                        draggable
                        onDragStart={(e) => onCardDragStart(e, item.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 6 }}>
                          <div style={{ fontWeight: 900, fontSize: 11 }}>{item.class_name}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRangeEdit(item);
                              }}
                              style={miniEdit()}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelInstance(item);
                              }}
                              style={miniDelete()}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.75 }}>
                          {timeLabel} • {durationLabel}
                          {item.room_name ? ` • Room ${item.room_name}` : ""}
                        </div>
                        {item.instructor_name ? (
                          <div style={{ fontSize: 10, opacity: 0.75 }}>Coach {item.instructor_name}</div>
                        ) : null}
                        {passAccess[item.class_id]?.length ? (
                          <div style={{ fontSize: 9, fontWeight: 900, marginTop: 4, opacity: 0.85 }}>
                            Pass required
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!items.length && <div style={{ fontSize: 10, opacity: 0.4 }}>No classes</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Weekly Schedule</div>
        {!timeSlots.length && <div style={{ opacity: 0.7 }}>No schedule entries yet.</div>}
        {timeSlots.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "90px repeat(7, 1fr)", gap: 8 }}>
            <div />
            {dayLabels.map((d) => (
              <div key={d} style={{ fontWeight: 1000, textAlign: "center", opacity: 0.8 }}>
                {d}
              </div>
            ))}
            {timeSlots.map((t) => (
              <div key={t} style={{ display: "contents" }}>
                <div style={{ fontWeight: 1000, opacity: 0.8 }}>{formatTime(t)}</div>
                {dayLabels.map((_, dayIdx) => {
                  const hits = entries.filter((e) => e.day_of_week === dayIdx && e.start_time === t);
                  return (
                    <div key={`${t}-${dayIdx}`} style={cell()}>
                      {hits.map((h) => (
                        <div key={h.id} style={entryCard()}>
                          <div style={{ fontWeight: 1000 }}>{h.class_name}</div>
                          <div style={{ fontSize: 11, opacity: 0.75 }}>
                            {h.instructor_name || "Coach"} • {h.location_name}
                            {h.location_timezone ? ` • ${h.location_timezone}` : ""}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            {h.room_name ? `Room ${h.room_name}` : "Room —"}
                          </div>
                          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 11 }}>{formatTime(h.start_time)}</div>
                            <button onClick={() => removeEntry(h.id)} style={chipBtn()}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {activeDay ? (
        <div style={overlay()}>
          <div style={overlayCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 1000 }}>Edit {activeDay}</div>
              <button onClick={() => setActiveDay(null)} style={btnGhost()}>
                Close
              </button>
            </div>
            {detailMsg ? <div style={warn()}>{detailMsg}</div> : null}
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {(calendarByDate.get(activeDay) ?? []).map((item) => (
                <div
                  key={item.id}
                  style={entryCard()}
                  draggable
                  onDragStart={(e) => onCardDragStart(e, item.id)}
                >
                  <button onClick={() => cancelInstance(item)} style={linkDanger()}>
                    {item.class_name}
                  </button>
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        type="time"
                        value={item.start_time}
                        onChange={(e) => updateInstance(item.id, { start_time: e.target.value })}
                        style={input()}
                      />
                      <input
                        type="time"
                        value={item.end_time ?? ""}
                        onChange={(e) => updateInstance(item.id, { end_time: e.target.value })}
                        style={input()}
                      />
                    </div>
                    <input
                      value={item.instructor_name ?? ""}
                      onChange={(e) => updateInstance(item.id, { instructor_name: e.target.value })}
                      placeholder="Instructor"
                      style={input()}
                    />
                    <input
                      value={item.room_name ?? ""}
                      onChange={(e) => updateInstance(item.id, { room_name: e.target.value })}
                      placeholder="Room"
                      style={input()}
                    />
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Drag this card onto a time slot to adjust.</div>
                  </div>
                </div>
              ))}
              {!calendarByDate.get(activeDay)?.length && <div style={{ opacity: 0.7 }}>No classes on this day.</div>}
            </div>
            <div style={{ marginTop: 14, fontWeight: 1000 }}>Drag to adjust time</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {buildTimeSlots(6, 22, 30).map((slot) => (
                <div
                  key={slot}
                  style={timeSlot()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropTime(e, slot)}
                >
                  {formatTime(slot)}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {editRangeOpen ? (
        <div style={overlay()}>
          <div style={overlayCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 1000 }}>Edit {editRangeClassName} range</div>
              <button onClick={() => setEditRangeOpen(false)} style={btnGhost()}>
                Close
              </button>
            </div>
            {detailMsg ? <div style={warn()}>{detailMsg}</div> : null}
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setEditRangeMode("edit")} style={modeBtn(editRangeMode === "edit")}>
                  Edit details
                </button>
                <button onClick={() => setEditRangeMode("cancel")} style={modeBtn(editRangeMode === "cancel")}>
                  Cancel range
                </button>
              </div>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>Date range</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input type="date" value={editRangeStart} onChange={(e) => setEditRangeStart(e.target.value)} style={input()} />
                <input type="date" value={editRangeEnd} onChange={(e) => setEditRangeEnd(e.target.value)} style={input()} />
              </div>
              {editRangeMode === "edit" ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>Time</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input type="time" value={editRangeStartTime} onChange={(e) => setEditRangeStartTime(e.target.value)} style={input()} />
                    <input type="time" value={editRangeEndTime} onChange={(e) => setEditRangeEndTime(e.target.value)} style={input()} />
                  </div>
                  <input
                    value={editRangeInstructor}
                    onChange={(e) => setEditRangeInstructor(e.target.value)}
                    placeholder="Instructor"
                    style={input()}
                  />
                  <input
                    value={editRangeRoom}
                    onChange={(e) => setEditRangeRoom(e.target.value)}
                    placeholder="Room"
                    style={input()}
                  />
                </>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Canceling will mark all classes in this range as canceled.
                </div>
              )}
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>Exceptions</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Selected dates below will NOT be canceled or edited.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 8,
                  opacity: editRangeLoading ? 0.6 : 1,
                }}
              >
                {editRangeOptions.map((d) => {
                  const selected = editRangeExceptions.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setEditRangeExceptions((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      style={{
                        ...pill(),
                        background: selected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                        border: selected ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(255,255,255,0.12)",
                        textAlign: "center",
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
                {!editRangeOptions.length && !editRangeLoading ? (
                  <div style={{ opacity: 0.6, fontSize: 12 }}>No classes in this range.</div>
                ) : null}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setEditRangeOpen(false)} style={btnGhost()}>
                  Cancel
                </button>
                <button onClick={updateRange} style={btn()}>
                  {editRangeMode === "cancel" ? "Cancel Range" : "Update Range"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 24,
    padding: 18,
    background: "linear-gradient(135deg, rgba(15,23,42,0.7), rgba(2,6,23,0.78))",
    border: "1px solid rgba(148,163,184,0.2)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    outline: "none",
    fontSize: 14,
    fontWeight: 800,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "linear-gradient(120deg, rgba(59,130,246,0.95), rgba(14,165,233,0.7))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 14,
    letterSpacing: 0.2,
    boxShadow: "0 12px 20px rgba(30,64,175,0.25)",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(15,23,42,0.5)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  };
}

function linkDanger(): React.CSSProperties {
  return {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "rgba(248,113,113,0.95)",
    fontWeight: 1000,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
  };
}

function miniDelete(): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.45)",
    background: "rgba(248,113,113,0.15)",
    color: "rgba(248,113,113,0.95)",
    fontWeight: 900,
    cursor: "pointer",
    lineHeight: "16px",
    textAlign: "center",
    padding: 0,
  };
}

function miniEdit(): React.CSSProperties {
  return {
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 9,
    lineHeight: "12px",
  };
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 11,
  };
}

function miniPill(kind: "coach" | "staff"): React.CSSProperties {
  const coach = kind === "coach";
  return {
    padding: "3px 8px",
    borderRadius: 999,
    border: coach ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(250,204,21,0.45)",
    background: coach ? "rgba(14,165,233,0.18)" : "rgba(245,158,11,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  };
}

function pill(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(15,23,42,0.5)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  };
}

function colorInput(): React.CSSProperties {
  return {
    width: 52,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(15,23,42,0.5)",
    padding: 0,
  };
}

function pageHeader(): React.CSSProperties {
  return {
    borderRadius: 26,
    padding: "18px 22px",
    background: "linear-gradient(135deg, rgba(30,64,175,0.45), rgba(2,6,23,0.85))",
    border: "1px solid rgba(59,130,246,0.35)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };
}

function headerChip(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.22)",
    border: "1px solid rgba(59,130,246,0.55)",
    fontWeight: 900,
    fontSize: 12,
  };
}

function locationCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "10px 12px",
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(148,163,184,0.2)",
    display: "grid",
    gap: 4,
  };
}

function formatLocationAddress(loc: LocationRow) {
  const parts = [
    loc.address_line1,
    loc.address_line2,
    [loc.city, loc.state].filter(Boolean).join(", "),
    loc.postal_code,
    loc.country,
  ].filter(Boolean);
  return parts.join(" • ");
}

function cell(): React.CSSProperties {
  return {
    minHeight: 60,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 6,
  };
}

function entryCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 8,
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(255,255,255,0.12)",
    marginBottom: 6,
  };
}

function chipBtn(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 10,
  };
}

function saveToastStyle(): React.CSSProperties {
  return {
    position: "fixed",
    top: 84,
    right: 24,
    zIndex: 90,
    padding: "10px 14px",
    borderRadius: 14,
    background: "rgba(34,197,94,0.2)",
    border: "1px solid rgba(34,197,94,0.45)",
    color: "white",
    fontWeight: 900,
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  };
}

function calendarCell(): React.CSSProperties {
  return {
    minHeight: 120,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    padding: 8,
    display: "grid",
    alignContent: "start",
  };
}

function calendarEmptyCell(): React.CSSProperties {
  return {
    minHeight: 120,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
  };
}

function calendarCard(color?: string): React.CSSProperties {
  const base = color || "#2563eb";
  return {
    borderRadius: 10,
    padding: 6,
    background: `linear-gradient(135deg, ${withAlpha(base, 0.35)}, rgba(15,23,42,0.85))`,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "grab",
  };
}

function overlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.65)",
    zIndex: 80,
    display: "grid",
    placeItems: "center",
    padding: 20,
  };
}

function overlayCard(): React.CSSProperties {
  return {
    width: "min(920px, 94vw)",
    maxHeight: "90vh",
    overflow: "auto",
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(7,10,16,0.96)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
  };
}

function warn(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 12,
    background: "rgba(248,113,113,0.12)",
    border: "1px solid rgba(248,113,113,0.35)",
    color: "white",
    fontWeight: 900,
  };
}

function timeSlot(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
  };
}

function buildMonthCells(month: Date) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: Array<string | null> = Array(startOffset).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, m, day);
    cells.push(d.toISOString().slice(0, 10));
  }
  return cells;
}

function buildTimeSlots(startHour: number, endHour: number, stepMinutes: number) {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h += 1) {
    for (let m = 0; m < 60; m += stepMinutes) {
      const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      slots.push(slot);
    }
  }
  return slots;
}

function timeToMinutes(input: string) {
  const parts = String(input ?? "").split(":").map(Number);
  if (parts.length < 2) return 0;
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToTime(mins: number) {
  const clamped = Math.max(0, mins);
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function calcDuration(start: string, end?: string | null) {
  if (!end) return 60;
  const dur = timeToMinutes(end) - timeToMinutes(start);
  return dur > 0 ? dur : 60;
}

function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

function timeSort(a: string, b: string) {
  const toMin = (v: string) => {
    const parts = String(v ?? "").split(":").map(Number);
    if (parts.length < 2) return 0;
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  return toMin(a) - toMin(b);
}
