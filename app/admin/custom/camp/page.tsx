"use client";

import { useEffect, useState } from "react";

type LeaderRow = {
  id?: string;
  student_id: string;
  student_name?: string | null;
  start_date: string;
  end_date: string;
  enabled: boolean;
};

type StudentPick = { id: string; name: string };

type CampSettings = {
  daily_points: number;
  helper_points: number;
};

type CouponType = {
  id?: string;
  name: string;
  coupon_type: string;
  points_value: string;
  item_id: string;
  enabled: boolean;
};

type MenuItem = { id: string; name: string };

export default function CampAdminSettingsPage() {
  const [settings, setSettings] = useState<CampSettings>({ daily_points: 0, helper_points: 0 });
  const [campPin, setCampPin] = useState("");
  const [msg, setMsg] = useState("");

  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentPick[]>([]);

  const [couponTypes, setCouponTypes] = useState<CouponType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [couponMsg, setCouponMsg] = useState("");

  const [couponStudent, setCouponStudent] = useState<StudentPick | null>(null);
  const [couponStudentQuery, setCouponStudentQuery] = useState("");
  const [couponStudentResults, setCouponStudentResults] = useState<StudentPick[]>([]);
  const [studentCoupons, setStudentCoupons] = useState<any[]>([]);
  const [grantCouponId, setGrantCouponId] = useState("");
  const [grantQty, setGrantQty] = useState("1");
  const [auraName, setAuraName] = useState("");
  const [auraDiscount, setAuraDiscount] = useState("0");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/camp/settings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.settings) {
        setSettings({
          daily_points: Number(data.settings.daily_points ?? 0),
          helper_points: Number(data.settings.helper_points ?? 0),
        });
      }
    })();
    (async () => {
      const res = await fetch("/api/camp/leaders", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLeaders(
          (data.leaders ?? []).map((row: any) => ({
            id: row.id,
            student_id: row.student_id,
            student_name: row.student_name,
            start_date: row.start_date ?? "",
            end_date: row.end_date ?? "",
            enabled: row.enabled !== false,
          }))
        );
      }
    })();
    (async () => {
      const res = await fetch("/api/camp/coupons/types", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCouponTypes(
          (data.types ?? []).map((row: any) => ({
            id: row.id,
            name: row.name ?? "",
            coupon_type: row.coupon_type ?? "points",
            points_value: String(row.points_value ?? ""),
            item_id: String(row.item_id ?? ""),
            enabled: row.enabled !== false,
          }))
        );
      }
    })();
    (async () => {
      const res = await fetch("/api/camp/menus?items=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const items: MenuItem[] = [];
        (data.menus ?? []).forEach((menu: any) => {
          (menu.items ?? []).forEach((item: any) => {
            items.push({ id: String(item.id), name: String(item.name ?? "Item") });
          });
        });
        setMenuItems(items);
      }
    })();
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStudentResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }, 200);
    return () => clearTimeout(t);
  }, [studentQuery]);

  useEffect(() => {
    if (!couponStudentQuery.trim()) {
      setCouponStudentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: couponStudentQuery.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCouponStudentResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }, 200);
    return () => clearTimeout(t);
  }, [couponStudentQuery]);

  useEffect(() => {
    if (!couponStudent?.id) {
      setStudentCoupons([]);
      return;
    }
    (async () => {
      const res = await fetch("/api/camp/coupons/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: couponStudent.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStudentCoupons(data.coupons ?? []);
    })();
    (async () => {
      const res = await fetch("/api/camp/balance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: couponStudent.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAuraName(String(data?.aura?.aura_name ?? ""));
        setAuraDiscount(String(data?.aura?.discount_points ?? 0));
      }
    })();
  }, [couponStudent]);

  async function saveSettings() {
    setMsg("");
    const res = await fetch("/api/camp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_points: settings.daily_points,
        helper_points: settings.helper_points,
        camp_pin: campPin.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to save settings");
    setMsg("Settings saved");
    setCampPin("");
  }

  async function saveLeaders() {
    setMsg("");
    const res = await fetch("/api/camp/leaders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaders }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to save leaders");
    setMsg("Leaders saved");
  }

  async function saveCouponTypes() {
    setCouponMsg("");
    const res = await fetch("/api/camp/coupons/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        types: couponTypes.map((t) => ({
          ...t,
          points_value: Number(t.points_value) || null,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setCouponMsg(data?.error || "Failed to save coupon types");
    setCouponMsg("Coupon types saved");
  }

  async function grantCoupon() {
    if (!couponStudent?.id || !grantCouponId) return;
    setCouponMsg("");
    const res = await fetch("/api/camp/coupons/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: couponStudent.id,
        coupon_type_id: grantCouponId,
        grant_qty: Number(grantQty) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setCouponMsg(data?.error || "Failed to grant coupon");
    setCouponMsg("Coupon granted");
    setGrantQty("1");
    const refresh = await fetch("/api/camp/coupons/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: couponStudent.id }),
    });
    const rj = await refresh.json().catch(() => ({}));
    if (refresh.ok) setStudentCoupons(rj.coupons ?? []);
  }

  async function saveAura() {
    if (!couponStudent?.id) return;
    setCouponMsg("");
    const res = await fetch("/api/camp/auras/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: couponStudent.id,
        aura_name: auraName.trim(),
        discount_points: Number(auraDiscount) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setCouponMsg(data?.error || "Failed to save aura");
    setCouponMsg("Aura saved");
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Camp Settings</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Manage camp points, leaders, and access.</div>
      {msg ? <div style={{ color: "#fbbf24", marginTop: 8 }}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Daily Points</div>
        <div style={grid()}>
          <label style={label()}>
            Leader daily points
            <input
              value={settings.daily_points}
              onChange={(e) => setSettings((prev) => ({ ...prev, daily_points: Number(e.target.value) || 0 }))}
              style={input()}
            />
          </label>
          <label style={label()}>
            Helper daily points
            <input
              value={settings.helper_points}
              onChange={(e) => setSettings((prev) => ({ ...prev, helper_points: Number(e.target.value) || 0 }))}
              style={input()}
            />
          </label>
          <label style={label()}>
            Camp PIN (leave blank to keep)
            <input
              value={campPin}
              onChange={(e) => setCampPin(e.target.value)}
              placeholder="New PIN"
              style={input()}
            />
          </label>
        </div>
        <button onClick={saveSettings} style={btnPrimary()}>Save settings</button>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Camp Leaders</div>
        <label style={label()}>
          Add leader
          <input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Search student"
            style={input()}
          />
        </label>
        {studentResults.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {studentResults.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (leaders.find((l) => l.student_id === s.id)) return;
                  setLeaders((prev) => [
                    {
                      student_id: s.id,
                      student_name: s.name,
                      start_date: new Date().toISOString().slice(0, 10),
                      end_date: "",
                      enabled: true,
                    },
                    ...prev,
                  ]);
                  setStudentQuery("");
                  setStudentResults([]);
                }}
                style={chip()}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {leaders.map((leader, idx) => (
            <div key={leader.id ?? `${leader.student_id}-${idx}`} style={leaderRow()}>
              <div style={{ fontWeight: 900 }}>{leader.student_name || leader.student_id}</div>
              <label style={label()}>
                Start date
                <input
                  type="date"
                  value={leader.start_date}
                  onChange={(e) =>
                    setLeaders((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, start_date: e.target.value } : row)))
                  }
                  style={input()}
                />
              </label>
              <label style={label()}>
                End date
                <input
                  type="date"
                  value={leader.end_date}
                  onChange={(e) =>
                    setLeaders((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, end_date: e.target.value } : row)))
                  }
                  style={input()}
                />
              </label>
              <label style={toggle()}>
                <input
                  type="checkbox"
                  checked={leader.enabled}
                  onChange={(e) =>
                    setLeaders((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, enabled: e.target.checked } : row)))
                  }
                />
                Enabled
              </label>
              <button
                onClick={() => setLeaders((prev) => prev.filter((_, rIdx) => rIdx !== idx))}
                style={btnGhost()}
              >
                Remove
              </button>
            </div>
          ))}
          {!leaders.length ? <div style={{ opacity: 0.6 }}>No leaders added.</div> : null}
        </div>
        <button onClick={saveLeaders} style={btnPrimary()}>Save leaders</button>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Coupon Types</div>
        {couponMsg ? <div style={{ color: "#fbbf24", marginBottom: 8 }}>{couponMsg}</div> : null}
        <div style={{ display: "grid", gap: 10 }}>
          {couponTypes.map((c, idx) => (
            <div key={c.id ?? `coupon-${idx}`} style={couponRow()}>
              <label style={label()}>
                Coupon name
                <input
                  value={c.name}
                  onChange={(e) =>
                    setCouponTypes((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, name: e.target.value } : row)))
                  }
                  style={input()}
                />
              </label>
              <label style={label()}>
                Type
                <select
                  value={c.coupon_type}
                  onChange={(e) =>
                    setCouponTypes((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, coupon_type: e.target.value } : row)))
                  }
                  style={input()}
                >
                  <option value="points">Points</option>
                  <option value="percent">Percent</option>
                  <option value="item">Item (legacy)</option>
                </select>
              </label>
              {c.coupon_type === "percent" ? (
                <label style={label()}>
                  Percent off
                  <input
                    value={c.points_value}
                    onChange={(e) =>
                      setCouponTypes((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, points_value: e.target.value } : row)))
                    }
                    style={input()}
                  />
                </label>
              ) : c.coupon_type === "points" ? (
                <label style={label()}>
                  Points off
                  <input
                    value={c.points_value}
                    onChange={(e) =>
                      setCouponTypes((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, points_value: e.target.value } : row)))
                    }
                    style={input()}
                  />
                </label>
              ) : null}
              <label style={label()}>
                Item (optional)
                <select
                  value={c.item_id}
                  onChange={(e) =>
                    setCouponTypes((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, item_id: e.target.value } : row)))
                  }
                  style={input()}
                >
                  <option value="">Select item</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label style={toggle()}>
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) =>
                    setCouponTypes((prev) => prev.map((row, rIdx) => (rIdx === idx ? { ...row, enabled: e.target.checked } : row)))
                  }
                />
                Enabled
              </label>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={() =>
              setCouponTypes((prev) => [
                ...prev,
                { name: "New Coupon", coupon_type: "points", points_value: "0", item_id: "", enabled: true },
              ])
            }
            style={btnGhost()}
          >
            + Add coupon type
          </button>
          <button onClick={saveCouponTypes} style={btnPrimary()}>Save coupon types</button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Student Coupons + Aura</div>
        <label style={label()}>
          Find student
          <input
            value={couponStudentQuery}
            onChange={(e) => setCouponStudentQuery(e.target.value)}
            placeholder="Search student"
            style={input()}
          />
        </label>
        {couponStudentResults.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {couponStudentResults.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setCouponStudent(s);
                  setCouponStudentQuery(s.name);
                  setCouponStudentResults([]);
                }}
                style={chip()}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        {couponStudent ? (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>{couponStudent.name}</div>
            <div style={couponAssignRow()}>
              <label style={label()}>
                Coupon type
                <select value={grantCouponId} onChange={(e) => setGrantCouponId(e.target.value)} style={input()}>
                  <option value="">Select coupon</option>
                  {couponTypes.map((c) => (
                    <option key={c.id ?? c.name} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label style={label()}>
                Gift quantity
                <input value={grantQty} onChange={(e) => setGrantQty(e.target.value)} style={input()} />
              </label>
              <button onClick={grantCoupon} style={btnPrimary()}>Grant</button>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {studentCoupons.length ? (
                studentCoupons.map((c) => (
                  <div key={c.id} style={couponBadge()}>
                    {c.type?.name} • {c.remaining_qty} left
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.6 }}>No coupons yet.</div>
              )}
            </div>

            <div style={couponAssignRow()}>
              <label style={label()}>
                Aura name
                <input value={auraName} onChange={(e) => setAuraName(e.target.value)} style={input()} />
              </label>
              <label style={label()}>
                Aura discount (points)
                <input value={auraDiscount} onChange={(e) => setAuraDiscount(e.target.value)} style={input()} />
              </label>
              <button onClick={saveAura} style={btnPrimary()}>Save aura</button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Camp Pages</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/camp/register" style={btnGhostLink()}>Points POS</a>
          <a href="/camp/menu-editor" style={btnGhostLink()}>Menu Editor</a>
          <a href="/camp/menu" style={btnGhostLink()}>Menu Display</a>
          <a href="/spin" style={btnGhostLink()}>Prize Wheel</a>
        </div>
      </section>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,12,18,0.7)",
  };
}

function grid(): React.CSSProperties {
  return { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
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

function leaderRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(8,10,15,0.6)",
    display: "grid",
    gap: 10,
    gridTemplateColumns: "minmax(160px, 1.3fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(120px, 0.7fr) minmax(120px, 0.7fr)",
    alignItems: "center",
  };
}

function toggle(): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.8 };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 700,
  };
}

function btnGhostLink(): React.CSSProperties {
  return { ...btnGhost(), textDecoration: "none" };
}

function couponRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(8,10,15,0.6)",
    display: "grid",
    gap: 10,
    gridTemplateColumns: "minmax(180px, 1fr) minmax(120px, 0.6fr) minmax(160px, 0.8fr) minmax(120px, 0.6fr)",
    alignItems: "center",
  };
}

function couponAssignRow(): React.CSSProperties {
  return { display: "grid", gap: 10, gridTemplateColumns: "minmax(200px, 1fr) minmax(140px, 0.5fr) minmax(120px, 0.4fr)", alignItems: "center" };
}

function couponBadge(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 700,
  };
}
