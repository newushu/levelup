"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import { MarketingAdminPanel } from "../custom/marketing/page";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: string;
  announcement_type?: string | null;
  announcement_kind?: string | null;
  discount_label?: string | null;
  discount_ends_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function AdminAnnouncementsPage() {
  return (
    <AuthGate>
      <AdminAnnouncementsInner />
    </AuthGate>
  );
}

function AdminAnnouncementsInner() {
  const [role, setRole] = useState("student");
  const [rows, setRows] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [announcementType, setAnnouncementType] = useState("banner");
  const [announcementKind, setAnnouncementKind] = useState("general");
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountEndsAt, setDiscountEndsAt] = useState("");
  const [viewMode, setViewMode] = useState<"active" | "disabled" | "deleted">("active");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<"banner" | "marketing" | "points">("banner");
  const [kindFilter, setKindFilter] = useState<"all" | "general" | "schedule_change" | "room_change" | "no_classes" | "enrollment_open">("all");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  async function refresh() {
    const res = await fetch("/api/admin/announcements", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load announcements.");
    setRows((sj.json?.announcements ?? []) as Announcement[]);
  }

  useEffect(() => {
    if (role !== "admin") return;
    refresh();
  }, [role]);

  async function addAnnouncement() {
    setMsg("");
    if (!title.trim() || !body.trim()) {
      return setMsg("Title and body are required.");
    }
    setBusy(true);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim(),
        status: "active",
        announcement_type: announcementType,
        announcement_kind: announcementKind,
        discount_label: discountLabel,
        discount_ends_at: discountEndsAt || null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to add announcement.");
    setTitle("");
    setBody("");
    setAnnouncementType("banner");
    setAnnouncementKind("general");
    setDiscountLabel("");
    setDiscountEndsAt("");
    setStartsAt("");
    setEndsAt("");
    refresh();
  }

  async function toggleStatus(id: string, next: string) {
    setSaving((prev) => ({ ...prev, [id]: true }));
    const res = await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    const sj = await safeJson(res);
    setSaving((prev) => ({ ...prev, [id]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update status.");
    refresh();
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Admin access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Announcements</div>
        <Link href="/admin/custom/email-builder" style={createButton()}>
          Create Email/Flyer
        </Link>
      </div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>
        Publish alerts for parents, students, and displays.
      </div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={chipRow()}>
        <button onClick={() => setSection("banner")} style={chip(section === "banner")}>
          Banner Alerts
        </button>
        <button onClick={() => setSection("marketing")} style={chip(section === "marketing")}>
          Marketing Cards
        </button>
        <button onClick={() => setSection("points")} style={chip(section === "points")}>
          Points Marketing
        </button>
      </div>

      {section === "marketing" ? (
        <div style={{ marginTop: 12 }}>
          <MarketingAdminPanel embedded />
        </div>
      ) : null}

      {section === "points" ? (
        <div style={card()}>
          <div style={{ fontWeight: 900 }}>Points Marketing (Placeholder)</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            This area will host points-related promos and student reward messaging. For now, it is a placeholder.
          </div>
        </div>
      ) : null}

      {section !== "banner" ? null : (
        <>
      <div style={chipRow()}>
        <button onClick={() => setViewMode("active")} style={chip(viewMode === "active")}>
          Active
        </button>
        <button onClick={() => setViewMode("disabled")} style={chip(viewMode === "disabled")}>
          Disabled
        </button>
        <button onClick={() => setViewMode("deleted")} style={chip(viewMode === "deleted")}>
          Deleted
        </button>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 900 }}>New Announcement</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <select value={announcementType} onChange={(e) => setAnnouncementType(e.target.value)} style={input()}>
            <option value="banner">Banner (Pinned)</option>
            <option value="marketing">Marketing Card</option>
            <option value="points">Points Marketing</option>
          </select>
          <select value={announcementKind} onChange={(e) => setAnnouncementKind(e.target.value)} style={input()}>
            <option value="general">General</option>
            <option value="schedule_change">Schedule Change</option>
            <option value="room_change">Room Change</option>
            <option value="no_classes">No Classes</option>
            <option value="enrollment_open">Enrollment Open</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={input()} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" rows={4} style={textarea()} />
          {announcementKind === "enrollment_open" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={discountLabel}
                onChange={(e) => setDiscountLabel(e.target.value)}
                placeholder="Discount text (e.g. 20% off enrollment)"
                style={input()}
              />
              <input
                value={discountEndsAt}
                onChange={(e) => setDiscountEndsAt(e.target.value)}
                type="datetime-local"
                style={input()}
              />
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input value={startsAt} onChange={(e) => setStartsAt(e.target.value)} type="datetime-local" style={input()} />
            <input value={endsAt} onChange={(e) => setEndsAt(e.target.value)} type="datetime-local" style={input()} />
          </div>
          <button onClick={addAnnouncement} style={btn()} disabled={busy}>
            {busy ? "Publishing..." : "Publish Announcement"}
          </button>
        </div>
      </div>

      <div style={chipRow()}>
        {[
          { key: "all", label: "All Types" },
          { key: "general", label: "General" },
          { key: "schedule_change", label: "Schedule Change" },
          { key: "room_change", label: "Room Change" },
          { key: "no_classes", label: "No Classes" },
          { key: "enrollment_open", label: "Enrollment Open" },
        ].map((item) => (
          <button key={item.key} onClick={() => setKindFilter(item.key as any)} style={chip(kindFilter === item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <div style={listGrid()}>
        {rows
          .filter((row) => {
            if (viewMode === "active") return row.status === "active";
            if (viewMode === "disabled") return row.status === "inactive";
            return row.status === "deleted";
          })
          .filter((row) => kindFilter === "all" || String(row.announcement_kind ?? "general") === kindFilter)
          .map((row) => (
          <div key={row.id} style={bannerCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 20 }}>{row.title}</div>
                <div style={{ opacity: 0.85, fontSize: 15, marginTop: 6 }}>{row.body}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={dateChip("start")}>{row.starts_at ? `Starts: ${new Date(row.starts_at).toLocaleString()}` : "Starts: immediately"}</span>
                <span style={dateChip("end")}>{row.ends_at ? `Ends: ${new Date(row.ends_at).toLocaleString()}` : "Ends: none"}</span>
              </div>
              {row.discount_label ? (
                <div style={{ fontSize: 12, opacity: 0.95, marginTop: 8 }}>
                  Discount: {row.discount_label} {row.discount_ends_at ? `(ends ${new Date(row.discount_ends_at).toLocaleString()})` : ""}
                </div>
              ) : null}
            </div>
            <div style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.7 }}>
              {row.announcement_type ?? "banner"} • {row.announcement_kind ?? "general"} • {row.status}
            </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
              {row.status === "active" ? (
                <>
                  <button
                    onClick={() => toggleStatus(row.id, "inactive")}
                    style={btnSmall()}
                    disabled={saving[row.id]}
                  >
                    {saving[row.id] ? "Updating..." : "Disable"}
                  </button>
                  <button
                    onClick={() => toggleStatus(row.id, "deleted")}
                    style={btnDanger()}
                    disabled={saving[row.id]}
                  >
                    {saving[row.id] ? "Updating..." : "Delete"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => toggleStatus(row.id, "active")}
                  style={btnSmall()}
                  disabled={saving[row.id]}
                >
                  {saving[row.id] ? "Updating..." : "Activate"}
                </button>
              )}
              <div style={{ opacity: 0.6, fontSize: 11 }}>
                Created {new Date(row.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        {!rows.filter((row) => {
          if (viewMode === "active") return row.status === "active";
          if (viewMode === "disabled") return row.status === "inactive";
          return row.status === "deleted";
        }).length && (
          <div style={{ opacity: 0.7 }}>No announcements yet.</div>
        )}
      </div>
        </>
      )}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 8,
    maxWidth: 560,
    width: "100%",
  };
}

function bannerCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(145deg, rgba(8,10,15,0.86), rgba(15,23,42,0.78))",
    display: "grid",
    gap: 10,
    width: "100%",
  };
}

function dateChip(kind: "start" | "end"): React.CSSProperties {
  const start = kind === "start";
  return {
    borderRadius: 999,
    padding: "5px 10px",
    border: start ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(248,113,113,0.45)",
    background: start ? "rgba(21,128,61,0.26)" : "rgba(127,29,29,0.26)",
    fontSize: 12,
    fontWeight: 900,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 13,
  };
}

function textarea(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 13,
    resize: "vertical",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(14,116,144,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnSmall(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function btnDanger(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(248,113,113,0.18)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function chipRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  };
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function listGrid(): React.CSSProperties {
  return {
    marginTop: 16,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    alignItems: "start",
  };
}

function cardLink(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.6)",
    color: "white",
    textDecoration: "none",
    display: "grid",
    gap: 6,
    minWidth: 220,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  };
}

function createButton(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.7)",
    background: "rgba(59,130,246,0.22)",
    color: "white",
    fontWeight: 900,
    textDecoration: "none",
    fontSize: 12,
  };
}
