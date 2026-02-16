"use client";

import { useEffect, useMemo, useState } from "react";

type MenuItem = {
  id: string;
  menu_id: string;
  name: string;
  price_points: number;
  allow_second: boolean;
  second_price_points?: number | null;
  image_url?: string | null;
  image_text?: string | null;
  use_text?: boolean | null;
  enabled: boolean;
};

type Menu = { id: string; name: string; enabled: boolean; items: MenuItem[] };

type StudentPick = { id: string; name: string };

type Payer = { student: StudentPick; amount: string };

export default function CampRegisterPage() {
  const [role, setRole] = useState("student");
  const [roles, setRoles] = useState<string[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [leaderMsg, setLeaderMsg] = useState("");
  const [msg, setMsg] = useState("");

  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, { qty: number; second: boolean }>>({});

  const [payStep, setPayStep] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [payerQuery, setPayerQuery] = useState("");
  const [payerResults, setPayerResults] = useState<StudentPick[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [paidBy, setPaidBy] = useState("");

  const [discountInput, setDiscountInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountAuthorized, setDiscountAuthorized] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  const [orders, setOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [refundMsg, setRefundMsg] = useState("");

  const [helperQuery, setHelperQuery] = useState("");
  const [helperResults, setHelperResults] = useState<StudentPick[]>([]);
  const [helpers, setHelpers] = useState<StudentPick[]>([]);
  const [helperMsg, setHelperMsg] = useState("");

  const [balanceQuery, setBalanceQuery] = useState("");
  const [balanceResults, setBalanceResults] = useState<StudentPick[]>([]);
  const [balanceData, setBalanceData] = useState<any | null>(null);

  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponUses, setCouponUses] = useState<Record<string, number>>({});
  const [auraDiscount, setAuraDiscount] = useState(0);
  const [auraName, setAuraName] = useState("");
  const [hubGateChecked, setHubGateChecked] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) {
          setRole(String(data?.role ?? "student"));
          setRoles(
            Array.isArray(data?.roles)
              ? data.roles.map((r: any) => String(r ?? "").toLowerCase()).filter(Boolean)
              : [String(data?.role ?? "student").toLowerCase()]
          );
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.sessionStorage.getItem("camp_hub_ok") === "1";
    if (!ok) {
      window.location.href = "/camp";
      return;
    }
    setHubGateChecked(true);
  }, []);

  useEffect(() => {
    if (role !== "student") {
      setIsLeader(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/camp/leaders/active", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setIsLeader(!!data.active);
      } catch {
        setIsLeader(false);
      }
    })();
  }, [role]);

  const roleSet = new Set(roles.length ? roles : [String(role ?? "").toLowerCase()]);
  const canAccess = ["admin", "coach", "camp"].some((r) => roleSet.has(r)) || isLeader;
  const canRegister = ["admin", "camp"].some((r) => roleSet.has(r)) || isLeader;
  const canRefund = ["admin", "camp"].some((r) => roleSet.has(r));

  useEffect(() => {
    if (!hubGateChecked) return;
    (async () => {
      const res = await fetch("/api/camp/menus?items=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMenus((data.menus ?? []) as Menu[]);
    })();
    (async () => {
      const res = await fetch("/api/camp/orders/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setOrders(data.orders ?? []);
    })();
  }, [hubGateChecked]);

  useEffect(() => {
    const first = payers[0]?.student;
    if (!first) {
      setAvailableCoupons([]);
      setCouponUses({});
      setAuraDiscount(0);
      setAuraName("");
      return;
    }
    (async () => {
      const res = await fetch("/api/camp/balance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: first.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAvailableCoupons(data.coupons ?? []);
        setCouponUses({});
        setAuraDiscount(Number(data?.aura?.discount_points ?? 0));
        setAuraName(String(data?.aura?.aura_name ?? ""));
      }
    })();
  }, [payers]);

  useEffect(() => {
    if (!hubGateChecked || !isLeader) return;
    (async () => {
      const res = await fetch("/api/camp/leader/daily-award", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.awarded) {
        setLeaderMsg(`Daily leader award: +${data.daily_points} pts`);
      }
    })();
  }, [hubGateChecked, isLeader]);

  useEffect(() => {
    if (!payerQuery.trim()) {
      setPayerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: payerQuery.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPayerResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }, 200);
    return () => clearTimeout(t);
  }, [payerQuery]);

  useEffect(() => {
    if (!helperQuery.trim()) {
      setHelperResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: helperQuery.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setHelperResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }, 200);
    return () => clearTimeout(t);
  }, [helperQuery]);

  useEffect(() => {
    if (!balanceQuery.trim()) {
      setBalanceResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: balanceQuery.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBalanceResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }, 200);
    return () => clearTimeout(t);
  }, [balanceQuery]);

  const flatItems = useMemo(() => {
    const list: MenuItem[] = [];
    menus.forEach((m) => (m.items ?? []).forEach((i) => i.enabled !== false && list.push(i)));
    return list;
  }, [menus]);

  const menuSections = useMemo(() => {
    return menus
      .filter((m) => m.enabled !== false)
      .map((menu) => ({
        id: menu.id,
        name: menu.name,
        items: (menu.items ?? []).filter((i) => i.enabled !== false),
      }))
      .filter((menu) => menu.items.length);
  }, [menus]);

  useEffect(() => {
    if (!menuSections.length) {
      setActiveMenuId("");
      return;
    }
    if (!menuSections.some((s) => s.id === activeMenuId)) {
      setActiveMenuId(menuSections[0].id);
    }
  }, [menuSections, activeMenuId]);

  const activeMenuSection = useMemo(() => {
    if (!menuSections.length) return null;
    return menuSections.find((s) => s.id === activeMenuId) ?? menuSections[0];
  }, [menuSections, activeMenuId]);

  const cartItems = useMemo(() => {
    return Object.entries(selectedItems)
      .map(([itemId, sel]) => {
        const item = flatItems.find((i) => i.id === itemId);
        if (!item) return null;
        const price = sel.second && item.allow_second
          ? Number(item.second_price_points ?? item.price_points)
          : Number(item.price_points ?? 0);
        return { item, price, qty: Math.max(1, sel.qty || 1), second: sel.second && item.allow_second };
      })
      .filter(Boolean) as Array<{ item: MenuItem; price: number; qty: number; second: boolean }>;
  }, [flatItems, selectedItems]);

  const totalPoints = useMemo(() => {
    return cartItems.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
  }, [cartItems]);

  const discountPoints = useMemo(() => {
    if (!discountApplied) return 0;
    const raw = Number(discountInput);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(raw, totalPoints);
  }, [discountApplied, discountInput, totalPoints]);

  const couponDiscountPoints = useMemo(() => {
    return availableCoupons.reduce((sum, coupon) => {
      const qty = Number(couponUses[coupon.id] ?? 0);
      if (!qty || qty <= 0) return sum;
      const type = coupon?.type;
      if (type?.coupon_type === "points") {
        return sum + Math.max(0, Number(type.points_value ?? 0)) * qty;
      }
      if (type?.coupon_type === "percent") {
        const percent = Math.max(0, Number(type.points_value ?? 0));
        const itemId = String(type.item_id ?? "");
        if (itemId) {
          const match = cartItems.find((entry) => entry.item.id === itemId);
          if (!match) return sum;
          const discount = Math.round(Number(match.price ?? 0) * (percent / 100));
          return sum + Math.max(0, discount) * qty;
        }
        const orderDiscount = Math.round(totalPoints * (percent / 100));
        return sum + Math.max(0, orderDiscount) * qty;
      }
      if (type?.coupon_type === "item") {
        const itemId = String(type.item_id ?? "");
        const match = cartItems.find((entry) => entry.item.id === itemId);
        if (!match) return sum;
        return sum + Math.max(0, Number(match.price ?? 0)) * qty;
      }
      return sum;
    }, 0);
  }, [availableCoupons, couponUses, cartItems, totalPoints]);

  const totalDiscount = Math.max(0, discountPoints + couponDiscountPoints + Math.max(0, auraDiscount));
  const payablePoints = Math.max(0, totalPoints - totalDiscount);
  const paymentTotal = payers.reduce((sum, payer) => sum + (Number(payer.amount) || 0), 0);
  const remainingPoints = payablePoints - paymentTotal;
  const canStartPayment = cartItems.length > 0;

  async function lookupNfc(code: string) {
    const res = await fetch("/api/camp/nfc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return data.student as StudentPick;
  }

  function addPayer(student: StudentPick) {
    if (payers.find((p) => p.student.id === student.id)) return;
    if (payers.length >= 4) return setMsg("Max 4 payers allowed.");
    setPayers((prev) => [...prev, { student, amount: "" }]);
    setPayerQuery("");
    setPayerResults([]);
  }

  function applyEvenSplit() {
    if (!payers.length) return;
    const base = Math.floor(payablePoints / payers.length);
    const remainder = payablePoints % payers.length;
    setPayers((prev) =>
      prev.map((payer, idx) => ({
        ...payer,
        amount: String(base + (idx === 0 ? remainder : 0)),
      }))
    );
  }

  function setPayerAmount(studentId: string, raw: string | number) {
    const next = Math.max(0, Math.round(Number(raw) || 0));
    setPayers((prev) =>
      prev.map((p) => (p.student.id === studentId ? { ...p, amount: String(next) } : p))
    );
  }

  async function submitHelpers() {
    setHelperMsg("");
    if (!helpers.length) return setHelperMsg("Add at least one helper.");
    const res = await fetch("/api/camp/helpers/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helper_ids: helpers.map((h) => h.id) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setHelperMsg(data?.error || "Failed to submit helpers");
    setHelperMsg(`Helpers awarded: ${data.awarded}`);
    setHelpers([]);
    setHelperQuery("");
    setHelperResults([]);
  }

  async function loadBalance(student: StudentPick) {
    const res = await fetch("/api/camp/balance-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to load balance");
      return;
    }
    setBalanceData(data);
  }

  async function unlockDiscount() {
    if (!adminPin.trim()) return setMsg("Enter admin PIN or NFC");
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: adminPin.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Admin PIN failed");
    setDiscountAuthorized(true);
    setAdminPin("");
    setMsg("");
  }

  function formatLocalTime(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  async function refundOrder(orderId: string) {
    if (!orderId) return;
    setRefundMsg("");
    const res = await fetch("/api/camp/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRefundMsg(data?.error || "Refund failed");
      return;
    }
    setRefundMsg(`Refunded ${data.refunded_points} pts`);
    const resLog = await fetch("/api/camp/orders/list", { cache: "no-store" });
    const logData = await resLog.json().catch(() => ({}));
    if (resLog.ok) {
      const nextOrders = logData.orders ?? [];
      setOrders(nextOrders);
      const updated = nextOrders.find((order: any) => order.id === orderId);
      if (updated) setActiveOrder(updated);
    }
  }

  async function submitPayment() {
    if (isSubmittingPayment) return;
    if (!canRegister) return setMsg("This account is not allowed to submit payments.");
    if (!Object.keys(selectedItems).length) return setMsg("Select at least one item.");
    if (!payers.length) return setMsg("Select at least one payer.");
    if (remainingPoints !== 0) return setMsg("Payments must match the total.");

    setIsSubmittingPayment(true);
    try {
      setMsg("");
      const items = cartItems.map((entry) => ({
        id: entry.item.id,
        name: entry.item.name,
        price_points: entry.price,
        qty: entry.qty,
        second: entry.second,
      }));

      const res = await fetch("/api/camp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: payers[0]?.student?.id ?? null,
          student_name: payers[0]?.student?.name ?? null,
          paid_by: paidBy.trim() || null,
          items,
          discount_points: discountPoints || 0,
          aura_discount_points: auraDiscount || 0,
          coupons: Object.entries(couponUses)
            .map(([couponId, qty]) => ({ coupon_type_id: couponId, qty: Number(qty) || 0 }))
            .filter((c) => c.qty > 0),
          payments: payers.map((payer) => ({
            student_id: payer.student.id,
            student_name: payer.student.name,
            amount_points: Number(payer.amount) || 0,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Payment failed");
        return;
      }

      setSelectedItems({});
      setPayStep(false);
      setPaidBy("");
      setPayers([]);
      setDiscountApplied(false);
      setDiscountInput("");
      setDiscountAuthorized(false);
      setAdminPin("");
      setPayerQuery("");
      setPayerResults([]);

      const resLog = await fetch("/api/camp/orders/list", { cache: "no-store" });
      const logData = await resLog.json().catch(() => ({}));
      if (resLog.ok) setOrders(logData.orders ?? []);
      if (data?.duplicate) setMsg("Duplicate tap ignored: existing payment reused.");
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  if (!hubGateChecked) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 18, opacity: 0.75 }}>Redirecting to Camp Hub…</div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Camp access only.</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>Camp, coach, admin, or active leaders can access this page.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: "none", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Camp POS</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/camp/menu" style={btnGhost()}>Menu Display</a>
          <a href="/camp/menu-editor" style={btnGhost()}>Menu Editor</a>
        </div>
      </div>
      {msg ? <div style={{ color: "crimson", marginTop: 6 }}>{msg}</div> : null}
      {leaderMsg ? <div style={{ color: "#7dd3fc", marginTop: 6 }}>{leaderMsg}</div> : null}

      <div style={layoutGrid()}>
        <aside style={logRail()}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Recent Orders</div>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <label style={label()}>
              Balance checker (name or NFC)
              <input
                value={balanceQuery}
                onChange={(e) => setBalanceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  (async () => {
                    if (!balanceQuery.trim()) return;
                    const nfcStudent = await lookupNfc(balanceQuery);
                    if (nfcStudent) {
                      setBalanceQuery(nfcStudent.name);
                      setBalanceResults([]);
                      loadBalance(nfcStudent);
                      return;
                    }
                    if (balanceResults.length) {
                      const first = balanceResults[0];
                      setBalanceQuery(first.name);
                      setBalanceResults([]);
                      loadBalance(first);
                    }
                  })();
                }}
                placeholder="Type name or scan NFC"
                style={input()}
              />
            </label>
            {balanceResults.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {balanceResults.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setBalanceQuery(s.name);
                      setBalanceResults([]);
                      loadBalance(s);
                    }}
                    style={chip()}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : null}
            {balanceData?.student ? (
              <div style={balanceCard()}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={avatarBadge(balanceData?.student?.avatar_bg)}>
                    {balanceData?.student?.avatar_storage_path ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${balanceData.student.avatar_storage_path}`}
                        alt={balanceData?.student?.name ?? "Student"}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontWeight: 900 }}>{(balanceData?.student?.name ?? "?").slice(0, 1)}</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 900 }}>{balanceData.student.name}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Balance: {balanceData.balance_points} pts</div>
                  </div>
                </div>
                {balanceData?.coupons?.length ? (
                  <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                    {balanceData.coupons.map((c: any) => (
                      <div key={c.id} style={{ fontSize: 12, opacity: 0.85 }}>
                        {c.type?.name} • {c.remaining_qty} left
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>No coupons</div>
                )}
              </div>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {orders.map((order: any) => (
              <button
                key={order.id}
                type="button"
                style={orderSummaryCard()}
                onClick={() => {
                  setActiveOrder(order);
                  setRefundMsg("");
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={avatarBadge(order?.student?.avatar_bg)}>
                      {order?.student?.avatar_storage_path ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${order.student.avatar_storage_path}`}
                          alt={order?.student?.name ?? "Student"}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <span style={{ fontWeight: 900 }}>{(order?.student?.name ?? order?.student_name ?? "?").slice(0, 1)}</span>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 4, textAlign: "left" }}>
                      <div style={{ fontWeight: 900 }}>{order?.student?.name ?? order?.student_name ?? "Walk-in"}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{formatLocalTime(order?.paid_at)}</div>
                    </div>
                  </div>
                  <div style={orderPointsPill(order?.refund?.refunded_at)}>
                    {order?.refund?.refunded_at ? "Refunded" : `${order.total_points} pts`}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8, textAlign: "left" }}>Balance: {order.balance_points ?? "-"} pts</div>
                  {renderOrderBalanceLine(order) ? (
                    <div style={{ fontSize: 11, opacity: 0.92, color: "#e2e8f0", textAlign: "left" }}>{renderOrderBalanceLine(order)}</div>
                  ) : null}
                  {order?.refund?.refunded_at ? (
                    <div style={{ fontSize: 11, color: "#f97316", textAlign: "left" }}>
                      Refunded {order?.refund?.refunded_points ?? 0} pts
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
            {!orders.length ? <div style={{ opacity: 0.6 }}>No orders yet.</div> : null}
          </div>
        </aside>

        <div style={centerColumn()}>
          <section style={card()}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Select Items</div>
            {menuSections.length ? (
              <div style={folderTabsWrap()}>
                {menuSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveMenuId(section.id)}
                    style={folderTab(section.id === (activeMenuSection?.id ?? ""))}
                  >
                    {section.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 16 }}>
              {activeMenuSection ? (
                <div key={activeMenuSection.id} style={categoryCard()}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{activeMenuSection.name}</div>
                  <div style={itemsGrid()}>
                    {activeMenuSection.items.map((item) => {
                      const selected = !!selectedItems[item.id];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setSelectedItems((prev) => {
                              if (selected) {
                                return {
                                  ...prev,
                                  [item.id]: { ...prev[item.id], qty: Math.max(1, prev[item.id].qty + 1) },
                                };
                              }
                              return { ...prev, [item.id]: { qty: 1, second: false } };
                            })
                          }
                          style={itemCard(selected, item.name)}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-start" }}>
                            <div style={itemThumb(item)}>
                              {!item.image_url || item.use_text ? (
                                <span style={{ fontSize: 12, fontWeight: 800 }}>{item.image_text || item.name.slice(0, 2)}</span>
                              ) : null}
                            </div>
                            <div style={{ display: "grid", gap: 4, textAlign: "left" }}>
                              <div style={{ fontWeight: 900, fontSize: 22 }}>{item.name}</div>
                              <div style={{ opacity: 0.9, fontSize: 16 }}>{item.price_points} pts</div>
                            </div>
                          </div>
                          {selected ? (
                            <div style={selectedBadge()}>Qty {selectedItems[item.id]?.qty ?? 1}</div>
                          ) : (
                            <div style={tapHint()}>Tap to add</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {!flatItems.length ? <div style={{ opacity: 0.7 }}>No items yet.</div> : null}
            </div>
            <div style={{ marginTop: 12, fontWeight: 900 }}>Total: {totalPoints} pts</div>
          </section>

          {isLeader ? (
            <section style={card()}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Helpers (up to 5)</div>
              <input
                value={helperQuery}
                onChange={(e) => setHelperQuery(e.target.value)}
                placeholder="Type helper name"
                style={input()}
              />
              {helperResults.length ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {helperResults.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (helpers.find((h) => h.id === s.id)) return;
                        if (helpers.length >= 5) return;
                        setHelpers((prev) => [...prev, s]);
                        setHelperQuery("");
                        setHelperResults([]);
                      }}
                      style={chip()}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {helpers.length ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {helpers.map((h) => (
                    <div key={h.id} style={helperChip()}>
                      {h.name}
                      <button onClick={() => setHelpers((prev) => prev.filter((x) => x.id !== h.id))} style={removeBtn()}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {helperMsg ? <div style={{ color: "#fbbf24", marginTop: 6 }}>{helperMsg}</div> : null}
              <button onClick={submitHelpers} style={btnPrimary()}>
                Submit helpers
              </button>
            </section>
          ) : null}
        </div>

        <aside style={payRail()}>
          <div style={cartCard()}>
            <div style={{ fontWeight: 900 }}>Cart</div>
            <div style={{ display: "grid", gap: 8 }}>
              {cartItems.map((entry) => (
                <div key={entry.item.id} style={cartRow()}>
                  <div style={cartTopRow()}>
                    <div style={{ fontWeight: 900 }}>{entry.item.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {entry.item.allow_second ? (
                        <label style={toggle()}>
                          <input
                            type="checkbox"
                            checked={entry.second}
                            onChange={(e) =>
                              setSelectedItems((prev) => ({
                                ...prev,
                                [entry.item.id]: { ...prev[entry.item.id], second: e.target.checked },
                              }))
                            }
                          />
                          2nd serving
                        </label>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItems((prev) => {
                            const next = { ...prev };
                            delete next[entry.item.id];
                            return next;
                          })
                        }
                        style={btnGhostSmall()}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{entry.price} pts</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItems((prev) => ({
                            ...prev,
                            [entry.item.id]: { ...prev[entry.item.id], qty: Math.max(1, entry.qty - 1) },
                          }))
                        }
                        style={qtyBtn()}
                      >
                        -
                      </button>
                      <input
                        value={entry.qty}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setSelectedItems((prev) => ({
                            ...prev,
                            [entry.item.id]: { ...prev[entry.item.id], qty: Math.max(1, Number.isFinite(next) ? next : 1) },
                          }));
                        }}
                        style={qtyInput()}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItems((prev) => ({
                            ...prev,
                            [entry.item.id]: { ...prev[entry.item.id], qty: entry.qty + 1 },
                          }))
                        }
                        style={qtyBtn()}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!cartItems.length ? <div style={{ opacity: 0.6 }}>No items selected yet.</div> : null}
            </div>
            <div style={{ fontWeight: 900, marginTop: 8 }}>Subtotal: {totalPoints} pts</div>
            {totalDiscount > 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Discounts: -{totalDiscount} pts</div>
            ) : null}
            <div style={{ fontWeight: 900 }}>Payable: {payablePoints} pts</div>
          </div>

          <div style={payCard()}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Payable: {payablePoints} pts</div>
            <button
              type="button"
              onClick={() => {
                setPayStep(true);
              }}
              style={payBtn(!canStartPayment)}
              disabled={!canStartPayment}
            >
              PAY
            </button>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {canStartPayment ? "Split payments & discounts open in overlay." : "Add items to cart to continue."}
            </div>
          </div>
        </aside>
      </div>

      {payStep ? (
        <div style={overlayBackdrop()} onClick={() => {
          setPayStep(false);
          setDiscountAuthorized(false);
          setAdminPin("");
          setDiscountApplied(false);
          setDiscountInput("");
        }}>
          <div
            style={overlayCard("payment")}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div style={overlayHeader()}>
              <div style={{ fontWeight: 1000, fontSize: 20 }}>Payment</div>
              <button
                onClick={() => {
                  setPayStep(false);
                  setDiscountAuthorized(false);
                  setAdminPin("");
                  setDiscountApplied(false);
                  setDiscountInput("");
                }}
                style={btnGhostSmall()}
              >
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={payerCard()}>
                <div style={{ fontWeight: 900 }}>Who is paying?</div>
                <input
                  value={payerQuery}
                  onChange={(e) => setPayerQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    (async () => {
                      if (!payerQuery.trim()) return;
                      const nfcStudent = await lookupNfc(payerQuery);
                      if (nfcStudent) {
                        addPayer(nfcStudent);
                        return;
                      }
                      if (payerResults.length) addPayer(payerResults[0]);
                    })();
                  }}
                  placeholder="Type name or scan NFC"
                  style={bigInput()}
                />
                {payerResults.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {payerResults.slice(0, 6).map((s) => (
                      <button key={s.id} onClick={() => addPayer(s)} style={chip()}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>Split payments</div>
                  <button onClick={applyEvenSplit} style={btnGhostSmall()}>
                    Even split
                  </button>
                </div>
                {payers.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {payers.map((payer) => {
                      const payerAmount = Math.max(0, Number(payer.amount) || 0);
                      return (
                      <div key={payer.student.id} style={payerCard()}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <div style={{ fontWeight: 900 }}>{payer.student.name}</div>
                          <button
                            onClick={() => setPayers((prev) => prev.filter((p) => p.student.id !== payer.student.id))}
                            style={btnGhostSmall()}
                          >
                            Remove
                          </button>
                        </div>
                        <label style={label()}>
                          Amount (pts)
                          <input
                            value={payer.amount}
                            onChange={(e) => setPayerAmount(payer.student.id, e.target.value)}
                            style={bigInput()}
                          />
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, payablePoints)}
                          step={1}
                          value={payerAmount}
                          onChange={(e) => setPayerAmount(payer.student.id, e.target.value)}
                          style={payerSlider()}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.7, fontSize: 12 }}>
                          <span>0</span>
                          <span>{payablePoints} pts</span>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div style={{ opacity: 0.6 }}>Add at least one payer.</div>
                )}
              </div>

              <div style={remainingCard(remainingPoints)}>
                <div style={{ fontWeight: 900 }}>Remaining: {remainingPoints} pts</div>
                <div style={remainingBar()}>
                  <div style={remainingFill(remainingPoints, payablePoints)} />
                </div>
              </div>

              {availableCoupons.length ? (
                <div style={couponCard()}>
                  <div style={{ fontWeight: 900 }}>Coupons</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {availableCoupons.map((coupon) => (
                      <label key={coupon.id} style={label()}>
                        {coupon.type?.name} • {coupon.type?.coupon_type === "percent"
                          ? `${Number(coupon.type?.points_value ?? 0)}%`
                          : coupon.type?.coupon_type === "points"
                          ? `${Number(coupon.type?.points_value ?? 0)} pts`
                          : "item"} ({coupon.remaining_qty} left)
                        <input
                          value={couponUses[coupon.id] ?? ""}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            const next = Math.max(0, Math.min(coupon.remaining_qty ?? 0, Number.isFinite(raw) ? raw : 0));
                            setCouponUses((prev) => ({ ...prev, [coupon.id]: next }));
                          }}
                          placeholder="Qty"
                          style={bigInput()}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {auraDiscount > 0 ? (
                <div style={couponCard()}>
                  <div style={{ fontWeight: 900 }}>Aura Discount</div>
                  <div style={{ fontSize: 13 }}>
                    {auraName || "Aura"}: -{auraDiscount} pts
                  </div>
                </div>
              ) : null}

              <div style={discountCard(discountAuthorized)}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Discount</div>
                <label style={label()}>
                  Discount points
                  <input value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} style={bigInput()} />
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <button
                    onClick={() => setDiscountApplied(true)}
                    style={btnGhostSmall()}
                    disabled={!discountAuthorized}
                  >
                    Apply discount
                  </button>
                  <button
                    onClick={() => setDiscountApplied(false)}
                    style={btnGhostSmall()}
                    disabled={!discountApplied}
                  >
                    Clear
                  </button>
                </div>
                {!discountAuthorized ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <label style={label()}>
                      Admin PIN / NFC
                      <input
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") unlockDiscount();
                        }}
                        style={bigInput()}
                      />
                    </label>
                    <button onClick={unlockDiscount} style={btnPrimary()}>
                      Unlock discount
                    </button>
                  </div>
                ) : null}
              </div>

              <label style={label()}>
                Paid by (optional)
                <input value={paidBy} onChange={(e) => setPaidBy(e.target.value)} style={bigInput()} />
              </label>

              {msg ? <div style={{ color: "crimson" }}>{msg}</div> : null}

              <button onClick={submitPayment} style={btnPrimary()} disabled={isSubmittingPayment}>
                {isSubmittingPayment ? "Submitting..." : "Submit payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeOrder ? (
        <div
          style={overlayBackdrop()}
          onClick={() => {
            setActiveOrder(null);
            setRefundMsg("");
          }}
        >
          <div
            style={overlayCard("detail")}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div style={overlayHeader()}>
              <div style={{ fontWeight: 1000, fontSize: 20 }}>Order Details</div>
              <button
                onClick={() => {
                  setActiveOrder(null);
                  setRefundMsg("");
                }}
                style={btnGhostSmall()}
              >
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={detailCard()}>
                <div style={{ fontWeight: 900 }}>{activeOrder?.student?.name ?? activeOrder?.student_name ?? "Walk-in"}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>Paid at: {formatLocalTime(activeOrder?.paid_at)}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>Paid by: {activeOrder?.paid_by || "—"}</div>
                <div style={{ fontWeight: 900 }}>Total paid: {activeOrder?.total_points ?? 0} pts</div>
              </div>

              <div style={detailCard()}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Items</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {(Array.isArray(activeOrder?.items) ? activeOrder.items : []).map((item: any, idx: number) => (
                    <div key={`${item?.id ?? item?.name ?? "item"}-${idx}`} style={{ fontSize: 13 }}>
                      {item?.name ?? "Item"} • {item?.qty ?? 1} × {item?.price_points ?? 0} pts
                    </div>
                  ))}
                </div>
              </div>

              <div style={detailCard()}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Payments</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {(Array.isArray(activeOrder?.payments) ? activeOrder.payments : []).map((p: any, idx: number) => (
                    <div key={`${p?.student_id ?? p?.student_name ?? "payer"}-${idx}`} style={{ fontSize: 13 }}>
                      {p?.student_name ?? "Payer"} • {p?.amount_points ?? 0} pts
                      {Number.isFinite(Number(p?.balance_before)) && Number.isFinite(Number(p?.balance_after))
                        ? ` • ${Number(p.balance_before).toLocaleString()} -> ${Number(p.balance_after).toLocaleString()}`
                        : ""}
                      {Number.isFinite(Number(p?.refund_balance_before)) && Number.isFinite(Number(p?.refund_balance_after))
                        ? ` • refund ${Number(p.refund_balance_before).toLocaleString()} -> ${Number(p.refund_balance_after).toLocaleString()}`
                        : ""}
                    </div>
                  ))}
                </div>
              </div>

              <div style={detailCard()}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Discounts</div>
                <div style={{ fontSize: 13 }}>Manual: {activeOrder?.discount_points ?? 0} pts</div>
                {Array.isArray(activeOrder?.coupons_used) && activeOrder.coupons_used.length ? (
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    Coupons:
                    <div style={{ marginTop: 4, display: "grid", gap: 4 }}>
                      {activeOrder.coupons_used.map((c: any, idx: number) => (
                        <div key={`${c?.coupon_type_id ?? "coupon"}-${idx}`} style={{ fontSize: 12, opacity: 0.8 }}>
                          {c?.type ?? "coupon"} • qty {c?.qty ?? 1}
                          {c?.type === "percent" ? ` • ${c?.percent_value ?? 0}%` : null}
                          {c?.type === "points" ? ` • ${c?.points_value ?? 0} pts` : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>No coupons</div>
                )}
              </div>

              <div style={detailCard()}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Refund</div>
                {activeOrder?.refund?.refunded_at ? (
                  <div style={{ fontSize: 13, color: "#f97316" }}>
                    Refunded {activeOrder?.refund?.refunded_points ?? 0} pts at {formatLocalTime(activeOrder.refund.refunded_at)}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Refunds restore balance only.</div>
                    <button
                      onClick={() => {
                        if (!canRefund) return;
                        if (typeof window !== "undefined") {
                          const ok = window.confirm("Refund this order?");
                          if (!ok) return;
                        }
                        refundOrder(activeOrder.id);
                      }}
                      style={btnPrimary()}
                      disabled={!canRefund}
                    >
                      Refund order
                    </button>
                  </div>
                )}
                {refundMsg ? <div style={{ color: "#fbbf24", marginTop: 6 }}>{refundMsg}</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function layoutGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "360px minmax(0, 1fr) 320px",
    columnGap: 18,
    rowGap: 16,
    alignItems: "start",
    marginTop: 16,
    justifyItems: "stretch",
  };
}

function centerColumn(): React.CSSProperties {
  return {
    width: "100%",
    justifySelf: "stretch",
    minWidth: 0,
    padding: 0,
  };
}

function card(): React.CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.6), rgba(3,7,18,0.8))",
    backdropFilter: "blur(8px)",
  };
}

function detailCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 6,
  };
}

function itemsGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(3, minmax(260px, 1fr))", gap: 12, overflow: "hidden" };
}

function categoryCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 10,
  };
}

function itemThumb(item: MenuItem): React.CSSProperties {
  const hasImage = item.image_url && !item.use_text;
  return {
    width: 120,
    height: 120,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.2)",
    background: hasImage
      ? `center / cover no-repeat url(${item.image_url})`
      : "linear-gradient(135deg, rgba(14,116,144,0.35), rgba(30,41,59,0.35))",
    display: "grid",
    placeItems: "center",
    color: "white",
  };
}

function itemCard(active: boolean, label: string): React.CSSProperties {
  const palettes = [
    "linear-gradient(135deg, rgba(14,116,144,0.5), rgba(2,132,199,0.25))",
    "linear-gradient(135deg, rgba(34,197,94,0.5), rgba(22,163,74,0.25))",
    "linear-gradient(135deg, rgba(248,113,113,0.5), rgba(244,63,94,0.25))",
    "linear-gradient(135deg, rgba(217,119,6,0.5), rgba(245,158,11,0.25))",
    "linear-gradient(135deg, rgba(99,102,241,0.5), rgba(67,56,202,0.25))",
    "linear-gradient(135deg, rgba(168,85,247,0.5), rgba(126,34,206,0.25))",
    "linear-gradient(135deg, rgba(236,72,153,0.5), rgba(219,39,119,0.25))",
    "linear-gradient(135deg, rgba(59,130,246,0.5), rgba(30,64,175,0.25))",
    "linear-gradient(135deg, rgba(6,182,212,0.5), rgba(8,145,178,0.25))",
  ];
  let idx = 0;
  for (let i = 0; i < label.length; i += 1) idx = (idx + label.charCodeAt(i)) % palettes.length;
  return {
    borderRadius: 14,
    padding: 14,
    border: active ? "1px solid rgba(56,189,248,0.8)" : "1px solid rgba(255,255,255,0.16)",
    background: `${palettes[idx]}, rgba(8,10,15,0.55)`,
    display: "grid",
    gap: 8,
    cursor: "pointer",
    textAlign: "left",
    color: "white",
    minHeight: 120,
    overflow: "hidden",
    boxShadow: active ? "0 0 0 1px rgba(56,189,248,0.4), 0 18px 40px rgba(0,0,0,0.35)" : "0 14px 30px rgba(0,0,0,0.3)",
    backdropFilter: "blur(6px)",
  };
}

function toggle(): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.85 };
}

function selectedBadge(): React.CSSProperties {
  return {
    justifySelf: "center",
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(14,165,233,0.3)",
    border: "1px solid rgba(14,165,233,0.6)",
    fontSize: 11,
    fontWeight: 800,
  };
}

function tapHint(): React.CSSProperties {
  return {
    justifySelf: "center",
    fontSize: 11,
    opacity: 0.6,
  };
}

function payerCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 8,
  };
}

function receiptRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  };
}

function avatarBadge(bg?: string | null): React.CSSProperties {
  return {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: bg || "rgba(255,255,255,0.12)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function logRail(): React.CSSProperties {
  return {
    position: "sticky",
    top: 100,
    alignSelf: "start",
    borderRadius: 16,
    padding: "10px 8px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(6,8,12,0.75)",
    justifySelf: "start",
    width: "100%",
    minWidth: 0,
    color: "white",
  };
}

function logItem(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  };
}

function payRail(): React.CSSProperties {
  return { position: "sticky", top: 100, alignSelf: "start" };
}

function cartCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,12,18,0.7)",
    display: "grid",
    gap: 10,
    marginBottom: 12,
  };
}

function cartRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  };
}

function cartTopRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" };
}

function balanceCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  };
}

function couponCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
  };
}

function payCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(12,20,14,0.7)",
    display: "grid",
    gap: 10,
    textAlign: "center",
  };
}

function overlayBackdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.75)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    zIndex: 60,
  };
}

function overlayCard(kind: "payment" | "detail" = "detail"): React.CSSProperties {
  return {
    width: kind === "payment" ? "min(740px, 94vw)" : "min(920px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))",
    boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
  };
}

function overlayHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  };
}

function payBtn(disabled = false): React.CSSProperties {
  return {
    padding: "14px 18px",
    borderRadius: 14,
    border: disabled ? "1px solid rgba(148,163,184,0.35)" : "1px solid rgba(34,197,94,0.8)",
    background: disabled
      ? "linear-gradient(135deg, rgba(51,65,85,0.7), rgba(30,41,59,0.6))"
      : "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.6))",
    color: "white",
    fontWeight: 900,
    fontSize: 18,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
  };
}

function bigInput(): React.CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(8,10,15,0.85)",
    color: "white",
    fontSize: 18,
    fontWeight: 700,
  };
}

function pinInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(6,8,12,0.8)",
    color: "white",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 1,
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(14,116,144,0.6)",
    background: "linear-gradient(135deg, rgba(14,116,144,0.9), rgba(2,132,199,0.6))",
    color: "white",
    fontWeight: 800,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 700,
    textDecoration: "none",
  };
}

function btnGhostSmall(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 700,
    fontSize: 12,
  };
}

function qtyInput(): React.CSSProperties {
  return {
    width: 50,
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
    textAlign: "center",
  };
}

function qtyBtn(): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
  };
}

function chip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 700,
  };
}

function helperChip(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.4)",
    background: "rgba(125,211,252,0.12)",
    color: "white",
    fontWeight: 700,
  };
}

function removeBtn(): React.CSSProperties {
  return {
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 12,
  };
}

function remainingCard(remaining: number): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${remaining === 0 ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.12)"}`,
    background: remaining === 0 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  };
}

function remainingBar(): React.CSSProperties {
  return {
    height: 16,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  };
}

function remainingFill(remaining: number, total: number): React.CSSProperties {
  const ratio = total > 0 ? Math.min(1, Math.max(0, (total - remaining) / total)) : 0;
  return {
    height: "100%",
    width: `${Math.round(ratio * 100)}%`,
    background: "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(14,116,144,0.9))",
  };
}

function discountCard(authorized: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${authorized ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.12)"}`,
    background: authorized ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
  };
}

function discountBtn(authorized: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(249,115,22,0.6)",
    background: authorized ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 800,
    opacity: authorized ? 1 : 0.4,
  };
}

function renderOrderBalanceLine(order: any): string {
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const first = payments.find((p: any) => Number.isFinite(Number(p?.balance_before)) && Number.isFinite(Number(p?.balance_after)));
  if (!first) return "";
  const before = Number(first.balance_before);
  const after = Number(first.balance_after);
  const delta = after - before;
  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toLocaleString()} pts`;
  if (order?.refund?.refunded_at) {
    const rb = Number(first?.refund_balance_before);
    const ra = Number(first?.refund_balance_after);
    if (Number.isFinite(rb) && Number.isFinite(ra)) {
      return `Paid ${before.toLocaleString()} -> ${after.toLocaleString()} (${deltaLabel}) • Refunded ${rb.toLocaleString()} -> ${ra.toLocaleString()}`;
    }
  }
  return `${before.toLocaleString()} -> ${after.toLocaleString()} (${deltaLabel})`;
}

function folderTabsWrap(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "end",
    marginBottom: 10,
  };
}

function folderTab(active: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: "14px 14px 0 0",
    border: active ? "1px solid rgba(56,189,248,0.75)" : "1px solid rgba(255,255,255,0.16)",
    borderBottom: active ? "1px solid rgba(8,10,15,0.9)" : "1px solid rgba(255,255,255,0.12)",
    background: active
      ? "linear-gradient(180deg, rgba(14,165,233,0.28), rgba(8,10,15,0.9))"
      : "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(8,10,15,0.75))",
    color: "white",
    fontWeight: 800,
  };
}

function orderSummaryCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.72), rgba(3,7,18,0.82))",
    display: "grid",
    width: "100%",
    textAlign: "left",
    color: "white",
    appearance: "none",
    boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
  };
}

function orderPointsPill(refunded: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    border: refunded ? "1px solid rgba(249,115,22,0.6)" : "1px solid rgba(34,197,94,0.45)",
    background: refunded ? "rgba(249,115,22,0.18)" : "rgba(34,197,94,0.16)",
  };
}

function payerSlider(): React.CSSProperties {
  return {
    width: "100%",
    accentColor: "#22c55e",
    height: 20,
    cursor: "pointer",
  };
}
