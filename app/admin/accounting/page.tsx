"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CampType = "general" | "competition" | "overnight";
type AccountingType = "camp" | "normal_classes" | "events" | "testing" | "expenses";
type Enrollment = "OFF" | "FULL" | "AM" | "PM";
type DayKey = "su" | "m" | "t" | "w" | "r" | "f" | "sa";
type PaymentMethod = "Zelle CW" | "Zelle XY" | "Venmo" | "PayPal" | "Check" | "Cash" | "Unpaid";
type ViewMode = "home" | "create" | "tab" | "summary" | "settings" | "browse_tabs";
type TabSubView = "tuition" | "pricing" | "roster" | "expenses" | "lunch" | "ledger";

type AccountingTab = {
  id: string;
  title: string;
  tab_type: AccountingType;
  accounting_year?: number | null;
  accounting_season_id?: string | null;
  enabled?: boolean;
};

type AccountingSeason = {
  id: string;
  name: string;
  enabled?: boolean;
};

type StudentOption = {
  id: string;
  name: string;
  isCompetitionTeam: boolean;
  avatarPath: string | null;
};

type CampPricing = {
  general: { fullWeek: number; fullDay: number; am: number; pm: number; enabled: boolean };
  competition: { fullWeek: number; fullDay: number; am: number; pm: number; enabled: boolean };
  overnight: { perDay: number; fullWeek: number; enabled: boolean };
  lunchExpenses: number;
};

type CampRow = {
  id: string;
  studentId: string;
  name: string;
  campType: CampType;
  enroll: Record<DayKey, Enrollment>;
  lunch: Record<DayKey, boolean>;
  lunchItem: Record<DayKey, string>;
  lunchPrice: Record<DayKey, number>;
  discount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  feesPaid: number;
  paymentLog: PaymentLogEntry[];
  notes?: string;
};

type PaymentLogEntry = {
  id: string;
  date: string;
  method: PaymentMethod;
  amount: number;
  note?: string;
};

type ExpenseRow = {
  id: string;
  item: string;
  amount: number;
  category: string;
  notes: string;
};

type QuickStudentForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isCompetitionTeam: boolean;
};

type LedgerRecord = {
  id: string;
  rowId: string;
  studentId: string;
  studentName: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note: string;
};

type SummaryMetrics = {
  tabs: number;
  tuition: number;
  paid: number;
  owed: number;
  expenses: number;
  profit: number;
};

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "su", label: "Su" },
  { key: "m", label: "M" },
  { key: "t", label: "T" },
  { key: "w", label: "W" },
  { key: "r", label: "R" },
  { key: "f", label: "F" },
  { key: "sa", label: "Sa" },
];
const WEEKDAY_KEYS: DayKey[] = ["m", "t", "w", "r", "f"];
const PAYMENT_METHODS: PaymentMethod[] = ["Zelle CW", "Zelle XY", "Venmo", "PayPal", "Check", "Cash", "Unpaid"];
const EMPTY_ENROLL: Record<DayKey, Enrollment> = { su: "OFF", m: "OFF", t: "OFF", w: "OFF", r: "OFF", f: "OFF", sa: "OFF" };
const EMPTY_LUNCH: Record<DayKey, boolean> = { su: false, m: false, t: false, w: false, r: false, f: false, sa: false };
const EMPTY_LUNCH_PRICE: Record<DayKey, number> = { su: 0, m: 0, t: 0, w: 0, r: 0, f: 0, sa: 0 };
const EMPTY_LUNCH_ITEM: Record<DayKey, string> = { su: "", m: "", t: "", w: "", r: "", f: "", sa: "" };
const CAMP_EXPENSE_CATEGORIES = ["snacks", "lunch", "non-lunch equipment", "software", "other expenses"];
const DEFAULT_EXPENSE_CATEGORIES = ["payroll", "facility", "equipment", "software", "other"];

function cycleEnroll(current: Enrollment): Enrollment {
  if (current === "OFF") return "FULL";
  if (current === "FULL") return "AM";
  if (current === "AM") return "PM";
  return "OFF";
}

function money(v: number) {
  return `$${Math.round((Number.isFinite(v) ? v : 0) * 100) / 100}`;
}

function mFriAllFull(enroll: Record<DayKey, Enrollment>) {
  return WEEKDAY_KEYS.every((key) => enroll[key] === "FULL");
}

function campCharge(row: CampRow, pricing: CampPricing, dayKeys: DayKey[]) {
  if (row.campType === "overnight") {
    if (mFriAllFull(row.enroll)) return pricing.overnight.fullWeek;
    return dayKeys.reduce((sum, key) => (row.enroll[key] !== "OFF" ? sum + pricing.overnight.perDay : sum), 0);
  }
  const p = row.campType === "general" ? pricing.general : pricing.competition;
  if (mFriAllFull(row.enroll)) return p.fullWeek;
  return dayKeys.reduce((sum, key) => {
    const e = row.enroll[key];
    if (e === "FULL") return sum + p.fullDay;
    if (e === "AM") return sum + p.am;
    if (e === "PM") return sum + p.pm;
    return sum;
  }, 0);
}

function lunchCharge(row: CampRow, dayKeys: DayKey[]) {
  return dayKeys.reduce((sum, key) => (row.lunch[key] ? sum + Math.max(0, Number(row.lunchPrice[key] ?? 0)) : sum), 0);
}

function tuitionTotal(row: CampRow, pricing: CampPricing, dayKeys: DayKey[]) {
  const gross = campCharge(row, pricing, dayKeys) + lunchCharge(row, dayKeys);
  return Math.max(0, gross - Math.max(0, row.discount));
}

function owedAmount(row: CampRow, pricing: CampPricing, dayKeys: DayKey[]) {
  return Math.max(0, tuitionTotal(row, pricing, dayKeys) - Math.max(0, row.paidAmount));
}

function makeRow(defaultCampType: CampType): CampRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    studentId: "",
    name: "",
    campType: defaultCampType,
    enroll: { ...EMPTY_ENROLL },
    lunch: { ...EMPTY_LUNCH },
    lunchItem: { ...EMPTY_LUNCH_ITEM },
    lunchPrice: { ...EMPTY_LUNCH_PRICE },
    discount: 0,
    paymentDate: "",
    paymentMethod: "Unpaid",
    paidAmount: 0,
    feesPaid: 0,
    paymentLog: [],
    notes: "",
  };
}

function makeExpense(): ExpenseRow {
  return {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: "",
    amount: 0,
    category: "",
    notes: "",
  };
}

function normalizeEnrollMap(raw: any): Record<DayKey, Enrollment> {
  const next = { ...EMPTY_ENROLL };
  DAYS.forEach((d) => {
    const v = String(raw?.[d.key] ?? "OFF").toUpperCase();
    next[d.key] = v === "FULL" || v === "AM" || v === "PM" ? (v as Enrollment) : "OFF";
  });
  return next;
}

function normalizeBoolMap(raw: any): Record<DayKey, boolean> {
  const next = { ...EMPTY_LUNCH };
  DAYS.forEach((d) => {
    next[d.key] = raw?.[d.key] === true;
  });
  return next;
}

function normalizeNumMap(raw: any): Record<DayKey, number> {
  const next = { ...EMPTY_LUNCH_PRICE };
  DAYS.forEach((d) => {
    next[d.key] = Math.max(0, Number(raw?.[d.key] ?? 0) || 0);
  });
  return next;
}

function normalizeLunchItemMap(raw: any): Record<DayKey, string> {
  const next = { ...EMPTY_LUNCH_ITEM };
  DAYS.forEach((d) => {
    next[d.key] = String(raw?.[d.key] ?? "").trim();
  });
  return next;
}

function avatarUrl(path: string | null) {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  return `/api/storage/signed-url?path=${encodeURIComponent(raw)}`;
}

function initials(name: string) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function AdminAccountingPage() {
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);
  const [unlockOk, setUnlockOk] = useState(false);
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState("");

  const [view, setView] = useState<ViewMode>("home");
  const [history, setHistory] = useState<ViewMode[]>([]);

  const [tabs, setTabs] = useState<AccountingTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [subView, setSubView] = useState<TabSubView>("tuition");
  const [seasons, setSeasons] = useState<AccountingSeason[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({
    tabs: 0,
    tuition: 0,
    paid: 0,
    owed: 0,
    expenses: 0,
    profit: 0,
  });

  const [createType, setCreateType] = useState<AccountingType>("camp");
  const [createTitle, setCreateTitle] = useState("");
  const [createYear, setCreateYear] = useState<number>(new Date().getFullYear());
  const [createSeasonId, setCreateSeasonId] = useState("");
  const [creatingTab, setCreatingTab] = useState(false);
  const [editTabTitle, setEditTabTitle] = useState("");
  const [editTabYear, setEditTabYear] = useState<number>(new Date().getFullYear());
  const [editTabSeasonId, setEditTabSeasonId] = useState("");
  const [savingTabMeta, setSavingTabMeta] = useState(false);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [showQuickAddStudent, setShowQuickAddStudent] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [quickStudent, setQuickStudent] = useState<QuickStudentForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    isCompetitionTeam: false,
  });

  const [campPricing, setCampPricing] = useState<CampPricing>({
    general: { fullWeek: 0, fullDay: 0, am: 0, pm: 0, enabled: true },
    competition: { fullWeek: 0, fullDay: 0, am: 0, pm: 0, enabled: true },
    overnight: { perDay: 0, fullWeek: 0, enabled: true },
    lunchExpenses: 0,
  });
  const [campRows, setCampRows] = useState<CampRow[]>([makeRow("general")]);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingRows, setSavingRows] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([makeExpense()]);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<string>("all");

  const [lunchEdit, setLunchEdit] = useState<{ rowId: string; day: DayKey } | null>(null);
  const [openLunchDay, setOpenLunchDay] = useState<DayKey | null>(null);
  const [paymentEditor, setPaymentEditor] = useState<{ rowId: string; amount: number; method: PaymentMethod; date: string; note: string } | null>(null);
  const [ledgerStudentFilter, setLedgerStudentFilter] = useState<string>("all");
  const [ledgerMethodFilter, setLedgerMethodFilter] = useState<string>("all");
  const [saveChipState, setSaveChipState] = useState<"saving" | "saved" | "error">("saved");
  const [saveChipText, setSaveChipText] = useState("All changes saved");

  const skipAutosavePricingRef = useRef(true);
  const skipAutosaveRowsRef = useRef(true);
  const skipAutosaveExpensesRef = useRef(true);
  const pricingAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expensesAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => String(t.id) === String(activeTabId)) ?? null,
    [tabs, activeTabId]
  );

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(
        tabs
          .map((t) => Number(t.accounting_year ?? 0))
          .filter((y) => Number.isFinite(y) && y > 0)
      )
    ).sort((a, b) => b - a);
    if (!years.length) return [new Date().getFullYear()];
    return years;
  }, [tabs]);

  const availableSeasonsForYear = useMemo(() => seasons, [seasons]);

  const filteredTabs = useMemo(() => {
    return tabs.filter((t) => {
      const yearMatch = Number(t.accounting_year ?? 0) === selectedYear;
      const seasonMatch = selectedSeasonId === "all" || String(t.accounting_season_id ?? "") === selectedSeasonId;
      return yearMatch && seasonMatch;
    });
  }, [tabs, selectedYear, selectedSeasonId]);

  const studentsById = useMemo(() => {
    const map = new Map<string, StudentOption>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const enabledCampTypes = useMemo(() => {
    const list: CampType[] = [];
    if (campPricing.general.enabled) list.push("general");
    if (campPricing.competition.enabled) list.push("competition");
    if (campPricing.overnight.enabled) list.push("overnight");
    return list;
  }, [campPricing]);

  const defaultCampType = useMemo<CampType>(() => enabledCampTypes[0] ?? "general", [enabledCampTypes]);
  const visibleDays = useMemo(
    () => (campPricing.overnight.enabled ? DAYS : DAYS.filter((d) => d.key !== "su" && d.key !== "sa")),
    [campPricing.overnight.enabled]
  );
  const billableDayKeys = useMemo(() => visibleDays.map((d) => d.key), [visibleDays]);

  const lunchSummaryByDay = useMemo(() => {
    return visibleDays.map((d) => {
      const rowsForDay = campRows.filter((row) => row.lunch[d.key] && row.name.trim());
      const count = rowsForDay.length;
      const revenue = rowsForDay.reduce((sum, row) => sum + Math.max(0, Number(row.lunchPrice[d.key] ?? 0)), 0);
      return { key: d.key, label: d.label, rowsForDay, count, revenue };
    });
  }, [campRows, visibleDays]);

  const lunchItemOptions = useMemo(() => {
    const set = new Set<string>();
    campRows.forEach((row) => {
      visibleDays.forEach((d) => {
        const item = String(row.lunchItem[d.key] ?? "").trim();
        if (item) set.add(item);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [campRows, visibleDays]);

  const lunchItemTotals = useMemo(() => {
    const counts = new Map<string, number>();
    campRows.forEach((row) => {
      visibleDays.forEach((d) => {
        if (!row.lunch[d.key]) return;
        const item = String(row.lunchItem[d.key] ?? "").trim();
        if (!item) return;
        counts.set(item, (counts.get(item) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
  }, [campRows, visibleDays]);

  const autoFeeExpenses = useMemo(
    () =>
      campRows
        .filter((row) => row.name.trim() && Math.max(0, Number(row.feesPaid ?? 0) || 0) > 0)
        .map((row) => ({
          id: `auto-fee-${row.id}`,
          item: `${row.name} fees`,
          amount: Math.max(0, Number(row.feesPaid ?? 0) || 0),
          category: "fees",
          notes: "Auto from tuition fees column",
        })),
    [campRows]
  );
  const allExpensesForSummary = useMemo(() => [...expenses, ...autoFeeExpenses], [expenses, autoFeeExpenses]);

  const summary = useMemo(() => {
    const totalRevenue = campRows.reduce((sum, row) => sum + tuitionTotal(row, campPricing, billableDayKeys), 0);
    const lunchRevenue = campRows.reduce((sum, row) => sum + lunchCharge(row, billableDayKeys), 0);
    const studentCount = campRows.filter((r) => r.name.trim()).length;
    const unpaidStudentAmount = campRows.reduce((sum, row) => sum + owedAmount(row, campPricing, billableDayKeys), 0);
    const paidStudentTotal = campRows.reduce((sum, row) => sum + Math.max(0, Number(row.paidAmount ?? 0) || 0), 0);
    const totalExpenses = allExpensesForSummary.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount ?? 0) || 0), 0);
    const lunchExpenses = Math.max(0, Number(campPricing.lunchExpenses ?? 0));
    const totalProfit = totalRevenue - totalExpenses;
    const lunchProfit = lunchRevenue - lunchExpenses;

    const competitionCount = campRows.reduce((sum, row) => {
      const student = row.studentId ? studentsById.get(row.studentId) : null;
      if (student?.isCompetitionTeam) return sum + 1;
      return row.campType === "competition" ? sum + 1 : sum;
    }, 0);
    const generalCount = Math.max(0, studentCount - competitionCount);

    return {
      totalRevenue,
      lunchRevenue,
      studentCount,
      unpaidStudentAmount,
      paidStudentTotal,
      paidPlusUnpaid: paidStudentTotal + unpaidStudentAmount,
      totalExpenses,
      lunchExpenses,
      totalProfit,
      lunchProfit,
      generalCount,
      competitionCount,
    };
  }, [campRows, campPricing, allExpensesForSummary, studentsById, billableDayKeys]);

  const rosterRows = useMemo(
    () => campRows.filter((row) => row.name.trim()).map((row) => ({ ...row, student: row.studentId ? studentsById.get(row.studentId) : null })),
    [campRows, studentsById]
  );

  const expenseCategories = activeTab?.tab_type === "camp" ? CAMP_EXPENSE_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const expenseFilterOptions = useMemo(() => {
    const fromRows = allExpensesForSummary
      .map((row) => String(row.category ?? "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set([...expenseCategories, "fees", ...fromRows]));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [expenseCategories, allExpensesForSummary]);
  const visibleExpenses = useMemo(() => {
    if (expenseFilter === "all") return allExpensesForSummary;
    return allExpensesForSummary.filter((row) => String(row.category ?? "").trim() === expenseFilter);
  }, [allExpensesForSummary, expenseFilter]);

  const ledgerRecords = useMemo<LedgerRecord[]>(() => {
    const records: LedgerRecord[] = [];
    campRows.forEach((row) => {
      if (row.paymentLog.length) {
        row.paymentLog.forEach((entry) => {
          records.push({
            id: `${row.id}-${entry.id}`,
            rowId: row.id,
            studentId: row.studentId,
            studentName: row.name || "Unknown",
            amount: Math.max(0, Number(entry.amount ?? 0) || 0),
            method: entry.method,
            date: entry.date || "",
            note: entry.note ?? "",
          });
        });
      } else if (Math.max(0, Number(row.paidAmount ?? 0) || 0) > 0) {
        records.push({
          id: `${row.id}-fallback`,
          rowId: row.id,
          studentId: row.studentId,
          studentName: row.name || "Unknown",
          amount: Math.max(0, Number(row.paidAmount ?? 0) || 0),
          method: row.paymentMethod || "Cash",
          date: row.paymentDate || "",
          note: "From paid amount",
        });
      }
    });
    return records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [campRows]);
  const filteredLedgerRecords = useMemo(
    () =>
      ledgerRecords.filter((record) => {
        if (ledgerStudentFilter !== "all" && record.studentId !== ledgerStudentFilter) return false;
        if (ledgerMethodFilter !== "all" && record.method !== ledgerMethodFilter) return false;
        return true;
      }),
    [ledgerMethodFilter, ledgerRecords, ledgerStudentFilter]
  );

  function pushView(next: ViewMode) {
    setHistory((prev) => [...prev, view]);
    setView(next);
  }

  function goBack() {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const copy = [...prev];
      const last = copy.pop() as ViewMode;
      setView(last);
      return copy;
    });
  }

  function goHome() {
    setView("home");
    setHistory([]);
  }

  async function loadTabs() {
    const res = await fetch("/api/admin/accounting/tabs", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(json?.error ?? "Failed to load accounting tabs"));
      return;
    }
    const currentYear = new Date().getFullYear();
    const list = ((json?.tabs ?? []) as AccountingTab[]).map((tab) => ({
      ...tab,
      accounting_year: Number(tab?.accounting_year ?? 0) > 0 ? Number(tab.accounting_year) : currentYear,
      accounting_season_id: tab?.accounting_season_id ? String(tab.accounting_season_id) : null,
    }));
    setTabs(list);
    const years = Array.from(
      new Set(
        list
          .map((t) => Number(t.accounting_year ?? 0))
          .filter((y) => Number.isFinite(y) && y > 0)
      )
    ).sort((a, b) => b - a);
    if (years.length && !years.includes(selectedYear)) setSelectedYear(years[0]);
    if (list.length && !list.some((t) => t.id === activeTabId)) setActiveTabId(list[0].id);
  }

  async function loadSeasons() {
    const res = await fetch("/api/admin/accounting/seasons", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(json?.error ?? "Failed to load seasons"));
      return;
    }
    const list = (json?.seasons ?? []) as AccountingSeason[];
    setSeasons(list);
    if (!createSeasonId && list.length) setCreateSeasonId(String(list[0].id));
  }

  async function loadStudents() {
    const res = await fetch("/api/students/list", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(json?.error ?? "Failed to load students"));
      return;
    }
    const list = ((json?.students ?? []) as any[]).map((s) => ({
      id: String(s.id),
      name: String(s.name ?? "").trim(),
      isCompetitionTeam: s.is_competition_team === true,
      avatarPath: s.avatar_storage_path ? String(s.avatar_storage_path) : null,
    })) as StudentOption[];
    setStudents(list.filter((s) => s.id && s.name));
  }

  async function loadCampData(tabId: string) {
    if (!tabId) return;
    const [pricingRes, rowsRes] = await Promise.all([
      fetch(`/api/admin/accounting/pricing?tab_id=${encodeURIComponent(tabId)}`, { cache: "no-store" }),
      fetch(`/api/admin/accounting/entries?tab_id=${encodeURIComponent(tabId)}`, { cache: "no-store" }),
    ]);
    const [pricingJson, rowsJson] = await Promise.all([
      pricingRes.json().catch(() => ({})),
      rowsRes.json().catch(() => ({})),
    ]);
    if (pricingRes.ok) {
      const p = pricingJson?.pricing ?? {};
      skipAutosavePricingRef.current = true;
      setCampPricing({
        general: {
          fullWeek: Number(p.general_full_week ?? 0) || 0,
          fullDay: Number(p.general_full_day ?? 0) || 0,
          am: Number(p.general_am ?? 0) || 0,
          pm: Number(p.general_pm ?? 0) || 0,
          enabled: p.general_enabled !== false,
        },
        competition: {
          fullWeek: Number(p.competition_full_week ?? 0) || 0,
          fullDay: Number(p.competition_full_day ?? 0) || 0,
          am: Number(p.competition_am ?? 0) || 0,
          pm: Number(p.competition_pm ?? 0) || 0,
          enabled: p.competition_enabled !== false,
        },
        overnight: {
          perDay: Number(p.overnight_per_day ?? 0) || 0,
          fullWeek: Number(p.overnight_full_week ?? 0) || 0,
          enabled: p.overnight_enabled !== false,
        },
        lunchExpenses: Number(p.lunch_expenses ?? 0) || 0,
      });
    } else {
      setMsg(String(pricingJson?.error ?? "Failed to load pricing"));
    }
    if (rowsRes.ok) {
      const rows = ((rowsJson?.rows ?? []) as any[]).map((r) => ({
        id: String(r.id),
        studentId: String(r.student_id ?? "").trim(),
        name: String(r.student_name ?? ""),
        campType: String(r.camp_type ?? "general") as CampType,
        enroll: normalizeEnrollMap(r.enrollment_by_day),
        lunch: normalizeBoolMap(r.lunch_by_day),
        lunchItem: normalizeLunchItemMap(r.lunch_item_by_day),
        lunchPrice: normalizeNumMap(r.lunch_price_by_day),
        discount: Math.max(0, Number(r.manual_discount ?? 0) || 0),
        paymentDate: String(r.payment_date ?? ""),
        paymentMethod: (String(r.payment_method ?? "Unpaid") as PaymentMethod),
        paidAmount: Math.max(0, Number(r.paid_amount ?? 0) || 0),
        feesPaid: Math.max(0, Number(r.fees_paid ?? 0) || 0),
        paymentLog: Array.isArray(r.payment_log)
          ? r.payment_log
              .map((entry: any) => ({
                id: String(entry?.id ?? `legacy-${Math.random().toString(36).slice(2, 8)}`),
                date: String(entry?.date ?? ""),
                method: String(entry?.method ?? "Unpaid") as PaymentMethod,
                amount: Math.max(0, Number(entry?.amount ?? 0) || 0),
                note: String(entry?.note ?? ""),
              }))
              .filter((entry: PaymentLogEntry) => entry.amount > 0)
          : [],
        notes: String(r.notes ?? ""),
      })) as CampRow[];
      const normalizedRows = rows.map((row) => {
        if (row.paymentLog.length || row.paidAmount > 0) return row;
        const legacyPaid = Math.max(0, Number((row as any).feesPaid ?? 0) || 0);
        if (!legacyPaid) return row;
        const legacyDate = row.paymentDate || new Date().toISOString().slice(0, 10);
        return {
          ...row,
          paidAmount: legacyPaid,
          paymentLog: [
            {
              id: `legacy-${row.id}`,
              date: legacyDate,
              method: row.paymentMethod || "Cash",
              amount: legacyPaid,
              note: "Migrated legacy payment",
            },
          ],
        };
      });
      skipAutosaveRowsRef.current = true;
      setCampRows(normalizedRows.length ? normalizedRows : [makeRow(defaultCampType)]);
    } else {
      setMsg(String(rowsJson?.error ?? "Failed to load entries"));
    }
  }

  async function loadExpenses(tabId: string) {
    if (!tabId) return;
    const res = await fetch(`/api/admin/accounting/expenses?tab_id=${encodeURIComponent(tabId)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setExpenses([makeExpense()]);
      setMsg(String(json?.error ?? "Failed to load expenses"));
      return;
    }
    const rows = ((json?.rows ?? []) as any[]).map((r) => ({
      id: String(r.id),
      item: String(r.item ?? ""),
      amount: Math.max(0, Number(r.amount ?? 0) || 0),
      category: String(r.category ?? ""),
      notes: String(r.notes ?? ""),
    })) as ExpenseRow[];
    skipAutosaveExpensesRef.current = true;
    setExpenses(rows.length ? rows : [makeExpense()]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({}));
      const nextRole = String(me?.role ?? "student");
      setRole(nextRole);
      if (nextRole === "admin") {
        const sRes = await fetch("/api/admin/accounting/settings", { cache: "no-store" });
        const sJson = await sRes.json().catch(() => ({}));
        if (sRes.ok) setPinSet(Boolean(sJson?.pin_set));
        else setMsg(String(sJson?.error ?? "Failed to load accounting settings"));
        try {
          const unlocked = window.sessionStorage.getItem("accounting_pin_ok") === "1";
          if (unlocked) {
            setUnlockOk(true);
            await Promise.all([loadTabs(), loadStudents(), loadSeasons()]);
          }
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (view === "tab" && activeTab?.id) {
      void Promise.all([loadCampData(activeTab.id), loadExpenses(activeTab.id)]);
    }
  }, [view, activeTab?.id]);

  useEffect(() => {
    setSubView("tuition");
    setLunchEdit(null);
    setOpenLunchDay(null);
  }, [activeTabId]);

  useEffect(() => {
    if (!activeTab) {
      setEditTabTitle("");
      setEditTabYear(new Date().getFullYear());
      setEditTabSeasonId("");
      return;
    }
    setEditTabTitle(String(activeTab.title ?? ""));
    setEditTabYear(Number(activeTab.accounting_year ?? new Date().getFullYear()));
    setEditTabSeasonId(String(activeTab.accounting_season_id ?? ""));
  }, [activeTab]);

  useEffect(() => {
    if (selectedSeasonId === "all") return;
    if (!seasons.some((season) => String(season.id) === selectedSeasonId)) {
      setSelectedSeasonId("all");
    }
  }, [seasons, selectedSeasonId]);

  useEffect(() => {
    if (!students.length) return;
    setCampRows((prev) => prev.map((row) => {
      if (row.studentId) return row;
      const matched = students.find((s) => s.name.toLowerCase() === row.name.trim().toLowerCase());
      if (!matched) return row;
      return { ...row, studentId: matched.id };
    }));
  }, [students]);

  useEffect(() => {
    if (campPricing.overnight.enabled) return;
    setCampRows((prev) =>
      prev.map((row) => ({
        ...row,
        enroll: { ...row.enroll, su: "OFF", sa: "OFF" },
        lunch: { ...row.lunch, su: false, sa: false },
        lunchItem: { ...row.lunchItem, su: "", sa: "" },
        lunchPrice: { ...row.lunchPrice, su: 0, sa: 0 },
      }))
    );
  }, [campPricing.overnight.enabled]);

  useEffect(() => {
    if (view !== "tab" || !activeTab?.id) return;
    if (skipAutosavePricingRef.current) {
      skipAutosavePricingRef.current = false;
      return;
    }
    if (pricingAutosaveTimerRef.current) clearTimeout(pricingAutosaveTimerRef.current);
    setSaveChipState("saving");
    setSaveChipText("Saving changes...");
    pricingAutosaveTimerRef.current = setTimeout(() => {
      void savePricingToDb({ autosave: true });
    }, 650);
  }, [campPricing, view, activeTab?.id]);

  useEffect(() => {
    if (view !== "tab" || !activeTab?.id) return;
    if (skipAutosaveRowsRef.current) {
      skipAutosaveRowsRef.current = false;
      return;
    }
    if (rowsAutosaveTimerRef.current) clearTimeout(rowsAutosaveTimerRef.current);
    setSaveChipState("saving");
    setSaveChipText("Saving changes...");
    rowsAutosaveTimerRef.current = setTimeout(() => {
      void saveRowsToDb({ autosave: true });
    }, 750);
  }, [campRows, view, activeTab?.id]);

  useEffect(() => {
    if (view !== "tab" || !activeTab?.id) return;
    if (skipAutosaveExpensesRef.current) {
      skipAutosaveExpensesRef.current = false;
      return;
    }
    if (expensesAutosaveTimerRef.current) clearTimeout(expensesAutosaveTimerRef.current);
    setSaveChipState("saving");
    setSaveChipText("Saving changes...");
    expensesAutosaveTimerRef.current = setTimeout(() => {
      void saveExpensesToDb({ autosave: true });
    }, 700);
  }, [expenses, view, activeTab?.id]);

  useEffect(() => {
    return () => {
      if (pricingAutosaveTimerRef.current) clearTimeout(pricingAutosaveTimerRef.current);
      if (rowsAutosaveTimerRef.current) clearTimeout(rowsAutosaveTimerRef.current);
      if (expensesAutosaveTimerRef.current) clearTimeout(expensesAutosaveTimerRef.current);
    };
  }, []);

  async function loadSummaryMetricsForFilter(year: number, seasonId: string) {
    const tabsForFilter = tabs.filter((t) => {
      if (Number(t.accounting_year ?? 0) !== year) return false;
      if (seasonId !== "all" && String(t.accounting_season_id ?? "") !== seasonId) return false;
      return true;
    });
    if (!tabsForFilter.length) {
      setSummaryMetrics({ tabs: 0, tuition: 0, paid: 0, owed: 0, expenses: 0, profit: 0 });
      return;
    }
    setSummaryLoading(true);
    let tuition = 0;
    let paid = 0;
    let owed = 0;
    let expensesTotal = 0;
    for (const tab of tabsForFilter) {
      const tabId = String(tab.id);
      const [rowsRes, expensesRes] = await Promise.all([
        fetch(`/api/admin/accounting/entries?tab_id=${encodeURIComponent(tabId)}`, { cache: "no-store" }),
        fetch(`/api/admin/accounting/expenses?tab_id=${encodeURIComponent(tabId)}`, { cache: "no-store" }),
      ]);
      const [rowsJson, expensesJson] = await Promise.all([
        rowsRes.json().catch(() => ({})),
        expensesRes.json().catch(() => ({})),
      ]);
      const rows = (rowsJson?.rows ?? []) as any[];
      const expensesRows = (expensesJson?.rows ?? []) as any[];
      rows.forEach((row) => {
        tuition += Math.max(0, Number(row?.total_revenue ?? 0) || 0);
        paid += Math.max(0, Number(row?.paid_amount ?? row?.fees_paid ?? 0) || 0);
      });
      expensesRows.forEach((row) => {
        expensesTotal += Math.max(0, Number(row?.amount ?? 0) || 0);
      });
    }
    owed = Math.max(0, tuition - paid);
    setSummaryMetrics({
      tabs: tabsForFilter.length,
      tuition,
      paid,
      owed,
      expenses: expensesTotal,
      profit: tuition - expensesTotal,
    });
    setSummaryLoading(false);
  }

  useEffect(() => {
    if (view !== "summary") return;
    void loadSummaryMetricsForFilter(selectedYear, selectedSeasonId);
  }, [view, selectedYear, selectedSeasonId, tabs]);

  async function verifyAccountingAccess() {
    setMsg("");
    if (!accessCode.trim()) return setMsg("Enter Accounting PIN or NFC code.");
    const res = await fetch("/api/admin/accounting/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: accessCode.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(json?.error ?? "Access denied"));
    setUnlockOk(true);
    try {
      window.sessionStorage.setItem("accounting_pin_ok", "1");
    } catch {}
    setAccessCode("");
    await Promise.all([loadTabs(), loadStudents(), loadSeasons()]);
  }

  async function setAccountingPin() {
    setMsg("");
    if (!newPin.trim()) return setMsg("Enter new Accounting PIN.");
    const res = await fetch("/api/admin/accounting/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounting_pin: newPin.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to set PIN"));
    setPinSet(true);
    setNewPin("");
    setMsg("Accounting PIN saved.");
  }

  async function createQuickStudentAndAccount() {
    setMsg("");
    if (!quickStudent.firstName.trim() || !quickStudent.lastName.trim()) return setMsg("First and last name are required.");
    if (!quickStudent.email.trim()) return setMsg("Email is required to create student account login.");

    setCreatingStudent(true);
    const createStudentRes = await fetch("/api/admin/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: quickStudent.firstName.trim(),
        last_name: quickStudent.lastName.trim(),
        email: quickStudent.email.trim(),
        is_competition_team: quickStudent.isCompetitionTeam,
      }),
    });
    const createStudentJson = await createStudentRes.json().catch(() => ({}));
    if (!createStudentRes.ok) {
      setCreatingStudent(false);
      return setMsg(String(createStudentJson?.error ?? "Failed to create student."));
    }

    const student = createStudentJson?.student;
    if (!student?.id) {
      setCreatingStudent(false);
      return setMsg("Student created but id was missing.");
    }

    const createUserRes = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: quickStudent.email.trim(),
        display_name: String(student.name ?? `${quickStudent.firstName} ${quickStudent.lastName}`),
        password: quickStudent.password.trim() || undefined,
        role: "student",
        student_id: String(student.id),
      }),
    });
    const createUserJson = await createUserRes.json().catch(() => ({}));
    setCreatingStudent(false);
    if (!createUserRes.ok) {
      return setMsg(`Student created, but account creation failed: ${String(createUserJson?.error ?? "Unknown error")}`);
    }

    await loadStudents();
    const createdStudent: StudentOption = {
      id: String(student.id),
      name: String(student.name ?? `${quickStudent.firstName} ${quickStudent.lastName}`).trim(),
      isCompetitionTeam: quickStudent.isCompetitionTeam,
      avatarPath: null,
    };
    setCampRows((prev) => [
      ...prev,
      {
        ...makeRow(quickStudent.isCompetitionTeam ? "competition" : defaultCampType),
        studentId: createdStudent.id,
        name: createdStudent.name,
      },
    ]);
    setQuickStudent({ firstName: "", lastName: "", email: "", password: "", isCompetitionTeam: false });
    setShowQuickAddStudent(false);
    const temp = String(createUserJson?.temp_password ?? "").trim();
    setMsg(temp ? `Student + account created. Temporary password: ${temp}` : "Student + account created.");
  }

  async function createTab() {
    setMsg("");
    if (!createTitle.trim()) return setMsg("Enter a title for the accounting tab.");
    if (!createSeasonId) return setMsg("Select accounting season.");
    if (!Number.isFinite(createYear) || createYear < 2000 || createYear > 2100) return setMsg("Enter a valid accounting year.");
    setCreatingTab(true);
    const res = await fetch("/api/admin/accounting/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: createTitle.trim(),
        tab_type: createType,
        accounting_year: createYear,
        accounting_season_id: createSeasonId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setCreatingTab(false);
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to create tab"));
    const created = json?.tab as AccountingTab;
    setTabs((prev) => [...prev, created]);
    setActiveTabId(created.id);
    setCreateTitle("");
    setCreateType("camp");
    setSelectedYear(Number(created.accounting_year ?? createYear));
    setSelectedSeasonId(String(created.accounting_season_id ?? createSeasonId));
    setSubView("tuition");
    pushView("tab");
  }

  async function createSeason() {
    setMsg("");
    if (!newSeasonName.trim()) return setMsg("Enter season name.");
    setCreatingSeason(true);
    const res = await fetch("/api/admin/accounting/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSeasonName.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setCreatingSeason(false);
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to create season"));
    await loadSeasons();
    setNewSeasonName("");
    setMsg("Season created.");
  }

  async function saveActiveTabMeta() {
    if (!activeTab?.id) return;
    setMsg("");
    if (!editTabTitle.trim()) return setMsg("Tab title is required.");
    if (!Number.isFinite(editTabYear) || editTabYear < 2000 || editTabYear > 2100) return setMsg("Enter a valid accounting year.");
    if (!editTabSeasonId) return setMsg("Select accounting season.");
    setSavingTabMeta(true);
    const res = await fetch("/api/admin/accounting/tabs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: activeTab.id,
        title: editTabTitle.trim(),
        accounting_year: editTabYear,
        accounting_season_id: editTabSeasonId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingTabMeta(false);
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to update tab"));
    const updated = json?.tab as AccountingTab;
    setTabs((prev) => prev.map((tab) => (tab.id === updated.id ? { ...tab, ...updated } : tab)));
    setSelectedYear(Number(updated.accounting_year ?? editTabYear));
    setSelectedSeasonId(String(updated.accounting_season_id ?? editTabSeasonId));
    setMsg("Accounting tab saved.");
  }

  function openExpensesTab() {
    const tabToUse = activeTab ?? tabs[0] ?? null;
    if (tabToUse) {
      setActiveTabId(tabToUse.id);
      setSubView("expenses");
      if (view !== "tab") pushView("tab");
      return;
    }
    const existing = tabs.find((t) => t.tab_type === "expenses");
    if (existing) {
      setActiveTabId(existing.id);
      setSubView("expenses");
      pushView("tab");
      return;
    }
    setCreateType("expenses");
    setCreateTitle("Expenses");
    pushView("create");
  }

  async function savePricingToDb(opts?: { autosave?: boolean }) {
    if (!activeTab?.id) return;
    const autosave = opts?.autosave === true;
    setSavingPricing(true);
    const res = await fetch("/api/admin/accounting/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab_id: activeTab.id,
        pricing: {
          general_full_week: campPricing.general.fullWeek,
          general_full_day: campPricing.general.fullDay,
          general_am: campPricing.general.am,
          general_pm: campPricing.general.pm,
          general_enabled: campPricing.general.enabled,
          competition_full_week: campPricing.competition.fullWeek,
          competition_full_day: campPricing.competition.fullDay,
          competition_am: campPricing.competition.am,
          competition_pm: campPricing.competition.pm,
          competition_enabled: campPricing.competition.enabled,
          overnight_per_day: campPricing.overnight.perDay,
          overnight_full_week: campPricing.overnight.fullWeek,
          overnight_enabled: campPricing.overnight.enabled,
          lunch_expenses: campPricing.lunchExpenses,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingPricing(false);
    if (!res.ok) {
      if (autosave) {
        setSaveChipState("error");
        setSaveChipText("Autosave failed");
      } else {
        setMsg(String(json?.error ?? "Failed to save pricing"));
      }
      return;
    }
    if (autosave) {
      setSaveChipState("saved");
      setSaveChipText("All changes saved");
    } else {
      setSaveChipState("saved");
      setSaveChipText("All changes saved");
      setMsg("Pricing saved.");
    }
  }

  async function saveRowsToDb(opts?: { autosave?: boolean }) {
    if (!activeTab?.id) return;
    const autosave = opts?.autosave === true;
    setSavingRows(true);
    const payload = campRows.map((row) => ({
      id: row.id.startsWith("row-") ? null : row.id,
      student_id: row.studentId || null,
      student_name: row.name,
      camp_type: row.campType,
      enrollment_by_day: row.enroll,
      lunch_by_day: row.lunch,
      lunch_item_by_day: row.lunchItem,
      lunch_price_by_day: row.lunchPrice,
      manual_discount: row.discount,
      payment_date: row.paymentDate || null,
      payment_method: row.paymentMethod || null,
      paid_amount: row.paidAmount,
      fees_paid: row.feesPaid,
      payment_log: row.paymentLog,
      total_revenue: tuitionTotal(row, campPricing, billableDayKeys),
      notes: row.notes ?? null,
    }));
    const res = await fetch("/api/admin/accounting/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab_id: activeTab.id, entries: payload }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingRows(false);
    if (!res.ok) {
      if (autosave) {
        setSaveChipState("error");
        setSaveChipText("Autosave failed");
      } else {
        setMsg(String(json?.error ?? "Failed to save rows"));
      }
      return;
    }
    await loadCampData(activeTab.id);
    if (autosave) {
      setSaveChipState("saved");
      setSaveChipText("All changes saved");
    } else {
      setSaveChipState("saved");
      setSaveChipText("All changes saved");
      setMsg("Rows saved.");
    }
  }

  async function saveExpensesToDb(opts?: { autosave?: boolean }) {
    if (!activeTab?.id) return;
    const autosave = opts?.autosave === true;
    setSavingExpenses(true);
    const payload = expenses.map((row) => ({
      id: row.id.startsWith("exp-") ? null : row.id,
      item: row.item,
      amount: row.amount,
      category: row.category,
      notes: row.notes,
    }));
    const res = await fetch("/api/admin/accounting/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab_id: activeTab.id, expenses: payload }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingExpenses(false);
    if (!res.ok) {
      if (autosave) {
        setSaveChipState("error");
        setSaveChipText("Autosave failed");
      } else {
        setMsg(String(json?.error ?? "Failed to save expenses"));
      }
      return;
    }
    await loadExpenses(activeTab.id);
    if (autosave) {
      setSaveChipState("saved");
      setSaveChipText("All changes saved");
    } else {
      setSaveChipState("saved");
      setSaveChipText("All changes saved");
      setMsg("Expenses saved.");
    }
  }

  async function deleteRowFromDb(row: CampRow) {
    if (row.id.startsWith("row-")) {
      setCampRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const res = await fetch("/api/admin/accounting/entries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to delete row"));
    setCampRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  async function deleteExpenseFromDb(row: ExpenseRow) {
    if (row.id.startsWith("exp-")) {
      setExpenses((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const res = await fetch("/api/admin/accounting/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to delete expense"));
    setExpenses((prev) => prev.filter((r) => r.id !== row.id));
  }

  if (loading) return <main style={wrap()}><div>Loading accounting...</div></main>;
  if (role !== "admin") return <main style={wrap()}><div style={title()}>Admin access required.</div></main>;

  if (!unlockOk) {
    return (
      <main style={wrap()}>
        <div style={saveChip(saveChipState)}>{saveChipText}</div>
        <div style={title()}>Admin Accounting</div>
        <section style={card()}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Accounting Gate</div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Enter Accounting PIN or use NFC reader tag. This is separate from other PINs.
          </div>
          <input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") verifyAccountingAccess();
            }}
            placeholder="Accounting PIN or NFC code"
            style={input()}
          />
          <button type="button" onClick={verifyAccountingAccess} style={btnPrimary()}>Unlock Accounting</button>
          {pinSet === false ? (
            <div style={{ display: "grid", gap: 8, marginTop: 10, borderTop: "1px solid rgba(148,163,184,0.3)", paddingTop: 10 }}>
              <div style={{ fontWeight: 900 }}>Set Accounting PIN</div>
              <input
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New accounting PIN"
                style={input()}
              />
              <button type="button" onClick={setAccountingPin} style={btnGhost()}>Save PIN</button>
            </div>
          ) : null}
          {msg ? <div style={notice(msg.toLowerCase().includes("saved") || msg.toLowerCase().includes("created"))}>{msg}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main style={wrap()}>
      <div style={saveChip(saveChipState)}>{saveChipText}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={title()}>Admin Accounting</div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "home" ? <button type="button" onClick={goBack} style={btnGhost()}>Back</button> : null}
          {view !== "home" ? <button type="button" onClick={goHome} style={btnGhost()}>Home</button> : null}
        </div>
      </div>

      {view === "tab" && filteredTabs.length ? (
        <section style={folderRail()}>
          {filteredTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTabId(tab.id);
                if (view !== "tab") pushView("tab");
              }}
              style={folderTab(activeTabId === tab.id && view === "tab")}
            >
              {tab.title}
            </button>
          ))}
        </section>
      ) : null}

      {msg ? <div style={notice(msg.toLowerCase().includes("saved") || msg.toLowerCase().includes("created"))}>{msg}</div> : null}

      {view === "home" ? (
        <section style={homeGrid()}>
          <button type="button" onClick={() => pushView("browse_tabs")} style={homeCard()}>
            <div style={homeTitle()}>View My Accounting Tabs</div>
            <div style={homeDesc()}>Open year tabs, then season tabs, then your accounting tabs.</div>
          </button>
          <button type="button" onClick={() => pushView("summary")} style={homeCard()}>
            <div style={homeTitle()}>Summary</div>
            <div style={homeDesc()}>Choose season/year and view dashboard stats.</div>
          </button>
          <button type="button" onClick={() => pushView("create")} style={homeCard()}>
            <div style={homeTitle()}>Create Accounting Tab</div>
            <div style={homeDesc()}>Create camp/classes/events/testing tabs in-page.</div>
          </button>
          <button type="button" onClick={() => pushView("settings")} style={homeCard()}>
            <div style={homeTitle()}>Accounting Settings</div>
            <div style={homeDesc()}>Manage season categories and accounting setup.</div>
          </button>
          <button type="button" onClick={openExpensesTab} style={homeCard()}>
            <div style={homeTitle()}>Expenses</div>
            <div style={homeDesc()}>Open expenses inside your selected accounting tab.</div>
          </button>
        </section>
      ) : null}

      {view === "browse_tabs" ? (
        <section style={card()}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>View My Accounting Tabs</div>
          <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>Select year, then season, then open tab.</div>
          <section style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, opacity: 0.82, marginBottom: 6 }}>Year Tabs</div>
            <div style={folderRail()}>
              {availableYears.map((year) => (
                <button key={`browse-year-${year}`} type="button" onClick={() => setSelectedYear(year)} style={folderTab(selectedYear === year)}>
                  {year}
                </button>
              ))}
            </div>
          </section>
          <section style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, opacity: 0.82, marginBottom: 6 }}>Season Tabs</div>
            <div style={folderRail()}>
              <button type="button" onClick={() => setSelectedSeasonId("all")} style={folderTab(selectedSeasonId === "all")}>All Seasons</button>
              {availableSeasonsForYear.map((season) => (
                <button key={`browse-season-${season.id}`} type="button" onClick={() => setSelectedSeasonId(season.id)} style={folderTab(selectedSeasonId === season.id)}>
                  {season.name}
                </button>
              ))}
            </div>
          </section>
          <section style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, opacity: 0.82, marginBottom: 6 }}>Accounting Tabs</div>
            {filteredTabs.length ? (
              <div style={folderRail()}>
                {filteredTabs.map((tab) => (
                  <button
                    key={`browse-tab-${tab.id}`}
                    type="button"
                    onClick={() => {
                      setActiveTabId(tab.id);
                      pushView("tab");
                    }}
                    style={folderTab(false)}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.75 }}>No accounting tabs for this year/season.</div>
            )}
          </section>
        </section>
      ) : null}

      {view === "create" ? (
        <section style={card()}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Create Accounting Tab</div>
          <div style={{ opacity: 0.78, fontSize: 13 }}>Select type, enter title, then create.</div>
          <div style={typeRow()}>
            {(["camp", "normal_classes", "events", "testing"] as AccountingType[]).map((type) => (
              <button key={type} type="button" onClick={() => setCreateType(type)} style={typeChip(createType === type)}>
                {type === "normal_classes" ? "Normal Classes" : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <label style={fieldLabel()}>
            Tab title
            <input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={createType === "camp" ? "Camp Name (ex: Spring Camp 2026)" : "Accounting Tab Title"}
              style={input()}
            />
          </label>
          <label style={fieldLabel()}>
            Accounting Year
            <input value={createYear} onChange={(e) => setCreateYear(Math.max(2000, Number(e.target.value) || new Date().getFullYear()))} style={input()} />
          </label>
          <label style={fieldLabel()}>
            Accounting Season
            <select value={createSeasonId} onChange={(e) => setCreateSeasonId(e.target.value)} style={input()}>
              <option value="">Select season</option>
              {seasons.map((season) => (
                <option key={`create-season-${season.id}`} value={season.id}>{season.name}</option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={createTab} style={btnPrimary()} disabled={creatingTab}>
              {creatingTab ? "Creating..." : "Create"}
            </button>
            <button type="button" onClick={goBack} style={btnGhost()}>Back</button>
          </div>
        </section>
      ) : null}

      {view === "summary" ? (
        <section style={card()}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Accounting Summary</div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            <label style={fieldLabel()}>
              Year
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value) || new Date().getFullYear())} style={input()}>
                {availableYears.map((year) => <option key={`summary-year-${year}`} value={year}>{year}</option>)}
              </select>
            </label>
            <label style={fieldLabel()}>
              Season
              <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)} style={input()}>
                <option value="all">All Seasons</option>
                {availableSeasonsForYear.map((season) => <option key={`summary-season-${season.id}`} value={season.id}>{season.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <article style={summaryCardTone("info")}><div style={summaryLabel()}>Tabs</div><div style={summaryValue()}>{summaryLoading ? "..." : summaryMetrics.tabs}</div></article>
            <article style={summaryCardTone("revenue")}><div style={summaryLabel()}>Tuition</div><div style={summaryValue()}>{summaryLoading ? "..." : money(summaryMetrics.tuition)}</div></article>
            <article style={summaryCardTone("revenue")}><div style={summaryLabel()}>Paid</div><div style={summaryValue()}>{summaryLoading ? "..." : money(summaryMetrics.paid)}</div></article>
            <article style={summaryCardTone("info")}><div style={summaryLabel()}>Owed</div><div style={summaryValue()}>{summaryLoading ? "..." : money(summaryMetrics.owed)}</div></article>
            <article style={summaryCardTone("expense")}><div style={summaryLabel()}>Expenses</div><div style={summaryValue()}>{summaryLoading ? "..." : money(summaryMetrics.expenses)}</div></article>
            <article style={summaryCardTone("profit")}><div style={summaryLabel()}>Profit</div><div style={summaryValue()}>{summaryLoading ? "..." : money(summaryMetrics.profit)}</div></article>
          </div>
        </section>
      ) : null}

      {view === "settings" ? (
        <section style={card()}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Accounting Settings</div>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Season Categories</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)} placeholder="Create season (ex: Winter, Spring)" style={input()} />
              <button type="button" onClick={createSeason} style={btnPrimary()} disabled={creatingSeason}>{creatingSeason ? "Saving..." : "Add Season"}</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {seasons.map((season) => <span key={`season-pill-${season.id}`} style={typeChip(false)}>{season.name}</span>)}
              {!seasons.length ? <span style={{ opacity: 0.7 }}>No seasons yet.</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "tab" && activeTab ? (
        <section style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{activeTab.title}</div>
              <div style={{ opacity: 0.76, fontSize: 12 }}>
                {activeTab.tab_type === "normal_classes" ? "Normal Classes" : activeTab.tab_type.charAt(0).toUpperCase() + activeTab.tab_type.slice(1)} tab
              </div>
            </div>
          </div>
          <section style={tabMetaGrid()}>
            <label style={fieldLabel()}>
              Tab Title
              <input value={editTabTitle} onChange={(e) => setEditTabTitle(e.target.value)} style={input()} />
            </label>
            <label style={fieldLabel()}>
              Accounting Year
              <input value={editTabYear} onChange={(e) => setEditTabYear(Math.max(2000, Number(e.target.value) || new Date().getFullYear()))} style={input()} />
            </label>
            <label style={fieldLabel()}>
              Accounting Season
              <select value={editTabSeasonId} onChange={(e) => setEditTabSeasonId(e.target.value)} style={input()}>
                <option value="">Select season</option>
                {seasons.map((season) => (
                  <option key={`edit-season-${season.id}`} value={season.id}>{season.name}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="button" onClick={saveActiveTabMeta} style={btnPrimary()} disabled={savingTabMeta}>
                {savingTabMeta ? "Saving..." : "Save Tab Info"}
              </button>
            </div>
          </section>

          <section style={subtabRail()}>
            <button type="button" style={subtabChip(subView === "tuition")} onClick={() => setSubView("tuition")}>Tuition</button>
            <button type="button" style={subtabChip(subView === "pricing")} onClick={() => setSubView("pricing")}>Pricing</button>
            <button type="button" style={subtabChip(subView === "roster")} onClick={() => setSubView("roster")}>Roster</button>
            <button type="button" style={subtabChip(subView === "expenses")} onClick={() => setSubView("expenses")}>Expenses</button>
            <button type="button" style={subtabChip(subView === "lunch")} onClick={() => setSubView("lunch")}>Lunch</button>
            <button type="button" style={subtabChip(subView === "ledger")} onClick={() => setSubView("ledger")}>Ledger</button>
          </section>

          {subView === "tuition" ? (
            <>
              <div style={summaryGridRow(4)}>
                <article style={summaryCardTone("revenue")}>
                  <div style={summaryLabel()}>Total Revenue</div>
                  <div style={summaryValue()}>{money(summary.totalRevenue)}</div>
                </article>
                <article style={summaryCardTone("revenue")}>
                  <div style={summaryLabel()}>Lunch Revenue</div>
                  <div style={summaryValue()}>{money(summary.lunchRevenue)}</div>
                </article>
                <article style={summaryCardTone("revenue")}>
                  <div style={summaryLabel()}>Paid Student Total</div>
                  <div style={summaryValue()}>{money(summary.paidStudentTotal)}</div>
                </article>
                <article style={summaryCardTone("info")}>
                  <div style={summaryLabel()}># Students</div>
                  <div style={summaryValue()}>{summary.studentCount}</div>
                </article>
              </div>

              <div style={summaryGridRow(4)}>
                <article style={summaryCardTone("expense")}>
                  <div style={summaryLabel()}>Total Expenses</div>
                  <div style={summaryValue()}>{money(summary.totalExpenses)}</div>
                </article>
                <article style={summaryCardTone("expense")}>
                  <div style={summaryLabel()}>Lunch Expenses</div>
                  <div style={summaryValue()}>{money(summary.lunchExpenses)}</div>
                </article>
                <article style={summaryCardTone("info")}>
                  <div style={summaryLabel()}>Unpaid Student Total</div>
                  <div style={summaryValue()}>{money(summary.unpaidStudentAmount)}</div>
                </article>
                <article style={summaryCardTone("info")}>
                  <div style={summaryLabel()}>General / Competition</div>
                  <div style={summaryValue()}>{summary.generalCount} / {summary.competitionCount}</div>
                </article>
              </div>

              <div style={summaryGridRow(4)}>
                <article style={summaryCardTone("profit")}>
                  <div style={summaryLabel()}>Total Profit</div>
                  <div style={summaryValue()}>{showProfit ? money(summary.totalProfit) : "***"}</div>
                  <button type="button" style={btnGhost()} onClick={() => setShowProfit((prev) => !prev)}>{showProfit ? "Hide" : "Show"}</button>
                </article>
                <article style={summaryCardTone("profit")}>
                  <div style={summaryLabel()}>Lunch Profit</div>
                  <div style={summaryValue()}>{showProfit ? money(summary.lunchProfit) : "***"}</div>
                  <button type="button" style={btnGhost()} onClick={() => setShowProfit((prev) => !prev)}>{showProfit ? "Hide" : "Show"}</button>
                </article>
                <article style={summaryCardTone("info")}>
                  <div style={summaryLabel()}>Paid + Unpaid</div>
                  <div style={summaryValue()}>{money(summary.paidPlusUnpaid)}</div>
                </article>
                <div style={summarySpacer()} />
              </div>

              <section style={{ ...card(), marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>Tuition Entries</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setShowQuickAddStudent((prev) => !prev)} style={btnGhost()}>
                      {showQuickAddStudent ? "Close Quick Add" : "Quick Add Student"}
                    </button>
                    <button type="button" onClick={() => setCampRows((prev) => [...prev, makeRow(defaultCampType)])} style={btnGhost()}>+ Add Row</button>
                    <button type="button" onClick={() => void saveRowsToDb()} style={btnPrimary()}>{savingRows ? "Saving..." : "Save Rows"}</button>
                  </div>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>Payment Method Totals</summary>
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
                    {PAYMENT_METHODS.map((method) => {
                      const total = campRows.reduce((sum, row) => {
                        const methodSumFromLog = row.paymentLog
                          .filter((entry) => entry.method === method)
                          .reduce((sub, entry) => sub + Math.max(0, Number(entry.amount ?? 0) || 0), 0);
                        const fallback = !row.paymentLog.length && row.paymentMethod === method ? Math.max(0, Number(row.paidAmount ?? 0) || 0) : 0;
                        return sum + methodSumFromLog + fallback;
                      }, 0);
                      return (
                        <div key={`method-total-${method}`} style={listCard()}>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>{method}</div>
                          <div style={{ fontWeight: 1000 }}>{money(total)}</div>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {showQuickAddStudent ? (
                  <div style={quickAddCard()}>
                    <div style={{ fontWeight: 900 }}>Quick Add Student + Account</div>
                    <div style={quickAddGrid()}>
                      <label style={fieldLabel()}>First Name<input value={quickStudent.firstName} onChange={(e) => setQuickStudent((s) => ({ ...s, firstName: e.target.value }))} style={input()} /></label>
                      <label style={fieldLabel()}>Last Name<input value={quickStudent.lastName} onChange={(e) => setQuickStudent((s) => ({ ...s, lastName: e.target.value }))} style={input()} /></label>
                      <label style={fieldLabel()}>Email (login)<input value={quickStudent.email} onChange={(e) => setQuickStudent((s) => ({ ...s, email: e.target.value }))} style={input()} /></label>
                      <label style={fieldLabel()}>Password (optional)<input value={quickStudent.password} onChange={(e) => setQuickStudent((s) => ({ ...s, password: e.target.value }))} style={input()} /></label>
                      <label style={toggleLabel(quickStudent.isCompetitionTeam)}>
                        <input type="checkbox" checked={quickStudent.isCompetitionTeam} onChange={(e) => setQuickStudent((s) => ({ ...s, isCompetitionTeam: e.target.checked }))} />
                        Competition Team
                      </label>
                    </div>
                    <button type="button" onClick={createQuickStudentAndAccount} style={btnPrimary()} disabled={creatingStudent}>
                      {creatingStudent ? "Creating..." : "Create Student + Account"}
                    </button>
                  </div>
                ) : null}

                <div style={{ marginTop: 10, overflowX: "auto" }}>
                  <table style={table()}>
                    <thead>
                      <tr>
                        <th style={th()}>Student</th>
                        <th style={th()}>Camp Type</th>
                        <th style={th()}>Enrollment ({visibleDays.map((d) => d.label).join(" ")})</th>
                        <th style={th()}>Lunch (chips + per-day price)</th>
                        <th style={th()}>Discount</th>
                        <th style={th()}>Payment Date</th>
                        <th style={th()}>Payment Method</th>
                        <th style={th()}>Paid Amount</th>
                        <th style={th()}>Fees Paid</th>
                        <th style={th()}>Tuition</th>
                        <th style={th()}>Owed</th>
                        <th style={th()}>Row</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campRows.map((row) => {
                        const campAmount = campCharge(row, campPricing, billableDayKeys);
                        const lunchAmount = lunchCharge(row, billableDayKeys);
                        const tuition = tuitionTotal(row, campPricing, billableDayKeys);
                        const owed = owedAmount(row, campPricing, billableDayKeys);
                        const rowStyle = row.paymentMethod === "Unpaid" || owed > 0 ? rowUnpaid() : undefined;
                        return (
                          <tr key={row.id} style={rowStyle}>
                            <td style={td()}>
                              <input
                                list="accounting-student-name-suggestions"
                                value={row.name}
                                onChange={(e) => {
                                  const typed = e.target.value;
                                  const matched = students.find((s) => s.name.toLowerCase() === typed.trim().toLowerCase()) ?? null;
                                  const suggestedType: CampType = matched?.isCompetitionTeam ? "competition" : "general";
                                  const canUseSuggested = suggestedType === "general"
                                    ? campPricing.general.enabled
                                    : suggestedType === "competition"
                                    ? campPricing.competition.enabled
                                    : campPricing.overnight.enabled;
                                  setCampRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? {
                                            ...r,
                                            name: typed,
                                            studentId: matched?.id ?? "",
                                            campType: matched && canUseSuggested ? suggestedType : r.campType,
                                          }
                                        : r
                                    )
                                  );
                                }}
                                placeholder="Type student name..."
                                style={miniInput()}
                              />
                            </td>
                            <td style={td()}>
                              <select value={row.campType} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, campType: e.target.value as CampType } : r)))} style={miniInput()}>
                                {(["general", "competition", "overnight"] as CampType[]).map((campType) => {
                                  const typeEnabled = campType === "general"
                                    ? campPricing.general.enabled
                                    : campType === "competition"
                                    ? campPricing.competition.enabled
                                    : campPricing.overnight.enabled;
                                  const includeOption = typeEnabled || row.campType === campType;
                                  if (!includeOption) return null;
                                  return (
                                    <option key={`${row.id}-${campType}`} value={campType}>
                                      {campType.charAt(0).toUpperCase() + campType.slice(1)}{typeEnabled ? "" : " (disabled)"}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td style={td()}>
                              <div style={chipWrap()}>
                                {visibleDays.map((d) => (
                                  <button key={`${row.id}-e-${d.key}`} type="button" onClick={() => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enroll: { ...r.enroll, [d.key]: cycleEnroll(r.enroll[d.key]) } } : r)))} style={enrollChip(row.enroll[d.key])}>
                                    {d.label}:{row.enroll[d.key]}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={td()}>
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={chipWrap()}>
                                  {visibleDays.map((d) => (
                                    <button key={`${row.id}-l-${d.key}`} type="button" onClick={() => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, lunch: { ...r.lunch, [d.key]: !r.lunch[d.key] } } : r)))} style={lunchChip(row.lunch[d.key])}>
                                      {d.label}:{row.lunch[d.key] ? "Yes" : "No"}
                                    </button>
                                  ))}
                                </div>
                                <div style={chipWrap()}>
                                  {visibleDays.filter((d) => row.lunch[d.key]).map((d) => (
                                    <label key={`${row.id}-lp-${d.key}`} style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}>
                                      {d.label} $
                                      <input value={row.lunchPrice[d.key]} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, lunchPrice: { ...r.lunchPrice, [d.key]: Math.max(0, Number(e.target.value) || 0) } } : r)))} style={{ ...miniInput(), width: 68, padding: "4px 6px" }} />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td style={td()}><input value={row.discount} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, discount: Math.max(0, Number(e.target.value) || 0) } : r)))} style={miniInput()} /></td>
                            <td style={td()}><input type="date" value={row.paymentDate} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, paymentDate: e.target.value } : r)))} style={miniInput()} /></td>
                            <td style={td()}>
                              <select value={row.paymentMethod} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, paymentMethod: e.target.value as PaymentMethod } : r)))} style={miniInput()}>
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </td>
                            <td style={td()}><input value={row.paidAmount} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, paidAmount: Math.max(0, Number(e.target.value) || 0) } : r)))} style={miniInput()} /></td>
                            <td style={td()}><input value={row.feesPaid} onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, feesPaid: Math.max(0, Number(e.target.value) || 0) } : r)))} style={miniInput()} /></td>
                            <td style={td()}>
                              <div style={{ fontWeight: 900 }}>{money(tuition)}</div>
                              <div style={{ fontSize: 11, opacity: 0.75 }}>Camp {money(campAmount)} + Lunch {money(lunchAmount)}</div>
                            </td>
                            <td style={td()}>
                              <button
                                type="button"
                                onClick={() =>
                                  setPaymentEditor({
                                    rowId: row.id,
                                    amount: Math.max(0, Number(owed) || 0),
                                    method: row.paymentMethod || "Cash",
                                    date: row.paymentDate || new Date().toISOString().slice(0, 10),
                                    note: "",
                                  })
                                }
                                style={owedButton(owed)}
                              >
                                {money(owed)}
                              </button>
                            </td>
                            <td style={td()}><button type="button" onClick={() => deleteRowFromDb(row)} style={btnGhost()}>Delete</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <datalist id="accounting-student-name-suggestions">
                {students.map((s) => (
                  <option key={`stu-name-${s.id}`} value={s.name} />
                ))}
              </datalist>
              {paymentEditor ? (
                <div style={modalBackdrop()}>
                  <div style={modalCard()}>
                    <div style={{ fontWeight: 1000, fontSize: 18 }}>Add Payment Entry</div>
                    <label style={fieldLabel()}>Amount<input value={paymentEditor.amount} onChange={(e) => setPaymentEditor((prev) => (prev ? { ...prev, amount: Math.max(0, Number(e.target.value) || 0) } : prev))} style={input()} /></label>
                    <label style={fieldLabel()}>Method
                      <select value={paymentEditor.method} onChange={(e) => setPaymentEditor((prev) => (prev ? { ...prev, method: e.target.value as PaymentMethod } : prev))} style={input()}>
                        {PAYMENT_METHODS.map((m) => <option key={`pay-method-${m}`} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <label style={fieldLabel()}>Date<input type="date" value={paymentEditor.date} onChange={(e) => setPaymentEditor((prev) => (prev ? { ...prev, date: e.target.value } : prev))} style={input()} /></label>
                    <label style={fieldLabel()}>Note<input value={paymentEditor.note} onChange={(e) => setPaymentEditor((prev) => (prev ? { ...prev, note: e.target.value } : prev))} style={input()} /></label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        style={btnPrimary()}
                        onClick={() => {
                          const editor = paymentEditor;
                          if (!editor) return;
                          setCampRows((prev) =>
                            prev.map((row) => {
                              if (row.id !== editor.rowId) return row;
                              const nextLog: PaymentLogEntry = {
                                id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                date: editor.date || new Date().toISOString().slice(0, 10),
                                method: editor.method,
                                amount: Math.max(0, Number(editor.amount ?? 0) || 0),
                                note: editor.note || "",
                              };
                              const paidAmount = Math.max(0, Number(row.paidAmount ?? 0) || 0) + nextLog.amount;
                              const nextOwed = Math.max(0, tuitionTotal(row, campPricing, billableDayKeys) - paidAmount);
                              return {
                                ...row,
                                paidAmount,
                                paymentMethod: nextOwed <= 0 ? editor.method : row.paymentMethod,
                                paymentDate: editor.date || row.paymentDate,
                                paymentLog: [...row.paymentLog, nextLog],
                              };
                            })
                          );
                          setPaymentEditor(null);
                        }}
                      >
                        Add Payment
                      </button>
                      <button type="button" style={btnGhost()} onClick={() => setPaymentEditor(null)}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : null}

            </>
          ) : null}

          {subView === "pricing" ? (
            <section style={{ ...card(), marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Pricing + Camp Type Controls</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label style={toggleLabel(campPricing.general.enabled)}>
                  <input type="checkbox" checked={campPricing.general.enabled} onChange={(e) => setCampPricing((p) => ({ ...p, general: { ...p.general, enabled: e.target.checked } }))} />
                  General Enabled
                </label>
                <label style={toggleLabel(campPricing.competition.enabled)}>
                  <input type="checkbox" checked={campPricing.competition.enabled} onChange={(e) => setCampPricing((p) => ({ ...p, competition: { ...p.competition, enabled: e.target.checked } }))} />
                  Competition Enabled
                </label>
                <label style={toggleLabel(campPricing.overnight.enabled)}>
                  <input type="checkbox" checked={campPricing.overnight.enabled} onChange={(e) => setCampPricing((p) => ({ ...p, overnight: { ...p.overnight, enabled: e.target.checked } }))} />
                  Overnight Enabled
                </label>
              </div>
              <div style={pricingGrid()}>
                <div style={priceBox()}>
                  <div style={priceTitle()}>General Camp</div>
                  <label style={fieldLabel()}>Full Week<input value={campPricing.general.fullWeek} onChange={(e) => setCampPricing((p) => ({ ...p, general: { ...p.general, fullWeek: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  <label style={fieldLabel()}>Full Day<input value={campPricing.general.fullDay} onChange={(e) => setCampPricing((p) => ({ ...p, general: { ...p.general, fullDay: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  <label style={fieldLabel()}>AM<input value={campPricing.general.am} onChange={(e) => setCampPricing((p) => ({ ...p, general: { ...p.general, am: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  <label style={fieldLabel()}>PM<input value={campPricing.general.pm} onChange={(e) => setCampPricing((p) => ({ ...p, general: { ...p.general, pm: Number(e.target.value) || 0 } }))} style={input()} /></label>
                </div>
                <div style={priceBox()}>
                  <div style={priceTitle()}>Competition Camp</div>
                  <label style={fieldLabel()}>Full Week<input value={campPricing.competition.fullWeek} onChange={(e) => setCampPricing((p) => ({ ...p, competition: { ...p.competition, fullWeek: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  <label style={fieldLabel()}>Full Day<input value={campPricing.competition.fullDay} onChange={(e) => setCampPricing((p) => ({ ...p, competition: { ...p.competition, fullDay: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  <label style={fieldLabel()}>AM<input value={campPricing.competition.am} onChange={(e) => setCampPricing((p) => ({ ...p, competition: { ...p.competition, am: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  <label style={fieldLabel()}>PM<input value={campPricing.competition.pm} onChange={(e) => setCampPricing((p) => ({ ...p, competition: { ...p.competition, pm: Number(e.target.value) || 0 } }))} style={input()} /></label>
                </div>
                {campPricing.overnight.enabled ? (
                  <div style={priceBox()}>
                    <div style={priceTitle()}>Overnight Camp</div>
                    <label style={fieldLabel()}>Per Day<input value={campPricing.overnight.perDay} onChange={(e) => setCampPricing((p) => ({ ...p, overnight: { ...p.overnight, perDay: Number(e.target.value) || 0 } }))} style={input()} /></label>
                    <label style={fieldLabel()}>Full Week<input value={campPricing.overnight.fullWeek} onChange={(e) => setCampPricing((p) => ({ ...p, overnight: { ...p.overnight, fullWeek: Number(e.target.value) || 0 } }))} style={input()} /></label>
                  </div>
                ) : null}
                <div style={priceBox()}>
                  <div style={priceTitle()}>Lunch Expenses</div>
                  <label style={fieldLabel()}>Lunch expense total<input value={campPricing.lunchExpenses} onChange={(e) => setCampPricing((p) => ({ ...p, lunchExpenses: Math.max(0, Number(e.target.value) || 0) }))} style={input()} /></label>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button type="button" onClick={() => void savePricingToDb()} style={btnPrimary()}>{savingPricing ? "Saving..." : "Save Pricing"}</button>
                <button type="button" onClick={() => loadCampData(activeTab.id)} style={btnGhost()}>Refresh</button>
              </div>
            </section>
          ) : null}

          {subView === "roster" ? (
            <section style={{ ...card(), marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Roster</div>
                <div style={{ fontWeight: 900, opacity: 0.85 }}>{rosterRows.length} students</div>
              </div>
              {rosterRows.length ? (
                <div style={rosterGrid()}>
                  {rosterRows.map((row, idx) => {
                    const src = avatarUrl(row.student?.avatarPath ?? null);
                    const owed = owedAmount(row, campPricing, billableDayKeys);
                    const danger = row.paymentMethod === "Unpaid" || owed > 0;
                    return (
                      <div key={`${row.id}-${idx}`} style={rosterCard(danger)}>
                        <div style={avatarWrap()}>
                          {src ? <img src={src} alt={row.name} style={avatarImg()} /> : <div style={avatarFallback()}>{initials(row.name)}</div>}
                        </div>
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontWeight: 900 }}>{row.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.78 }}>{row.campType.charAt(0).toUpperCase() + row.campType.slice(1)} Camp</div>
                          <div style={chipWrap()}>
                            <span style={typeBadge(row.campType === "general")}>General</span>
                            <span style={typeBadge(row.campType === "competition")}>Competition</span>
                            <span style={typeBadge(row.campType === "overnight")}>Overnight</span>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.86 }}>{danger ? `Owed ${money(owed)}` : "Paid in full"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: 12, opacity: 0.76 }}>No students added yet in Tuition.</div>
              )}
            </section>
          ) : null}

          {subView === "expenses" ? (
            <section style={{ ...card(), marginTop: 12 }}>
              <div style={expenseTopBox()}>
                <div style={{ fontSize: 12, opacity: 0.82, fontWeight: 900, textTransform: "uppercase" }}>Total Expenses</div>
                <div style={{ fontSize: 30, fontWeight: 1000 }}>{money(summary.totalExpenses)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Expenses</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 900 }}>
                    Category Filter
                    <select value={expenseFilter} onChange={(e) => setExpenseFilter(e.target.value)} style={miniInput()}>
                      <option value="all">All Categories</option>
                      {expenseFilterOptions.map((cat) => (
                        <option key={`filter-${cat}`} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => setExpenses((prev) => [...prev, makeExpense()])} style={btnGhost()}>+ Add Expense</button>
                  <button type="button" onClick={() => void saveExpensesToDb()} style={btnPrimary()}>{savingExpenses ? "Saving..." : "Save Expenses"}</button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ ...table(), minWidth: 800 }}>
                  <thead>
                    <tr>
                      <th style={th()}>Item</th>
                      <th style={th()}>Amount</th>
                      <th style={th()}>Category</th>
                      <th style={th()}>Description / Note</th>
                      <th style={th()}>Row</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleExpenses.map((expense) => (
                      (() => {
                        const autoFee = expense.id.startsWith("auto-fee-");
                        return (
                      <tr key={expense.id}>
                        <td style={td()}><input value={expense.item} onChange={(e) => setExpenses((prev) => prev.map((r) => (r.id === expense.id ? { ...r, item: e.target.value } : r)))} style={miniInput()} readOnly={autoFee} /></td>
                        <td style={td()}><input value={expense.amount} onChange={(e) => setExpenses((prev) => prev.map((r) => (r.id === expense.id ? { ...r, amount: Math.max(0, Number(e.target.value) || 0) } : r)))} style={miniInput()} readOnly={autoFee} /></td>
                        <td style={td()}>
                          <select value={expense.category} onChange={(e) => setExpenses((prev) => prev.map((r) => (r.id === expense.id ? { ...r, category: e.target.value } : r)))} style={miniInput()} disabled={autoFee}>
                            <option value="">Select category</option>
                            {expenseCategories.map((cat) => <option key={`${expense.id}-${cat}`} value={cat}>{cat}</option>)}
                            {expense.category === "fees" ? <option value="fees">fees</option> : null}
                          </select>
                        </td>
                        <td style={td()}><input value={expense.notes} onChange={(e) => setExpenses((prev) => prev.map((r) => (r.id === expense.id ? { ...r, notes: e.target.value } : r)))} style={miniInput()} readOnly={autoFee} /></td>
                        <td style={td()}>{autoFee ? <span style={{ opacity: 0.7, fontWeight: 800 }}>Auto</span> : <button type="button" onClick={() => deleteExpenseFromDb(expense)} style={btnGhost()}>Delete</button>}</td>
                      </tr>
                        );
                      })()
                    ))}
                    {!visibleExpenses.length ? (
                      <tr>
                        <td style={td()} colSpan={5}>No expenses in this category.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {subView === "lunch" ? (
            <section style={{ ...card(), marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Lunch Tracking Summary</div>
              <div style={lunchDayGrid()}>
                {lunchSummaryByDay.map((day) => (
                  <article key={day.key} style={lunchDayCard()}>
                    <div style={lunchDayHeader()}>
                      <button type="button" style={btnGhost()} onClick={() => setOpenLunchDay((prev) => (prev === day.key ? null : day.key))}>{day.label}</button>
                      <div style={{ display: "grid", gap: 2, textAlign: "right" }}>
                        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Count: {day.count}</div>
                        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Revenue: {money(day.revenue)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.82, fontWeight: 900, textTransform: "uppercase" }}>Students With Lunch</div>
                    <div style={lunchDayStudentsWrap()}>
                      {day.rowsForDay.length ? day.rowsForDay.map((row) => (
                        <button key={`${day.key}-chip-${row.id}`} type="button" style={lunchPersonChip()} onClick={() => setLunchEdit({ rowId: row.id, day: day.key })}>
                          {row.name || "Unknown"}
                        </button>
                      )) : <span style={{ opacity: 0.72 }}>None</span>}
                    </div>

                    {openLunchDay === day.key ? (
                      <div style={smallBox()}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>{day.label} Lunch Details</div>
                        <div style={twoColHeader()}>
                          <div>Name</div>
                          <div>Lunch</div>
                        </div>
                        {day.rowsForDay.length ? day.rowsForDay.map((row) => (
                          <div key={`${day.key}-${row.id}`} style={twoColRow()}>
                            <div>{row.name || "Unknown"}</div>
                            <div>{row.lunchItem[day.key] || "(not set)"}</div>
                          </div>
                        )) : <div style={{ opacity: 0.75 }}>No students with lunch.</div>}
                      </div>
                    ) : null}

                    {lunchEdit && lunchEdit.day === day.key ? (
                      (() => {
                        const row = campRows.find((r) => r.id === lunchEdit.rowId);
                        if (!row) return null;
                        return (
                          <div style={smallBox()}>
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>{row.name || "Student"} lunch on {day.label}</div>
                            <input
                              list="lunch-item-options"
                              value={row.lunchItem[day.key] ?? ""}
                              onChange={(e) => setCampRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, lunchItem: { ...r.lunchItem, [day.key]: e.target.value } } : r)))}
                              placeholder="Type lunch item or pick existing"
                              style={miniInput()}
                            />
                            <datalist id="lunch-item-options">
                              {lunchItemOptions.map((opt) => <option key={`lunch-opt-${opt}`} value={opt} />)}
                            </datalist>
                            <div style={{ marginTop: 8 }}>
                              <button type="button" style={btnGhost()} onClick={() => setLunchEdit(null)}>Close</button>
                            </div>
                          </div>
                        );
                      })()
                    ) : null}
                  </article>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                <div style={listCard()}><strong>Total Count:</strong> {lunchSummaryByDay.reduce((sum, d) => sum + d.count, 0)}</div>
                <div style={listCard()}><strong>Total Selections:</strong> {lunchSummaryByDay.reduce((sum, d) => sum + d.rowsForDay.length, 0)}</div>
                <div style={listCard()}><strong>Total Revenue:</strong> {money(summary.lunchRevenue)}</div>
              </div>

              <section style={{ ...card(), marginTop: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Lunch Item Totals</div>
                {lunchItemTotals.length ? (
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
                    {lunchItemTotals.map((item) => (
                      <div key={`item-total-${item.item}`} style={listCard()}>{item.item}: {item.count}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, opacity: 0.75 }}>No lunch items entered yet.</div>
                )}
              </section>
            </section>
          ) : null}

          {subView === "ledger" ? (
            <section style={{ ...card(), marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Payment Ledger</div>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
                <label style={fieldLabel()}>
                  Student Filter
                  <select value={ledgerStudentFilter} onChange={(e) => setLedgerStudentFilter(e.target.value)} style={input()}>
                    <option value="all">All Students</option>
                    {students.map((s) => (
                      <option key={`ledger-stu-${s.id}`} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label style={fieldLabel()}>
                  Payment Method Filter
                  <select value={ledgerMethodFilter} onChange={(e) => setLedgerMethodFilter(e.target.value)} style={input()}>
                    <option value="all">All Methods</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={`ledger-method-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ ...table(), minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th style={th()}>Payment Date</th>
                      <th style={th()}>Student</th>
                      <th style={th()}>Amount</th>
                      <th style={th()}>Method</th>
                      <th style={th()}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedgerRecords.map((record) => (
                      <tr key={record.id}>
                        <td style={td()}>{record.date || "-"}</td>
                        <td style={td()}>{record.studentName}</td>
                        <td style={td()}>{money(record.amount)}</td>
                        <td style={td()}>{record.method}</td>
                        <td style={td()}>{record.note || "-"}</td>
                      </tr>
                    ))}
                    {!filteredLedgerRecords.length ? (
                      <tr>
                        <td style={td()} colSpan={5}>No payment entries for selected filters.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function wrap(): React.CSSProperties {
  return { padding: 18, maxWidth: 1680, margin: "0 auto", display: "grid", gap: 12 };
}
function title(): React.CSSProperties {
  return { fontSize: 30, fontWeight: 1000 };
}
function card(): React.CSSProperties {
  return { border: "1px solid rgba(148,163,184,0.35)", borderRadius: 14, padding: 12, background: "rgba(15,23,42,0.62)" };
}
function input(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.45)", background: "rgba(2,6,23,0.65)", color: "white", fontWeight: 800 };
}
function miniInput(): React.CSSProperties {
  return { width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.45)", background: "rgba(2,6,23,0.65)", color: "white", fontWeight: 800 };
}
function btnPrimary(): React.CSSProperties {
  return { borderRadius: 10, padding: "9px 12px", border: "1px solid rgba(34,197,94,0.6)", background: "rgba(22,163,74,0.28)", color: "white", fontWeight: 900, cursor: "pointer" };
}
function btnGhost(): React.CSSProperties {
  return { borderRadius: 10, padding: "8px 11px", border: "1px solid rgba(148,163,184,0.55)", background: "rgba(30,41,59,0.45)", color: "white", fontWeight: 900, cursor: "pointer" };
}
function notice(ok: boolean): React.CSSProperties {
  return { borderRadius: 10, padding: "8px 10px", border: `1px solid ${ok ? "rgba(74,222,128,0.6)" : "rgba(248,113,113,0.6)"}`, background: ok ? "rgba(22,101,52,0.3)" : "rgba(127,29,29,0.36)" };
}
function folderRail(): React.CSSProperties {
  return { display: "flex", gap: 8, alignItems: "flex-end", overflowX: "auto", paddingBottom: 2 };
}
function folderTab(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(96,165,250,0.7)" : "1px solid rgba(100,116,139,0.6)",
    borderBottom: active ? "2px solid rgba(125,211,252,0.95)" : "1px solid rgba(100,116,139,0.4)",
    borderRadius: "10px 10px 0 0",
    padding: "8px 12px",
    background: active ? "rgba(30,64,175,0.35)" : "rgba(30,41,59,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
function homeGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 };
}
function homeCard(): React.CSSProperties {
  return {
    border: "1px solid rgba(148,163,184,0.4)",
    borderRadius: 14,
    background: "linear-gradient(145deg, rgba(15,23,42,0.8), rgba(2,6,23,0.86))",
    padding: 14,
    textAlign: "left",
    color: "white",
    cursor: "pointer",
    display: "grid",
    gap: 6,
  };
}
function homeTitle(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 1000 };
}
function homeDesc(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.82, fontWeight: 800 };
}
function typeRow(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 };
}
function tabMetaGrid(): React.CSSProperties {
  return { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 };
}
function typeChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "7px 12px",
    border: active ? "1px solid rgba(96,165,250,0.8)" : "1px solid rgba(100,116,139,0.55)",
    background: active ? "rgba(30,64,175,0.35)" : "rgba(30,41,59,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}
function subtabRail(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 };
}
function subtabChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "7px 12px",
    border: active ? "1px solid rgba(74,222,128,0.7)" : "1px solid rgba(100,116,139,0.55)",
    background: active ? "rgba(22,163,74,0.25)" : "rgba(30,41,59,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textTransform: "capitalize",
  };
}
function summaryGridRow(columns: number): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: 10, marginTop: 12 };
}
function summarySpacer(): React.CSSProperties {
  return { visibility: "hidden" };
}
function summaryCardTone(tone: "revenue" | "expense" | "info" | "profit"): React.CSSProperties {
  if (tone === "revenue") {
    return { border: "1px solid rgba(59,130,246,0.6)", borderRadius: 12, padding: 10, background: "rgba(30,64,175,0.26)", display: "grid", gap: 8, alignContent: "start" };
  }
  if (tone === "expense") {
    return { border: "1px solid rgba(248,113,113,0.62)", borderRadius: 12, padding: 10, background: "rgba(127,29,29,0.30)", display: "grid", gap: 8, alignContent: "start" };
  }
  if (tone === "profit") {
    return { border: "1px solid rgba(74,222,128,0.62)", borderRadius: 12, padding: 10, background: "rgba(22,101,52,0.30)", display: "grid", gap: 8, alignContent: "start" };
  }
  return { border: "1px solid rgba(251,191,36,0.65)", borderRadius: 12, padding: 10, background: "rgba(120,53,15,0.30)", display: "grid", gap: 8, alignContent: "start" };
}
function summaryLabel(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.78, fontWeight: 900, textTransform: "uppercase" };
}
function summaryValue(): React.CSSProperties {
  return { fontSize: 24, fontWeight: 1000 };
}
function pricingGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 };
}
function priceBox(): React.CSSProperties {
  return { border: "1px solid rgba(148,163,184,0.35)", borderRadius: 12, padding: 10, display: "grid", gap: 8, background: "rgba(2,6,23,0.45)" };
}
function priceTitle(): React.CSSProperties {
  return { fontWeight: 1000 };
}
function fieldLabel(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, fontWeight: 900, opacity: 0.95 };
}
function table(): React.CSSProperties {
  return { width: "100%", borderCollapse: "collapse", minWidth: 1200 };
}
function th(): React.CSSProperties {
  return { textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.45)", padding: "8px 6px", fontSize: 12, opacity: 0.86 };
}
function td(): React.CSSProperties {
  return { borderBottom: "1px solid rgba(51,65,85,0.65)", padding: "8px 6px", verticalAlign: "top" };
}
function chipWrap(): React.CSSProperties {
  return { display: "flex", gap: 6, flexWrap: "wrap" };
}
function enrollChip(v: Enrollment): React.CSSProperties {
  const active = v !== "OFF";
  return {
    borderRadius: 999,
    padding: "4px 7px",
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(100,116,139,0.55)",
    background: v === "FULL" ? "rgba(37,99,235,0.35)" : v === "AM" ? "rgba(234,179,8,0.32)" : v === "PM" ? "rgba(22,163,74,0.32)" : "rgba(30,41,59,0.45)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}
function lunchChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "4px 7px",
    border: active ? "1px solid rgba(74,222,128,0.75)" : "1px solid rgba(100,116,139,0.55)",
    background: active ? "rgba(22,163,74,0.3)" : "rgba(30,41,59,0.45)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}
function lunchPersonChip(): React.CSSProperties {
  return { borderRadius: 999, padding: "4px 9px", border: "1px solid rgba(251,191,36,0.7)", background: "rgba(146,64,14,0.32)", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer" };
}
function lunchDayGrid(): React.CSSProperties {
  return { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 };
}
function lunchDayCard(): React.CSSProperties {
  return { borderRadius: 12, border: "1px solid rgba(59,130,246,0.4)", background: "rgba(30,64,175,0.14)", padding: 10, minHeight: 210, display: "grid", alignContent: "start", gap: 8 };
}
function lunchDayHeader(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 };
}
function lunchDayStudentsWrap(): React.CSSProperties {
  return { borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.45)", padding: 8, minHeight: 66, display: "flex", gap: 6, flexWrap: "wrap", alignContent: "flex-start" };
}
function rowUnpaid(): React.CSSProperties {
  return { background: "rgba(220,38,38,0.25)" };
}
function toggleLabel(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(148,163,184,0.5)",
    background: active ? "rgba(21,128,61,0.24)" : "rgba(30,41,59,0.4)",
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 900,
    fontSize: 12,
  };
}
function listCard(): React.CSSProperties {
  return { borderRadius: 10, border: "1px solid rgba(148,163,184,0.4)", padding: "8px 10px", background: "rgba(2,6,23,0.52)", fontWeight: 800 };
}
function expenseTopBox(): React.CSSProperties {
  return { borderRadius: 12, padding: 12, border: "1px solid rgba(248,113,113,0.48)", background: "rgba(127,29,29,0.40)" };
}
function rosterGrid(): React.CSSProperties {
  return { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 };
}
function rosterCard(danger: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    border: danger ? "1px solid rgba(248,113,113,0.6)" : "1px solid rgba(148,163,184,0.4)",
    padding: 10,
    display: "grid",
    gridTemplateColumns: "56px 1fr",
    gap: 10,
    alignItems: "center",
    background: danger ? "rgba(127,29,29,0.35)" : "rgba(2,6,23,0.55)",
  };
}
function avatarWrap(): React.CSSProperties {
  return { width: 56, height: 56, borderRadius: 999, overflow: "hidden", border: "1px solid rgba(148,163,184,0.45)", background: "rgba(30,41,59,0.7)", display: "grid", placeItems: "center" };
}
function avatarImg(): React.CSSProperties {
  return { width: "100%", height: "100%", objectFit: "cover", display: "block" };
}
function avatarFallback(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16, opacity: 0.9 };
}
function quickAddCard(): React.CSSProperties {
  return { marginTop: 10, borderRadius: 12, border: "1px solid rgba(59,130,246,0.55)", background: "rgba(30,64,175,0.2)", padding: 10, display: "grid", gap: 8 };
}
function quickAddGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 };
}
function smallBox(): React.CSSProperties {
  return { marginTop: 8, border: "1px solid rgba(148,163,184,0.45)", borderRadius: 10, padding: 8, background: "rgba(2,6,23,0.7)", display: "grid", gap: 6, minWidth: 260 };
}
function twoColHeader(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, opacity: 0.75, fontWeight: 900, fontSize: 12, textTransform: "uppercase" };
}
function twoColRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, borderTop: "1px solid rgba(51,65,85,0.7)", paddingTop: 6 };
}
function typeBadge(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 900,
    border: active ? "1px solid rgba(74,222,128,0.7)" : "1px solid rgba(100,116,139,0.5)",
    background: active ? "rgba(21,128,61,0.28)" : "rgba(30,41,59,0.35)",
    opacity: active ? 1 : 0.65,
  };
}
function owedButton(owed: number): React.CSSProperties {
  const due = owed > 0;
  return {
    width: "100%",
    borderRadius: 10,
    border: due ? "1px solid rgba(248,113,113,0.9)" : "1px solid rgba(100,116,139,0.55)",
    background: due ? "rgba(127,29,29,0.45)" : "rgba(30,41,59,0.45)",
    color: "white",
    fontWeight: 1000,
    padding: "8px 10px",
    cursor: "pointer",
    boxShadow: due ? "0 0 14px rgba(248,113,113,0.45)" : "none",
  };
}
function modalBackdrop(): React.CSSProperties {
  return { position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "grid", placeItems: "center", zIndex: 1200, padding: 14 };
}
function modalCard(): React.CSSProperties {
  return { width: "min(560px,100%)", borderRadius: 14, border: "1px solid rgba(148,163,184,0.5)", background: "rgba(15,23,42,0.95)", padding: 14, display: "grid", gap: 8 };
}
function saveChip(state: "saving" | "saved" | "error"): React.CSSProperties {
  if (state === "saving") {
    return { position: "fixed", right: 18, top: 78, zIndex: 1300, borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(251,191,36,0.8)", background: "rgba(120,53,15,0.85)", color: "white", fontWeight: 900 };
  }
  if (state === "error") {
    return { position: "fixed", right: 18, top: 78, zIndex: 1300, borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(248,113,113,0.9)", background: "rgba(127,29,29,0.9)", color: "white", fontWeight: 900 };
  }
  return { position: "fixed", right: 18, top: 78, zIndex: 1300, borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(74,222,128,0.85)", background: "rgba(21,128,61,0.82)", color: "white", fontWeight: 900 };
}
