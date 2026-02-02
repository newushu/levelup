"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const adminSections = [
  {
    title: "Insights",
    cards: [
      {
        title: "Admin Stats",
        desc: "Level counts, avatar usage, prestige badge holders, and medals.",
        href: "/admin/custom/admin-stats",
      },
    ],
  },
  {
    title: "Program Setup",
    cards: [
      {
        title: "Level Thresholds",
        desc: "Manage level thresholds and expand beyond 99.",
        href: "/admin/custom/level-thresholds",
      },
      {
        title: "Schedule Builder",
        desc: "Weekly class schedule, rooms, instructors, and locations.",
        href: "/admin/custom/schedule",
      },
      {
        title: "Skill Trees",
        desc: "Create and manage skill tree sets and levels.",
        href: "/admin/custom/skill-tree",
      },
      {
        title: "Skill Stats",
        desc: "Create timed skill tests (e.g., 10-sec rep counts).",
        href: "/admin/custom/skill-stats",
      },
      {
        title: "Performance Lab",
        desc: "Manage performance metrics used by Challenge Vault.",
        href: "/admin/custom/stats",
      },
      {
        title: "Season Settings",
        desc: "Set semester start date and week count for rule breakers.",
        href: "/admin/custom/season",
      },
      {
        title: "Form Forge (Taolu Tracker)",
        desc: "Configure Taolu tracker settings and coach workflow.",
        href: "/admin/custom/taolu",
      },
      {
        title: "IWUF Scoring Rules",
        desc: "Manage age groups, Taolu forms, and deduction codes.",
        href: "/admin/custom/iwuf-scoring",
      },
      {
        title: "LessonForge Builder",
        desc: "Create class templates with sections, timers, and video tools.",
        href: "/tools/lesson-forge/builder",
      },
    ],
  },
  {
    title: "Engagement & Rewards",
    cards: [
      {
        title: "Spotlight Stars",
        desc: "Configure class awards and point values.",
        href: "/admin/custom/spotlight",
      },
      {
        title: "Challenge Vault",
        desc: "Create completion, quota, and stat-based challenges.",
        href: "/admin/custom/challenges",
      },
      {
        title: "Achievements & Badges",
        desc: "Assign badge art and point values to achievements.",
        href: "/admin/custom/achievements",
      },
      {
        title: "Prestige Badges",
        desc: "Set prestige badge requirements, titles, and tooltips.",
        href: "/admin/custom/prestige",
      },
      {
        title: "Rewards Catalog",
        desc: "Set reward types, categories, and redemption limits.",
        href: "/admin/custom/rewards",
      },
      {
        title: "Leaderboard Daily Bonus",
        desc: "Set daily points for top-5 leaderboard placements.",
        href: "/admin/custom/leaderboard-bonus",
      },
      {
        title: "Roulette Wheel",
        desc: "Create prize/task wheels and configure spin outcomes.",
        href: "/admin/custom/roulette",
      },
      {
        title: "Wushu Adventure Quest",
        desc: "Define quest items used by roulette and future adventures.",
        href: "/admin/custom/wushu-quest",
      },
      {
        title: "Home Quest",
        desc: "Configure at-home features, limits, and parent PIN.",
        href: "/admin/custom/home-quest",
      },
    ],
  },
  {
    title: "Media & Branding",
    cards: [
      {
        title: "Media Vault",
        desc: "Sound effects, badge art, and branding assets.",
        href: "/admin/custom/media",
      },
      {
        title: "Avatar Design and Settings",
        desc: "Avatars, effects, corner borders, and card plates.",
        href: "/admin/custom/media?view=avatars",
      },
      {
        title: "Display Settings",
        desc: "Choose which displays and live activity events are shown.",
        href: "/admin/custom/display-settings",
      },
      {
        title: "Badge Overlay Access",
        desc: "Choose which account types see badge overlays.",
        href: "/admin/custom/badge-overlays",
      },
      {
        title: "Video Library",
        desc: "Manage YouTube video tags and coach search results.",
        href: "/admin/custom/video-library",
      },
      {
        title: "Marketing Hub",
        desc: "Manage home page announcements and promo visuals.",
        href: "/admin/custom/marketing",
      },
      {
        title: "Email & Flyer Builder",
        desc: "Design winter promo emails and export HTML.",
        href: "/admin/custom/email-builder",
      },
    ],
  },
  {
    title: "Student Ops",
    cards: [
      {
        title: "Access & Permissions",
        desc: "Manage NFC access tags and role permissions.",
        href: "/admin/custom/access",
      },
      {
        title: "Staff Accounts",
        desc: "Create coach or admin logins (backend only).",
        href: "/admin/custom/staff-accounts",
      },
      {
        title: "Account Directory",
        desc: "Update parent and staff display names.",
        href: "/admin/custom/account-directory",
      },
      {
        title: "Student Directory",
        desc: "Add new students and basic contact details.",
        href: "/admin/custom/students",
      },
      {
        title: "Coach Notes & Alerts",
        desc: "Set to-do alert email and note urgency guidance.",
        href: "/admin/custom/notes",
      },
      {
        title: "App Navigation",
        desc: "Toggle student name links in roster and top bar.",
        href: "/admin/custom/navigation",
      },
      {
        title: "Skill Tracker",
        desc: "Manage failure reasons for tracker skills.",
        href: "/admin/custom/skill-tracker",
      },
      {
        title: "Parent Pairing",
        desc: "Approve parent requests and link student accounts.",
        href: "/admin/parent-pairing",
      },
      {
        title: "Parent Messages",
        desc: "Reply to parent DMs in one place.",
        href: "/admin/parent-messages",
      },
    ],
  },
  {
    title: "Passes & Registration",
    cards: [
      {
        title: "Pass Management",
        desc: "Create passes, set prices, images, and access scope.",
        href: "/admin/passes",
      },
      {
        title: "Pass Assignment",
        desc: "Assign passes to students and bulk apply passes.",
        href: "/admin/passes-assign",
      },
      {
        title: "Pass Accounting",
        desc: "Record pass payments and amounts received.",
        href: "/admin/passes-accounting",
      },
      {
        title: "Registration Widget",
        desc: "Preview the public registration flow.",
        href: "/register/passes",
      },
    ],
  },
  {
    title: "Camp",
    cards: [
      {
        title: "Camp Settings",
        desc: "Manage camp points, leaders, PIN access, and quick links.",
        href: "/admin/custom/camp",
      },
    ],
  },
];

const operationsCards = [
  {
    title: "Rewards Approvals",
    desc: "Approve or reject student hold requests.",
    href: "/admin/rewards",
  },
];

export default function CustomAdminHome() {
  const [pinOk, setPinOk] = useState(false);
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [nfcCode, setNfcCode] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [todoCount, setTodoCount] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      const res = await fetch("/api/skill-tracker/settings", { cache: "no-store" });
      const sj = await res.json().catch(() => ({}));
      if (res.ok) setPinSet(Boolean(sj?.settings?.admin_pin_set));
    })();
  }, []);

  async function verifyPin() {
    setPinMsg("");
    if (!pin.trim()) return setPinMsg("Enter admin PIN.");
    setPinBusy(true);
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const sj = await res.json().catch(() => ({}));
    setPinBusy(false);
    if (!res.ok) return setPinMsg(sj?.error || "Invalid PIN");
    setPinOk(true);
    setPin("");
  }

  async function verifyNfc() {
    setPinMsg("");
    if (!nfcCode.trim()) return setPinMsg("Scan NFC code.");
    setPinBusy(true);
    const res = await fetch("/api/nfc/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: nfcCode.trim(), permission_key: "admin_workspace" }),
    });
    const sj = await res.json().catch(() => ({}));
    setPinBusy(false);
    if (!res.ok) return setPinMsg(sj?.error || "Invalid NFC code");
    setPinOk(true);
    setNfcCode("");
  }

  useEffect(() => {
    if (!pinOk) return;
    (async () => {
      const res = await fetch("/api/student-notes/todo?status=open&count=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data?.count === "number") {
        setTodoCount(data.count);
      }
    })();
  }, [pinOk]);

  if (!pinOk) {
    return (
      <main style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Admin Workspace</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Enter the admin PIN or scan NFC to access Admin Custom.
        </div>
        {pinMsg ? (
          <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.12)", fontWeight: 900, fontSize: 12 }}>
            {pinMsg}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={pinSet ? "Admin PIN" : "Admin PIN (set in Skill Tracker settings)"}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(15,23,42,0.45)",
              color: "white",
              fontSize: 13,
            }}
          />
          <input
            type="password"
            value={nfcCode}
            onChange={(e) => setNfcCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              verifyNfc();
            }}
            placeholder="Scan NFC tag"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(15,23,42,0.45)",
              color: "white",
              fontSize: 13,
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={verifyPin}
              disabled={pinBusy}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(59,130,246,0.35)",
                background: "rgba(59,130,246,0.25)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {pinBusy ? "Checking..." : "Unlock"}
            </button>
            <button
              onClick={verifyNfc}
              disabled={pinBusy}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {pinBusy ? "Checking..." : "Use NFC"}
            </button>
          </div>
        </div>
      </main>
    );
  }
  const q = query.trim().toLowerCase();
  const filteredSections = adminSections
    .map((section) => {
      const matchesSection = section.title.toLowerCase().includes(q);
      const cards = section.cards.filter((card) => {
        if (!q) return true;
        const haystack = `${card.title} ${card.desc} ${section.title}`.toLowerCase();
        return haystack.includes(q) || matchesSection;
      });
      return { ...section, cards };
    })
    .filter((section) => section.cards.length > 0);
  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Admin Workspace</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Configure your program and manage daily operations.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search admin custom cards..."
          style={{
            flex: 1,
            minWidth: 240,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15,23,42,0.45)",
            color: "white",
            fontSize: 13,
          }}
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {filteredSections.map((section) => (
        <section key={section.title} style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>{section.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {section.cards.map((card) => (
              <Link key={card.href} href={card.href} style={cardStyle()}>
                <div style={{ fontWeight: 1000, display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{card.title}</span>
                  {card.href === "/admin/custom/notes" && todoCount > 0 ? (
                    <span style={badge()}>{todoCount}</span>
                  ) : null}
                </div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>{card.desc}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Operations</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {operationsCards.map((card) => (
            <Link key={card.href} href={card.href} style={cardStyle()}>
              <div style={{ fontWeight: 1000 }}>{card.title}</div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>{card.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    textDecoration: "none",
    color: "white",
    display: "grid",
    gap: 6,
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
  };
}

function badge(): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "rgba(59,130,246,0.25)",
    fontSize: 11,
    fontWeight: 900,
  };
}
