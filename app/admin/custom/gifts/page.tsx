"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DesignRow = {
  id: string;
  name: string;
  preview_image_url?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  created_at?: string;
  updated_at?: string;
};

type GiftItem = {
  id: string;
  name: string;
  category: string;
  category_tags?: string[] | null;
  package_components?: Array<{
    id?: string;
    component_category: string;
    component_name: string;
    component_points_value: number;
    component_design_id?: string | null;
    component_design_image_url?: string | null;
    component_design_html?: string | null;
    component_design_css?: string | null;
    component_design_js?: string | null;
    component_qty: number;
    component_order?: number;
  }> | null;
  gift_type: string;
  design_id?: string | null;
  design_image_url?: string | null;
  design_html?: string | null;
  design_css?: string | null;
  design_js?: string | null;
  points_value: number;
  enabled: boolean;
  gift_designs?: { id: string; name: string; preview_image_url?: string | null } | null;
  auto_assignment?: {
    id?: string;
    scope_type?: string;
    roster_id?: string | null;
    secondary_role?: string | null;
    day_codes?: string[] | null;
    time_et?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    qty?: number | null;
    student_ids?: string[] | null;
    enabled?: boolean;
  } | null;
};

type StudentPick = { id: string; name: string };
type GiftButtonSettings = {
  student_button_design_id?: string | null;
  student_button_image_url?: string | null;
  student_button_emoji?: string | null;
};
type StudentGiftStatusRow = {
  id: string;
  student_id: string;
  gift_item_id: string;
  qty: number;
  opened_qty: number;
  note?: string | null;
  created_at?: string;
  students?: { name?: string | null; points_total?: number | null } | null;
  gift_items?: { name?: string | null; category?: string | null; category_tags?: string[] | null; gift_type?: string | null; points_value?: number | null } | null;
  latest_open_event?: {
    id: string;
    points_awarded?: number | null;
    points_before_open?: number | null;
    points_after_open?: number | null;
    opened_at?: string | null;
  } | null;
};
type GiftLogRow = {
  id: string;
  student_id: string;
  student_gift_id: string;
  gift_item_id: string;
  points_awarded: number;
  points_before_open?: number | null;
  points_after_open?: number | null;
  opened_at: string;
  students?: { name?: string | null; points_total?: number | null } | null;
  gift_items?: { name?: string | null; category?: string | null; category_tags?: string[] | null; gift_type?: string | null } | null;
};
type PackageComponentDraft = {
  id: string;
  category: "item" | "points" | "discount" | "weapon" | "uniform";
  name: string;
  points_value: string;
  qty: string;
  design_id: string;
  design_image_url: string;
  design_html: string;
  design_css: string;
  design_js: string;
};

type CampRosterRow = {
  id: string;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  enabled?: boolean;
};

type CampMemberRow = {
  id: string;
  roster_id: string;
  student_id: string;
  student_name: string;
  secondary_role?: string;
  secondary_role_days?: string[];
};

type ScheduledPreviewRow = {
  student_id: string;
  student_name: string;
  next_run_label: string;
  is_future: boolean;
};

export default function GiftStudioPage() {
  const [msg, setMsg] = useState("");
  const [designs, setDesigns] = useState<DesignRow[]>([]);
  const [items, setItems] = useState<GiftItem[]>([]);

  const [designName, setDesignName] = useState("");
  const [designPreviewImage, setDesignPreviewImage] = useState("");
  const [designHtml, setDesignHtml] = useState("");
  const [designCss, setDesignCss] = useState("");
  const [designJs, setDesignJs] = useState("");

  const [giftName, setGiftName] = useState("");
  const [giftCategory, setGiftCategory] = useState("item");
  const [giftType, setGiftType] = useState("generic");
  const [giftDesignId, setGiftDesignId] = useState("");
  const [giftPoints, setGiftPoints] = useState("0");
  const [giftImageUrl, setGiftImageUrl] = useState("");
  const [giftHtml, setGiftHtml] = useState("");
  const [giftCss, setGiftCss] = useState("");
  const [giftJs, setGiftJs] = useState("");
  const [packageComponents, setPackageComponents] = useState<PackageComponentDraft[]>([]);
  const [autoGiftEnabled, setAutoGiftEnabled] = useState(false);
  const [autoScopeType, setAutoScopeType] = useState<"camp_secondary_role">("camp_secondary_role");
  const [autoRosterId, setAutoRosterId] = useState("");
  const [autoSecondaryRole, setAutoSecondaryRole] = useState("seller");
  const [autoDayCodes, setAutoDayCodes] = useState<string[]>(["m"]);
  const [autoTimeEt, setAutoTimeEt] = useState("16:00");
  const [autoStartDate, setAutoStartDate] = useState("");
  const [autoEndDate, setAutoEndDate] = useState("");
  const [autoStudentIds, setAutoStudentIds] = useState<string[]>([]);
  const [autoQty, setAutoQty] = useState("1");
  const [autoRunDry, setAutoRunDry] = useState(false);
  const [campRosters, setCampRosters] = useState<CampRosterRow[]>([]);
  const [campMembers, setCampMembers] = useState<CampMemberRow[]>([]);

  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentPick[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignGiftId, setAssignGiftId] = useState("");
  const [assignQty, setAssignQty] = useState("1");
  const [buttonDesignId, setButtonDesignId] = useState("");
  const [buttonImageUrl, setButtonImageUrl] = useState("");
  const [buttonEmoji, setButtonEmoji] = useState("🎁");
  const [statusStudentQuery, setStatusStudentQuery] = useState("");
  const [logRange, setLogRange] = useState<"7d" | "30d" | "all">("7d");
  const [statusRows, setStatusRows] = useState<StudentGiftStatusRow[]>([]);
  const [logRows, setLogRows] = useState<GiftLogRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [studioTab, setStudioTab] = useState<"button" | "designs" | "creator" | "assign" | "status">("button");
  const designUploadInputRef = useRef<HTMLInputElement | null>(null);
  const giftUploadInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const [dRes, iRes, bRes, cRes] = await Promise.all([
      fetch("/api/admin/gifts/designs", { cache: "no-store" }),
      fetch("/api/admin/gifts/items", { cache: "no-store" }),
      fetch("/api/admin/gifts/button-settings", { cache: "no-store" }),
      fetch("/api/admin/gifts/camp-context", { cache: "no-store" }),
    ]);
    const dj = await dRes.json().catch(() => ({}));
    const ij = await iRes.json().catch(() => ({}));
    const bj = await bRes.json().catch(() => ({}));
    const cj = await cRes.json().catch(() => ({}));
    if (!dRes.ok) return setMsg(String(dj?.error ?? "Failed to load designs"));
    if (!iRes.ok) return setMsg(String(ij?.error ?? "Failed to load gifts"));
    setDesigns((dj?.designs ?? []) as DesignRow[]);
    setItems((ij?.items ?? []) as GiftItem[]);
    if (cRes.ok) {
      setCampRosters((cj?.rosters ?? []) as CampRosterRow[]);
      setCampMembers((cj?.members ?? []) as CampMemberRow[]);
    }
    if (bRes.ok) {
      const settings = (bj?.settings ?? {}) as GiftButtonSettings;
      setButtonDesignId(String(settings?.student_button_design_id ?? ""));
      setButtonImageUrl(String(settings?.student_button_image_url ?? ""));
      setButtonEmoji(String(settings?.student_button_emoji ?? "🎁"));
    } else {
      setButtonDesignId("");
      setButtonImageUrl("");
      setButtonEmoji("🎁");
    }
    await loadStatusAndLogs();
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!studentQuery.trim()) {
      setStudentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: studentQuery.trim() }),
      });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setStudentResults((sj?.students ?? []).map((s: any) => ({ id: String(s.id), name: String(s.name ?? "Student") })));
    }, 180);
    return () => clearTimeout(t);
  }, [studentQuery]);

  async function saveDesign() {
    setMsg("");
    const res = await fetch("/api/admin/gifts/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: designName.trim(),
        preview_image_url: designPreviewImage.trim(),
        html: designHtml,
        css: designCss,
        js: designJs,
      }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to save design"));
    setMsg("Design saved");
    setDesignName("");
    setDesignPreviewImage("");
    setDesignHtml("");
    setDesignCss("");
    setDesignJs("");
    load();
  }

  async function saveGiftItem() {
    setMsg("");
    const normalizedCategory = String(giftCategory ?? "item").trim().toLowerCase();
    const tags = [normalizedCategory];
    const packageRows =
      normalizedCategory === "package"
        ? packageComponents
            .map((row, idx) => ({
              component_order: idx,
              component_category: row.category,
              component_name: row.name.trim(),
              component_points_value: Math.max(0, Number(row.points_value) || 0),
              component_design_id: row.design_id || null,
              component_design_image_url: row.design_image_url.trim() || null,
              component_design_html: row.design_html || null,
              component_design_css: row.design_css || null,
              component_design_js: row.design_js || null,
              component_qty: Math.max(1, Number(row.qty) || 1),
            }))
            .filter((row) => row.component_name)
        : [];
    if (normalizedCategory === "package" && packageRows.length === 0) {
      return setMsg("Add at least one package component.");
    }
    const res = await fetch("/api/admin/gifts/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: giftName.trim(),
        category: normalizedCategory,
        category_tags: tags,
        gift_type: giftType.trim() || "generic",
        design_id: giftDesignId || null,
        points_value: Math.max(0, Number(giftPoints) || 0),
        design_image_url: giftImageUrl.trim(),
        design_html: giftHtml,
        design_css: giftCss,
        design_js: giftJs,
        package_components: packageRows,
        auto_assignment: autoGiftEnabled
          ? {
              enabled: true,
              scope_type: autoScopeType,
              roster_id: autoRosterId || null,
              secondary_role: autoSecondaryRole,
              day_codes: autoDayCodes,
              time_et: autoTimeEt || "16:00",
              start_date: autoStartDate || null,
              end_date: autoEndDate || null,
              student_ids: autoStudentIds,
              qty: Math.max(1, Number(autoQty) || 1),
            }
          : null,
        enabled: true,
      }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to save gift item"));
    setMsg("Gift item saved");
    setGiftName("");
    setGiftCategory("item");
    setGiftType("generic");
    setGiftDesignId("");
    setGiftPoints("0");
    setGiftImageUrl("");
    setGiftHtml("");
    setGiftCss("");
    setGiftJs("");
    setPackageComponents([]);
    setAutoGiftEnabled(false);
    setAutoRosterId("");
    setAutoSecondaryRole("seller");
    setAutoDayCodes(["m"]);
    setAutoTimeEt("16:00");
    setAutoStartDate("");
    setAutoEndDate("");
    setAutoStudentIds([]);
    setAutoQty("1");
    load();
  }

  async function assignGift() {
    setMsg("");
    if (!assignGiftId || !selectedStudentIds.length) return setMsg("Select gift + students first.");
    const res = await fetch("/api/admin/gifts/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gift_item_id: assignGiftId,
        student_ids: selectedStudentIds,
        qty: Math.max(1, Number(assignQty) || 1),
      }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to assign gift"));
    setMsg(`Assigned gifts to ${Number(sj?.assigned_count ?? 0)} student(s)`);
    await loadStatusAndLogs();
  }

  async function runScheduledGiftsNow() {
    setMsg("");
    const res = await fetch("/api/admin/gifts/auto-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: autoRunDry }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to run scheduled gifts"));
    setMsg(
      autoRunDry
        ? `Dry run: due ${Number(sj?.delivered ?? 0)} gift drops (checked ${Number(sj?.checked ?? 0)} schedule(s)).`
        : `Scheduled gifts delivered: ${Number(sj?.delivered ?? 0)} (checked ${Number(sj?.checked ?? 0)} schedule(s)).`
    );
    await loadStatusAndLogs();
  }

  function loadGiftForEditing(it: GiftItem) {
    setGiftName(String(it.name ?? ""));
    setGiftCategory(String(it.category ?? "item"));
    setGiftType(String(it.gift_type ?? "generic"));
    setGiftDesignId(String(it.design_id ?? ""));
    setGiftPoints(String(Math.max(0, Number(it.points_value ?? 0))));
    setGiftImageUrl(String(it.design_image_url ?? ""));
    setGiftHtml(String(it.design_html ?? ""));
    setGiftCss(String(it.design_css ?? ""));
    setGiftJs(String(it.design_js ?? ""));
    const auto = it.auto_assignment ?? null;
    setAutoGiftEnabled(!!auto?.enabled);
    setAutoScopeType("camp_secondary_role");
    setAutoRosterId(String(auto?.roster_id ?? ""));
    setAutoSecondaryRole(String(auto?.secondary_role ?? "seller"));
    setAutoDayCodes(Array.isArray(auto?.day_codes) && auto?.day_codes.length ? (auto?.day_codes as string[]) : ["m"]);
    setAutoTimeEt(String(auto?.time_et ?? "16:00"));
    setAutoStartDate(String(auto?.start_date ?? ""));
    setAutoEndDate(String(auto?.end_date ?? ""));
    setAutoStudentIds(Array.isArray(auto?.student_ids) ? (auto?.student_ids as string[]) : []);
    setAutoQty(String(Math.max(1, Number(auto?.qty ?? 1))));
    setStudioTab("creator");
    setMsg(`Loaded gift for editing: ${String(it.name ?? "Gift")}`);
  }

  async function saveGiftButtonSettings() {
    setMsg("");
    const res = await fetch("/api/admin/gifts/button-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_button_design_id: buttonDesignId || null,
        student_button_image_url: buttonImageUrl.trim() || null,
        student_button_emoji: buttonEmoji.trim() || "🎁",
      }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to save gift button settings"));
    setMsg("Gift button settings saved");
    await load();
  }

  async function uploadGiftImage(file: File, scope: "design" | "item") {
    setMsg("");
    const form = new FormData();
    form.append("file", file);
    form.append("scope", scope);
    const res = await fetch("/api/admin/gifts/upload", { method: "POST", body: form });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(sj?.error ?? "Upload failed"));
      return "";
    }
    return String(sj?.public_url ?? "").trim();
  }

  async function onDesignUploadFile(file: File | null) {
    if (!file) return;
    const url = await uploadGiftImage(file, "design");
    if (!url) return;
    setDesignPreviewImage(url);
    setMsg("Design preview image uploaded");
  }

  async function onGiftUploadFile(file: File | null) {
    if (!file) return;
    const url = await uploadGiftImage(file, "item");
    if (!url) return;
    setGiftImageUrl(url);
    setMsg("Gift image uploaded");
  }

  function addPackageComponent() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPackageComponents((prev) => [
      ...prev,
      {
        id,
        category: "item",
        name: "",
        points_value: "0",
        qty: "1",
        design_id: "",
        design_image_url: "",
        design_html: "",
        design_css: "",
        design_js: "",
      },
    ]);
  }

  function updatePackageComponent(id: string, patch: Partial<PackageComponentDraft>) {
    setPackageComponents((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removePackageComponent(id: string) {
    setPackageComponents((prev) => prev.filter((row) => row.id !== id));
  }

  async function uploadPackageComponentImage(id: string, file: File | null) {
    if (!file) return;
    const url = await uploadGiftImage(file, "item");
    if (!url) return;
    updatePackageComponent(id, { design_image_url: url });
    setMsg("Package component image uploaded");
  }

  async function loadStatusAndLogs() {
    if (!assignGiftId) {
      setStatusRows([]);
      setLogRows([]);
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    const query = statusStudentQuery.trim();
    const qs = new URLSearchParams();
    if (query) qs.set("student_query", query);
    if (assignGiftId) qs.set("gift_item_id", assignGiftId);
    qs.set("range", logRange);

    const [statusRes, logRes] = await Promise.all([
      fetch(`/api/admin/gifts/student-gifts?${qs.toString()}`, { cache: "no-store" }),
      fetch(`/api/admin/gifts/logs?${qs.toString()}`, { cache: "no-store" }),
    ]);
    const sj = await statusRes.json().catch(() => ({}));
    const lj = await logRes.json().catch(() => ({}));
    setStatusLoading(false);
    if (!statusRes.ok) return setMsg(String(sj?.error ?? "Failed to load gift status"));
    if (!logRes.ok) return setMsg(String(lj?.error ?? "Failed to load gift logs"));
    setStatusRows((sj?.student_gifts ?? []) as StudentGiftStatusRow[]);
    setLogRows((lj?.logs ?? []) as GiftLogRow[]);
  }

  async function removeOneGiftAssignment(row: StudentGiftStatusRow) {
    const ok = window.confirm(`Remove gift "${String(row.gift_items?.name ?? "Gift")}" for ${String(row.students?.name ?? "student")}?`);
    if (!ok) return;
    setMsg("");
    const res = await fetch("/api/admin/gifts/student-gifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_gift_id: row.id }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to remove gift"));
    setMsg(`Removed ${Number(sj?.removed_count ?? 0)} gift assignment(s)`);
    await loadStatusAndLogs();
  }

  async function removeGiftTypeFromAllStudents() {
    if (!assignGiftId) return setMsg("Select a gift item first.");
    const selected = items.find((i) => String(i.id) === String(assignGiftId));
    const ok = window.confirm(`Remove "${String(selected?.name ?? "this gift")}" from ALL students? This will disable all active assignments for that gift.`);
    if (!ok) return;
    setMsg("");
    const res = await fetch("/api/admin/gifts/remove-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gift_item_id: assignGiftId, confirm: true }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to remove gift from all students"));
    setMsg(`Removed ${Number(sj?.removed_count ?? 0)} assignment(s) from all students.`);
    await loadStatusAndLogs();
  }

  const selectedGift = useMemo(() => items.find((i) => String(i.id) === String(assignGiftId)) ?? null, [items, assignGiftId]);
  const selectedRoster = useMemo(
    () => campRosters.find((r) => String(r.id) === String(autoRosterId)) ?? null,
    [campRosters, autoRosterId]
  );
  const roleMembers = useMemo(() => {
    if (!autoRosterId) return [] as CampMemberRow[];
    return campMembers.filter(
      (m) =>
        String(m.roster_id) === String(autoRosterId) &&
        String(m.secondary_role ?? "").trim().toLowerCase() === String(autoSecondaryRole).trim().toLowerCase()
    );
  }, [campMembers, autoRosterId, autoSecondaryRole]);
  const scheduledPreviewRows = useMemo(() => {
    const auto = selectedGift?.auto_assignment;
    if (!auto || auto.enabled !== true || String(auto.scope_type ?? "") !== "camp_secondary_role") return [] as ScheduledPreviewRow[];
    const rosterId = String(auto.roster_id ?? "").trim();
    const role = String(auto.secondary_role ?? "").trim().toLowerCase();
    if (!rosterId || !role) return [] as ScheduledPreviewRow[];

    const roster = campRosters.find((r) => String(r.id) === rosterId);
    const etNow = getEasternNow();
    const nowMinute = etNow.hour * 60 + etNow.minute;
    const targetMinute = parseMinuteOfDay(String(auto.time_et ?? "16:00"));
    const dayCodes = Array.isArray(auto.day_codes) ? auto.day_codes.map(normalizeDayCode).filter(Boolean) : [];
    const explicitStudentIds = new Set((Array.isArray(auto.student_ids) ? auto.student_ids : []).map((v) => String(v ?? "").trim()).filter(Boolean));
    const memberPool = campMembers
      .filter((m) => String(m.roster_id) === rosterId)
      .filter((m) => String(m.secondary_role ?? "").trim().toLowerCase() === role)
      .filter((m) => (explicitStudentIds.size ? explicitStudentIds.has(String(m.student_id)) : true));

    return memberPool.map((m) => {
      const studentId = String(m.student_id ?? "");
      const memberDays = Array.isArray(m.secondary_role_days) ? m.secondary_role_days.map(normalizeDayCode).filter(Boolean) : [];
      const effectiveDays = dayCodes.length ? dayCodes : memberDays;
      const todayAllowed = !effectiveDays.length || effectiveDays.includes(etNow.dayCode);
      const inDateRange = isDateInRange(etNow.dateKey, String(auto.start_date ?? ""), String(auto.end_date ?? ""));
      const inRosterRange = isDateInRange(etNow.dateKey, String(roster?.start_date ?? ""), String(roster?.end_date ?? ""));
      const isFuture = todayAllowed && inDateRange && inRosterRange && nowMinute < targetMinute;
      const nextLabel = isFuture
        ? `Today ${String(auto.time_et ?? "16:00")} ET`
        : `Scheduled ${String(auto.time_et ?? "16:00")} ET`;
      return {
        student_id: studentId,
        student_name: String(m.student_name ?? "Student"),
        next_run_label: nextLabel,
        is_future: isFuture,
      };
    });
  }, [selectedGift, campMembers, campRosters]);
  const selectedButtonDesignPreview = useMemo(() => {
    if (!buttonDesignId) return "";
    const row = designs.find((d) => String(d.id) === String(buttonDesignId));
    return String(row?.preview_image_url ?? "").trim();
  }, [buttonDesignId, designs]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadStatusAndLogs();
    }, 220);
    return () => clearTimeout(t);
  }, [statusStudentQuery, logRange, assignGiftId]);

  return (
    <main style={{ padding: 18, maxWidth: 1200, margin: "0 auto", display: "grid", gap: 14 }}>
      <div style={{ fontSize: 32, fontWeight: 1000 }}>Gift Studio</div>
      <div style={{ opacity: 0.74 }}>Create gift designs, create gifts, and assign to students.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/admin/custom" style={quickLink()}>Back to Admin Settings</a>
        <a href="/admin/custom/media" style={quickLink()}>Media Vault</a>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={studioTab === "button" ? btnPrimary() : btnGhost()} onClick={() => setStudioTab("button")}>Button Icon</button>
        <button type="button" style={studioTab === "designs" ? btnPrimary() : btnGhost()} onClick={() => setStudioTab("designs")}>Design Library</button>
        <button type="button" style={studioTab === "creator" ? btnPrimary() : btnGhost()} onClick={() => setStudioTab("creator")}>Gift Creator</button>
        <button type="button" style={studioTab === "assign" ? btnPrimary() : btnGhost()} onClick={() => setStudioTab("assign")}>Assign Gifts</button>
        <button type="button" style={studioTab === "status" ? btnPrimary() : btnGhost()} onClick={() => setStudioTab("status")}>Status & Logs</button>
      </div>
      {msg ? <div style={notice()}>{msg}</div> : null}

      {studioTab === "button" ? <section style={card()}>
        <div style={cardTitle()}>Student Gift Button Icon</div>
        <div style={{ opacity: 0.75, marginTop: -6 }}>
          Used on Student Info page. If no image is selected, emoji is used. Count badge still shows on top.
        </div>
        <div style={twoCol()}>
          <div style={stack()}>
            <label style={label()}>
              Design from library (optional)
              <select value={buttonDesignId} onChange={(e) => setButtonDesignId(e.target.value)} style={input()}>
                <option value="">No design selected</option>
                {designs.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label style={label()}>
              Direct image URL override (optional)
              <input
                value={buttonImageUrl}
                onChange={(e) => setButtonImageUrl(e.target.value)}
                placeholder="https://..."
                style={input()}
              />
            </label>
            <label style={label()}>
              Fallback emoji
              <input value={buttonEmoji} onChange={(e) => setButtonEmoji(e.target.value)} style={input()} />
            </label>
            <button onClick={saveGiftButtonSettings} style={btnPrimary()}>Save Button Settings</button>
          </div>
          <div style={libraryCard()}>
            <div style={{ fontWeight: 900 }}>Preview</div>
            <div style={{ width: 74, height: 74, borderRadius: 16, border: "1px solid rgba(148,163,184,0.45)", background: "rgba(15,23,42,0.65)", display: "grid", placeItems: "center", position: "relative" }}>
              {(buttonImageUrl.trim() || selectedButtonDesignPreview) ? (
                <img src={buttonImageUrl.trim() || selectedButtonDesignPreview} alt="gift icon" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 36, lineHeight: 1 }}>{buttonEmoji || "🎁"}</span>
              )}
              <span style={{ position: "absolute", right: -4, top: -4, borderRadius: 999, background: "#dc2626", color: "white", minWidth: 22, height: 22, display: "grid", placeItems: "center", padding: "0 6px", fontSize: 12, fontWeight: 1000 }}>3</span>
            </div>
          </div>
        </div>
      </section> : null}

      {studioTab === "designs" ? <section style={card()}>
        <div style={cardTitle()}>Design Library + Creator</div>
        <div style={twoCol()}>
          <div style={stack()}>
            <label style={label()}>
              Design name (internal)
              <input value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="e.g. neon-gift-box-01" style={input()} />
            </label>
            <label style={label()}>
              Preview image URL (optional)
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={designPreviewImage} onChange={(e) => setDesignPreviewImage(e.target.value)} placeholder="https://..." style={{ ...input(), flex: 1 }} />
                <button type="button" onClick={() => designUploadInputRef.current?.click()} style={btnGhost()}>
                  Upload
                </button>
                <input
                  ref={designUploadInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    void onDesignUploadFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </label>
            <label style={label()}>
              HTML
              <textarea value={designHtml} onChange={(e) => setDesignHtml(e.target.value)} style={textarea()} rows={5} />
            </label>
            <label style={label()}>
              CSS
              <textarea value={designCss} onChange={(e) => setDesignCss(e.target.value)} style={textarea()} rows={5} />
            </label>
            <label style={label()}>
              JS
              <textarea value={designJs} onChange={(e) => setDesignJs(e.target.value)} style={textarea()} rows={4} />
            </label>
            <button onClick={saveDesign} style={btnPrimary()}>Save Design</button>
          </div>
          <div style={libraryGrid()}>
            {designs.map((d) => (
              <div key={d.id} style={libraryCard()}>
                <div style={{ fontWeight: 900 }}>{d.name}</div>
                <div style={{ opacity: 0.74, fontSize: 12 }}>{d.id.slice(0, 8)}</div>
                {d.preview_image_url ? <img src={d.preview_image_url} alt={d.name} style={{ width: 86, height: 86, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(148,163,184,0.5)" }} /> : null}
                <button
                  onClick={() => {
                    setGiftDesignId(d.id);
                    setGiftImageUrl(String(d.preview_image_url ?? ""));
                    setGiftHtml(String(d.html ?? ""));
                    setGiftCss(String(d.css ?? ""));
                    setGiftJs(String(d.js ?? ""));
                    setMsg(`Loaded design: ${d.name}`);
                  }}
                  style={btnGhost()}
                >
                  Use In Gift
                </button>
              </div>
            ))}
          </div>
        </div>
      </section> : null}

      {studioTab === "creator" ? <section style={card()}>
        <div style={cardTitle()}>Gift Creator</div>
        <div style={twoCol()}>
          <div style={stack()}>
            <label style={label()}>
              Gift name
              <input value={giftName} onChange={(e) => setGiftName(e.target.value)} style={input()} placeholder="e.g. Dragon Weapon Crate" />
            </label>
            <label style={label()}>
              Gift Category
              <select value={giftCategory} onChange={(e) => setGiftCategory(e.target.value)} style={input()}>
                <option value="item">Item</option>
                <option value="points">Points</option>
                <option value="discount">Discount</option>
                <option value="weapon">Weapon</option>
                <option value="uniform">Uniform</option>
                <option value="package">Package</option>
              </select>
            </label>
            <label style={label()}>
              Type
              <input value={giftType} onChange={(e) => setGiftType(e.target.value)} style={input()} placeholder="e.g. epic, basic, legendary" />
            </label>
            {giftCategory !== "package" ? (
              <>
                <label style={label()}>
                  Points awarded when opened
                  <input value={giftPoints} onChange={(e) => setGiftPoints(e.target.value)} style={input()} inputMode="numeric" />
                </label>
                <label style={label()}>
                  Use design from library
                  <select value={giftDesignId} onChange={(e) => setGiftDesignId(e.target.value)} style={input()}>
                    <option value="">No linked design (custom fields below)</option>
                    {designs.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <label style={label()}>
                  Design image URL (optional)
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={giftImageUrl} onChange={(e) => setGiftImageUrl(e.target.value)} style={{ ...input(), flex: 1 }} />
                    <button type="button" onClick={() => giftUploadInputRef.current?.click()} style={btnGhost()}>
                      Upload
                    </button>
                    <input
                      ref={giftUploadInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        void onGiftUploadFile(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                </label>
                <label style={label()}>
                  Gift HTML
                  <textarea value={giftHtml} onChange={(e) => setGiftHtml(e.target.value)} style={textarea()} rows={4} />
                </label>
                <label style={label()}>
                  Gift CSS
                  <textarea value={giftCss} onChange={(e) => setGiftCss(e.target.value)} style={textarea()} rows={4} />
                </label>
                <label style={label()}>
                  Gift JS
                  <textarea value={giftJs} onChange={(e) => setGiftJs(e.target.value)} style={textarea()} rows={3} />
                </label>
              </>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 900 }}>Package Components</div>
                  <button type="button" style={btnGhost()} onClick={addPackageComponent}>+ Add Component</button>
                </div>
                {packageComponents.map((row, idx) => (
                  <div key={row.id} style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(15,23,42,0.52)", padding: 10, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>Component #{idx + 1}</div>
                      <button type="button" style={{ ...btnGhost(), borderColor: "rgba(239,68,68,0.55)", color: "#fecaca" }} onClick={() => removePackageComponent(row.id)}>Remove</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select value={row.category} onChange={(e) => updatePackageComponent(row.id, { category: e.target.value as any })} style={input()}>
                        <option value="item">Item</option>
                        <option value="points">Points</option>
                        <option value="discount">Discount</option>
                        <option value="weapon">Weapon</option>
                        <option value="uniform">Uniform</option>
                      </select>
                      <input value={row.name} onChange={(e) => updatePackageComponent(row.id, { name: e.target.value })} style={input()} placeholder={row.category === "points" ? "Points Gift Name" : "Item name"} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input value={row.points_value} onChange={(e) => updatePackageComponent(row.id, { points_value: e.target.value })} style={input()} inputMode="numeric" placeholder="Points value (if points type)" />
                      <input value={row.qty} onChange={(e) => updatePackageComponent(row.id, { qty: e.target.value })} style={input()} inputMode="numeric" placeholder="Qty" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select
                        value={row.design_id}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          const match = designs.find((d) => String(d.id) === nextId);
                          updatePackageComponent(row.id, {
                            design_id: nextId,
                            design_image_url: String(match?.preview_image_url ?? row.design_image_url ?? ""),
                            design_html: String(match?.html ?? row.design_html ?? ""),
                            design_css: String(match?.css ?? row.design_css ?? ""),
                            design_js: String(match?.js ?? row.design_js ?? ""),
                          });
                        }}
                        style={input()}
                      >
                        <option value="">No linked design</option>
                        {designs.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input value={row.design_image_url} onChange={(e) => updatePackageComponent(row.id, { design_image_url: e.target.value })} style={{ ...input(), flex: 1 }} placeholder="Design image URL" />
                        <input type="file" accept="image/*" onChange={(e) => void uploadPackageComponentImage(row.id, e.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                  </div>
                ))}
                {!packageComponents.length ? <div style={{ opacity: 0.72, fontSize: 12 }}>Click + Add Component to build this package.</div> : null}
              </div>
            )}
            <div style={{ borderRadius: 12, border: "1px solid rgba(56,189,248,0.35)", background: "rgba(8,47,73,0.25)", padding: 10, display: "grid", gap: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={autoGiftEnabled} onChange={(e) => setAutoGiftEnabled(e.target.checked)} />
                Schedule auto-drop gifts (camp secondary role)
              </label>
              {autoGiftEnabled ? (
                <>
                  <div style={{ fontSize: 12, opacity: 0.78 }}>
                    Secondary-role gifts are delivered directly to gift box at selected ET time. These gifts can still be assigned manually too.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={label()}>
                      Camp roster
                      <select value={autoRosterId} onChange={(e) => setAutoRosterId(e.target.value)} style={input()}>
                        <option value="">Select roster</option>
                        {campRosters.map((r) => (
                          <option key={r.id} value={r.id}>
                            {String(r.name ?? "Roster")} ({String(r.start_date ?? "?")} → {String(r.end_date ?? "?")})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={label()}>
                      Secondary role
                      <select value={autoSecondaryRole} onChange={(e) => setAutoSecondaryRole(e.target.value)} style={input()}>
                        <option value="seller">seller</option>
                        <option value="cleaner">cleaner</option>
                      </select>
                    </label>
                  </div>
                  {selectedRoster ? (
                    <div style={{ fontSize: 12, opacity: 0.78 }}>
                      Roster dates: {String(selectedRoster.start_date ?? "n/a")} → {String(selectedRoster.end_date ?? "n/a")}
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <label style={label()}>
                      Time (ET)
                      <input type="time" value={autoTimeEt} onChange={(e) => setAutoTimeEt(e.target.value)} style={input()} />
                    </label>
                    <label style={label()}>
                      Start date (optional)
                      <input type="date" value={autoStartDate} onChange={(e) => setAutoStartDate(e.target.value)} style={input()} />
                    </label>
                    <label style={label()}>
                      End date (optional)
                      <input type="date" value={autoEndDate} onChange={(e) => setAutoEndDate(e.target.value)} style={input()} />
                    </label>
                  </div>
                  <label style={label()}>
                    Gift quantity each drop
                    <input value={autoQty} onChange={(e) => setAutoQty(e.target.value)} style={input()} inputMode="numeric" />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {[
                      { key: "m", label: "Mon" },
                      { key: "t", label: "Tue" },
                      { key: "w", label: "Wed" },
                      { key: "r", label: "Thu" },
                      { key: "f", label: "Fri" },
                      { key: "sa", label: "Sat" },
                      { key: "su", label: "Sun" },
                    ].map((d) => {
                      const on = autoDayCodes.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() =>
                            setAutoDayCodes((prev) =>
                              on ? prev.filter((v) => v !== d.key) : [...prev, d.key]
                            )
                          }
                          style={{
                            ...btnGhost(),
                            borderColor: on ? "rgba(56,189,248,0.8)" : "rgba(148,163,184,0.42)",
                            background: on ? "rgba(14,116,144,0.35)" : "rgba(15,23,42,0.72)",
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 12 }}>Optional specific students (defaults to all matching role members)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                    {roleMembers.map((m) => {
                      const on = autoStudentIds.includes(String(m.student_id));
                      return (
                        <button
                          key={`${m.roster_id}:${m.student_id}`}
                          type="button"
                          onClick={() =>
                            setAutoStudentIds((prev) =>
                              on ? prev.filter((id) => id !== String(m.student_id)) : [...prev, String(m.student_id)]
                            )
                          }
                          style={{
                            textAlign: "left",
                            borderRadius: 10,
                            border: on ? "1px solid rgba(56,189,248,0.8)" : "1px solid rgba(148,163,184,0.35)",
                            background: on ? "rgba(14,116,144,0.35)" : "rgba(15,23,42,0.45)",
                            color: "white",
                            padding: "7px 9px",
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{m.student_name}</div>
                          <div style={{ opacity: 0.72, fontSize: 11 }}>{String(m.student_id).slice(0, 8)}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
            <button onClick={saveGiftItem} style={btnPrimary()}>Save Gift Item</button>
          </div>
          <div style={libraryGrid()}>
            {items.map((it) => (
              <div key={it.id} style={libraryCard()}>
                <div style={{ fontWeight: 900 }}>{it.name}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {(it.category_tags && it.category_tags.length ? it.category_tags.join(", ") : it.category)} • {it.gift_type}
                </div>
                <div style={{ opacity: 0.82, fontSize: 12 }}>+{Math.round(Number(it.points_value ?? 0))} pts</div>
                {it.design_image_url ? <img src={it.design_image_url} alt={it.name} style={{ width: 86, height: 86, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(148,163,184,0.5)" }} /> : null}
                <button onClick={() => setAssignGiftId(it.id)} style={btnGhost()}>
                  Select For Assign
                </button>
                <button onClick={() => loadGiftForEditing(it)} style={btnGhost()}>
                  Load For Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      </section> : null}

      {studioTab === "assign" ? <section style={card()}>
        <div style={cardTitle()}>Assign Gifts To Students</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={assignGiftId} onChange={(e) => setAssignGiftId(e.target.value)} style={{ ...input(), minWidth: 320, maxWidth: 380 }}>
              <option value="">Select gift item</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({(it.category_tags && it.category_tags.length ? it.category_tags.join("/") : it.category)})
                </option>
              ))}
            </select>
            <input value={assignQty} onChange={(e) => setAssignQty(e.target.value)} style={{ ...input(), width: 90 }} inputMode="numeric" placeholder="Qty" />
            <button onClick={assignGift} style={btnPrimary()}>Assign Gift</button>
          </div>
          {selectedGift ? <div style={{ opacity: 0.85 }}>Selected: <strong>{selectedGift.name}</strong> ({(selectedGift.category_tags && selectedGift.category_tags.length ? selectedGift.category_tags.join(", ") : selectedGift.category)})</div> : null}
          <label style={label()}>
            Find students
            <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} style={input()} placeholder="Type student name..." />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8 }}>
            {studentResults.map((s) => {
              const on = selectedStudentIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStudentIds((prev) => (on ? prev.filter((id) => id !== s.id) : [...prev, s.id]))}
                  style={{
                    textAlign: "left",
                    borderRadius: 10,
                    border: on ? "1px solid rgba(59,130,246,0.8)" : "1px solid rgba(148,163,184,0.35)",
                    background: on ? "rgba(30,64,175,0.25)" : "rgba(15,23,42,0.45)",
                    color: "white",
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{s.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{s.id.slice(0, 8)}</div>
                </button>
              );
            })}
          </div>
          {selectedGift?.auto_assignment?.enabled ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div style={{ fontWeight: 900 }}>Scheduled Gift Targets (Auto)</div>
              {!scheduledPreviewRows.length ? <div style={{ opacity: 0.7 }}>No scheduled targets found for this gift setup.</div> : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                {scheduledPreviewRows.map((row) => (
                  <div key={`sched-assign-${row.student_id}`} style={libraryCard()}>
                    <div style={{ fontWeight: 900 }}>{row.student_name}</div>
                    <div style={{ opacity: 0.72, fontSize: 12 }}>{row.student_id.slice(0, 8)}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={statusChipYellow()}>{row.is_future ? "Scheduled" : "Schedule Active"}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.78 }}>{row.next_run_label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section> : null}

      {studioTab === "status" ? <section style={card()}>
        <div style={cardTitle()}>Gift Status + Running Log</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={assignGiftId} onChange={(e) => setAssignGiftId(e.target.value)} style={{ ...input(), minWidth: 300, maxWidth: 360 }}>
            <option value="">Select gift item first</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({(it.category_tags && it.category_tags.length ? it.category_tags.join("/") : it.category)})
              </option>
            ))}
          </select>
          <input
            value={statusStudentQuery}
            onChange={(e) => setStatusStudentQuery(e.target.value)}
            placeholder="Filter by student name..."
            style={{ ...input(), minWidth: 260, maxWidth: 320 }}
          />
          <select value={logRange} onChange={(e) => setLogRange(e.target.value as any)} style={{ ...input(), width: 110 }}>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="all">All</option>
          </select>
          <button onClick={loadStatusAndLogs} style={btnGhost()}>Refresh</button>
          <button onClick={removeGiftTypeFromAllStudents} style={{ ...btnGhost(), borderColor: "rgba(239,68,68,0.55)", color: "#fecaca" }}>
            Remove Selected Gift From All
          </button>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={autoRunDry} onChange={(e) => setAutoRunDry(e.target.checked)} />
            Dry run
          </label>
          <button onClick={runScheduledGiftsNow} style={btnGhost()}>
            Run Due Scheduled Gifts Now
          </button>
        </div>
        <div style={{ opacity: 0.76, fontSize: 12 }}>Pick a gift first, then review assignment status chips and point snapshots.</div>
        <div style={twoCol()}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Gift Status (Per Student)</div>
            <div style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {selectedGift?.auto_assignment?.enabled && !!scheduledPreviewRows.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {scheduledPreviewRows.map((row) => (
                    <div key={`sched-status-${row.student_id}`} style={libraryCard()}>
                      <div style={{ fontWeight: 900 }}>{row.student_name} • {String(selectedGift?.name ?? "Gift")}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={statusChipYellow()}>Scheduled</span>
                        <span style={statusChipGray()}>Unopened (pending drop)</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{row.next_run_label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!assignGiftId ? <div style={{ opacity: 0.7 }}>Select a gift item to view status.</div> : null}
              {assignGiftId && statusLoading ? <div style={{ opacity: 0.7 }}>Loading...</div> : null}
              {assignGiftId && !statusLoading && !statusRows.length ? <div style={{ opacity: 0.7 }}>No matching gift assignments.</div> : null}
              {statusRows.map((r) => {
                const qty = Math.max(0, Number(r.qty ?? 0));
                const opened = Math.max(0, Number(r.opened_qty ?? 0));
                const remain = Math.max(0, qty - opened);
                const evt = r.latest_open_event;
                const before = Math.round(Number(evt?.points_before_open ?? 0));
                const after = Math.round(Number(evt?.points_after_open ?? before));
                const delta = after - before;
                return (
                  <div key={r.id} style={libraryCard()}>
                    <div style={{ fontWeight: 900 }}>{String(r.students?.name ?? "Student")} • {String(r.gift_items?.name ?? "Gift")}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={statusChipBlue()}>Unopened {remain}</span>
                      <span style={statusChipGreen()}>Opened {opened}</span>
                      <span style={statusChipGray()}>Given {qty}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.74 }}>
                      {(r.gift_items?.category_tags && r.gift_items.category_tags.length ? r.gift_items.category_tags.join(", ") : String(r.gift_items?.category ?? "item"))}
                      {" • "}+{Math.round(Number(r.gift_items?.points_value ?? 0))} pts on open
                    </div>
                    {evt ? (
                      <div style={{ fontSize: 12, opacity: 0.82 }}>
                        Before {before} pts → After {after} pts ({delta >= 0 ? "+" : ""}{delta})
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.66 }}>Before/after points will appear once opened.</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.68 }}>
                        Assigned {fmtDateTime(r.created_at)}
                        {evt?.opened_at ? ` • Last open ${fmtDateTime(evt.opened_at)}` : ""}
                      </div>
                      <button onClick={() => removeOneGiftAssignment(r)} style={{ ...btnGhost(), borderColor: "rgba(239,68,68,0.55)", color: "#fecaca" }}>
                        Remove Gift
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Running Log ({logRange})</div>
            <div style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {!statusLoading && !logRows.length ? <div style={{ opacity: 0.7 }}>No gift open events in this range.</div> : null}
              {logRows.map((r) => (
                <div key={r.id} style={libraryCard()}>
                  <div style={{ fontWeight: 900 }}>{String(r.students?.name ?? "Student")} opened {String(r.gift_items?.name ?? "Gift")}</div>
                  <div style={{ fontSize: 12, opacity: 0.78 }}>
                    +{Math.round(Number(r.points_awarded ?? 0))} pts • {(r.gift_items?.category_tags && r.gift_items.category_tags.length ? r.gift_items.category_tags.join(", ") : String(r.gift_items?.category ?? "item"))}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.74 }}>
                    Before {Math.round(Number(r.points_before_open ?? 0))} pts → After {Math.round(Number(r.points_after_open ?? 0))} pts
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.68 }}>{fmtDateTime(r.opened_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> : null}
    </main>
  );
}

function fmtDateTime(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function normalizeDayCode(value: unknown) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "monday" || v === "mon") return "m";
  if (v === "tuesday" || v === "tues" || v === "tue") return "t";
  if (v === "wednesday" || v === "wed") return "w";
  if (v === "thursday" || v === "thurs" || v === "thu" || v === "th") return "r";
  if (v === "friday" || v === "fri") return "f";
  if (v === "saturday" || v === "sat") return "sa";
  if (v === "sunday" || v === "sun") return "su";
  if (["m", "t", "w", "r", "f", "sa", "su"].includes(v)) return v;
  return "";
}

function parseMinuteOfDay(value?: string | null) {
  const raw = String(value ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return 16 * 60;
  const h = Math.max(0, Math.min(23, Number(m[1] ?? 16) || 16));
  const min = Math.max(0, Math.min(59, Number(m[2] ?? 0) || 0));
  return h * 60 + min;
}

function getEasternNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const dateKey = year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10);
  const weekday = String(parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
  const dayCode = weekday.startsWith("mon")
    ? "m"
    : weekday.startsWith("tue")
    ? "t"
    : weekday.startsWith("wed")
    ? "w"
    : weekday.startsWith("thu")
    ? "r"
    : weekday.startsWith("fri")
    ? "f"
    : weekday.startsWith("sat")
    ? "sa"
    : weekday.startsWith("sun")
    ? "su"
    : "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dateKey, dayCode, hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function isDateInRange(dateKey: string, startDate?: string | null, endDate?: string | null) {
  const start = String(startDate ?? "").trim();
  const end = String(endDate ?? "").trim();
  if (start && dateKey < start) return false;
  if (end && dateKey > end) return false;
  return true;
}

function card(): React.CSSProperties {
  return {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(100,116,139,0.45)",
    background: "linear-gradient(160deg, rgba(2,6,23,0.84), rgba(15,23,42,0.9))",
    padding: 14,
    display: "grid",
    gap: 12,
  };
}
function cardTitle(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 1000 };
}
function twoCol(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "minmax(320px,460px) minmax(0,1fr)", gap: 14 };
}
function stack(): React.CSSProperties {
  return { display: "grid", gap: 8, alignContent: "start" };
}
function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontWeight: 800, fontSize: 13 };
}
function input(): React.CSSProperties {
  return {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(148,163,184,0.42)",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: "8px 10px",
  };
}
function textarea(): React.CSSProperties {
  return { ...input(), resize: "vertical", minHeight: 82 };
}
function btnPrimary(): React.CSSProperties {
  return {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(59,130,246,0.8)",
    background: "linear-gradient(135deg, rgba(30,64,175,0.92), rgba(30,58,138,0.96))",
    color: "white",
    fontWeight: 900,
    padding: "9px 12px",
  };
}
function btnGhost(): React.CSSProperties {
  return {
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(148,163,184,0.42)",
    background: "rgba(15,23,42,0.7)",
    color: "white",
    fontWeight: 800,
    padding: "7px 10px",
  };
}
function notice(): React.CSSProperties {
  return {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(125,211,252,0.45)",
    background: "rgba(2,132,199,0.22)",
    color: "#e0f2fe",
    padding: "8px 10px",
    fontWeight: 800,
  };
}
function libraryGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 8, alignContent: "start", maxHeight: 620, overflowY: "auto" };
}
function libraryCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.55)",
    padding: 10,
    display: "grid",
    gap: 8,
    justifyItems: "start",
  };
}
function quickLink(): React.CSSProperties {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.75)",
    color: "white",
    textDecoration: "none",
    fontWeight: 800,
    padding: "6px 11px",
  };
}

function statusChipBlue(): React.CSSProperties {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(96,165,250,0.65)",
    background: "rgba(30,64,175,0.28)",
    color: "#dbeafe",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
  };
}

function statusChipGreen(): React.CSSProperties {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(74,222,128,0.65)",
    background: "rgba(21,128,61,0.28)",
    color: "#dcfce7",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
  };
}

function statusChipGray(): React.CSSProperties {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(148,163,184,0.5)",
    background: "rgba(51,65,85,0.35)",
    color: "#e2e8f0",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
  };
}

function statusChipYellow(): React.CSSProperties {
  return {
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(234,179,8,0.7)",
    background: "rgba(161,98,7,0.28)",
    color: "#fef3c7",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
  };
}
