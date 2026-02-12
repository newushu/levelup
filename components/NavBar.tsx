"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import GroupPointsOverlay from "./GroupPointsOverlay";

type Me =
  | { ok: true; role: string; user: { id: string; email: string | null } }
  | { ok: false; error: string };

type StudentNotePreview = {
  id: string;
  body: string;
  urgency: string | null;
  student_name: string | null;
  category: string | null;
  created_at: string | null;
};

export default function NavBar() {
  const isEmbed = useSearchParams().get("embed") === "1";
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [dateText, setDateText] = useState<string>(""); // client-only
  const [timeText, setTimeText] = useState<string>(""); // client-only
  const [openMenu, setOpenMenu] = useState<null | "classes" | "performance" | "passes" | "camp" | "more" | "tools">(null);
  const [groupPointsOpen, setGroupPointsOpen] = useState(false);
  const [groupStudents, setGroupStudents] = useState<Array<{ id: string; name: string; level: number; points_total: number; is_competition_team: boolean }>>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupMsg, setGroupMsg] = useState("");
  const [todoCount, setTodoCount] = useState(0);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(true);
  const [navLogoUrl, setNavLogoUrl] = useState("");
  const [navLogoZoom, setNavLogoZoom] = useState(1);
  const [parentUnread, setParentUnread] = useState(false);
  const [adminParentMsgCount, setAdminParentMsgCount] = useState(0);
  const [adminParentRequestCount, setAdminParentRequestCount] = useState(0);
  const [adminRewardCount, setAdminRewardCount] = useState(0);
  const [accountName, setAccountName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [adminTodoHoverOpen, setAdminTodoHoverOpen] = useState(false);
  const [adminTodoHoverLoading, setAdminTodoHoverLoading] = useState(false);
  const [adminTodoHoverMsg, setAdminTodoHoverMsg] = useState("");
  const [adminTodoHoverBusy, setAdminTodoHoverBusy] = useState<Record<string, boolean>>({});
  const [adminTodoHoverItems, setAdminTodoHoverItems] = useState<StudentNotePreview[]>([]);
  const [hoverNoteBody, setHoverNoteBody] = useState("");
  const [hoverNoteCategory, setHoverNoteCategory] = useState("note");
  const [hoverNoteUrgency, setHoverNoteUrgency] = useState("medium");
  const [hoverStudentQuery, setHoverStudentQuery] = useState("");
  const [hoverStudentResults, setHoverStudentResults] = useState<Array<{ id: string; name: string }>>([]);
  const [hoverStudent, setHoverStudent] = useState<{ id: string; name: string } | null>(null);
  const [hoverNoteSaving, setHoverNoteSaving] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideNav =
    isEmbed ||
    path.startsWith("/classroom") ||
    path.startsWith("/student") ||
    path.startsWith("/home-quest") ||
    path.startsWith("/rewards") ||
    path.startsWith("/my-metrics") ||
    path.startsWith("/skill-pulse") ||
    path.startsWith("/taolu-tracker") ||
    path.startsWith("/award") ||
    path.startsWith("/coach") ||
    path.startsWith("/tools/lesson-forge") ||
    path.startsWith("/camp/menu");

  const openMenuSafe = (menu: "classes" | "performance" | "passes" | "camp" | "more" | "tools") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(menu);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 240);
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setDateText(now.toLocaleDateString());
      setTimeText(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateClock();
    const timer = setInterval(updateClock, 60_000);
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        setMe(data);
        if (data?.ok && data?.role === "student") {
          const sRes = await fetch("/api/students/me", { cache: "no-store" });
          const sData = await sRes.json().catch(() => ({}));
          const name = String(sData?.student?.name ?? "").trim();
          setStudentName(name);
        }
      } catch {
        setMe({ ok: false, error: "Failed to load session" });
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/account/profile", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setAccountName(String(data?.display_name ?? ""));
        }
      } catch {
        setAccountName("");
      }
    })();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/nav-settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setNavLogoUrl(String(data?.settings?.logo_url ?? ""));
        const zoom = Number(data?.settings?.logo_zoom ?? 1);
        setNavLogoZoom(Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
      } catch {
        setNavLogoUrl("");
        setNavLogoZoom(1);
      }
    })();
  }, []);

  const loggedIn = me?.ok === true;
  const role = loggedIn ? me.role : null;

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      try {
        const res = await fetch("/api/student-notes/todo?status=open&count=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setTodoCount(Number(data?.count ?? 0));
      } catch {
        setTodoCount(0);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (role !== "admin") return;
    if (!adminTodoHoverOpen) return;
    (async () => {
      setAdminTodoHoverLoading(true);
      setAdminTodoHoverMsg("");
      try {
        const res = await fetch("/api/student-notes?status=open&limit=20", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAdminTodoHoverMsg(data?.error || "Failed to load notes");
          setAdminTodoHoverItems([]);
        } else {
          setAdminTodoHoverItems((data?.notes ?? []) as StudentNotePreview[]);
        }
      } catch {
        setAdminTodoHoverMsg("Failed to load notes");
        setAdminTodoHoverItems([]);
      } finally {
        setAdminTodoHoverLoading(false);
      }
    })();
  }, [adminTodoHoverOpen, adminTodoHoverItems.length, role]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!createRef.current) return;
      if (!createRef.current.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    }
    if (createOpen) {
      window.addEventListener("mousedown", onClick);
    }
    return () => window.removeEventListener("mousedown", onClick);
  }, [createOpen]);

  useEffect(() => {
    if (!hoverStudentQuery.trim()) {
      setHoverStudentResults([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/students/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: hoverStudentQuery.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setHoverStudentResults([]);
        } else {
          setHoverStudentResults((data?.students ?? []) as Array<{ id: string; name: string }>);
        }
      } catch {
        if (!active) return;
        setHoverStudentResults([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [hoverStudentQuery]);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      try {
        const res = await fetch("/api/rewards/admin/pending-count", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setAdminRewardCount(Number(data?.count ?? 0));
      } catch {
        setAdminRewardCount(0);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      try {
        const since = (() => {
          try {
            return localStorage.getItem("admin_parent_messages_last_seen") || "";
          } catch {
            return "";
          }
        })();
        const qs = since ? `?since=${encodeURIComponent(since)}` : "";
        const res = await fetch(`/api/admin/parent-messages/unread-count${qs}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setAdminParentMsgCount(Number(data?.count ?? 0));
      } catch {
        setAdminParentMsgCount(0);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      try {
        const res = await fetch("/api/admin/parent-requests/pending-count", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setAdminParentRequestCount(Number(data?.count ?? 0));
      } catch {
        setAdminParentRequestCount(0);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (role !== "parent") return;
    (async () => {
      try {
        const res = await fetch("/api/parent/messages", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setParentUnread(false);
        const list = (data?.messages ?? []) as Array<{ created_at: string; is_from_admin?: boolean; thread_key?: string }>;
        const hasUnread = list.some((m) => {
          if (!m.is_from_admin) return false;
          const threadKey = String(m.thread_key ?? "general").toLowerCase() || "general";
          const lastSeen = (() => {
            try {
              return localStorage.getItem(`parent_thread_last_seen_${threadKey}`) || "";
            } catch {
              return "";
            }
          })();
          return !lastSeen || new Date(m.created_at) > new Date(lastSeen);
        });
        setParentUnread(hasUnread);
      } catch {
        setParentUnread(false);
      }
    })();
  }, [role]);


  useEffect(() => {
    if (!groupPointsOpen || groupStudents.length) return;
    (async () => {
      setGroupLoading(true);
      setGroupMsg("");
      try {
        const res = await fetch("/api/students/list", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setGroupMsg(data?.error || "Failed to load students");
        } else {
          setGroupStudents((data?.students ?? []) as any[]);
        }
      } catch {
        setGroupMsg("Failed to load students");
      } finally {
        setGroupLoading(false);
      }
    })();
  }, [groupPointsOpen, groupStudents.length]);

  if (isEmbed) return null;

  if (path.startsWith("/display") || (loggedIn && role === "display")) {
    return (
      <div style={displayMenuWrap()}>
        <button
          type="button"
          onClick={() => setDisplayMenuOpen((prev) => !prev)}
          style={displayMenuToggle(displayMenuOpen)}
        >
          {displayMenuOpen ? "Hide Menu" : "Menu"}
        </button>
        {displayMenuOpen ? (
          <>
            <div style={displayMenuTitle()}>Displays</div>
            <div style={displayMenu()}>
              <a href="/display" style={displayLink()}>Live Activity</a>
              <a href="/display/skill-pulse" style={displayLink()}>Skill Pulse</a>
              <span style={displayMuted()}>Rank Movers (soon)</span>
              <span style={displayMuted()}>Badges Earned (soon)</span>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (hideNav) return null;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: 0.4 }}>
        Lead & Achieve: Level Up
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div style={bar()}>
        <div style={{ display: "grid", gap: 6, alignItems: "center", marginLeft: 20 }}>
            <img
              src={navLogoUrl || "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
              alt="Logo"
              style={{
                width: Math.max(28, 120 * (navLogoZoom > 0 ? navLogoZoom : 1)),
                height: Math.max(28, 120 * (navLogoZoom > 0 ? navLogoZoom : 1)),
                objectFit: "contain",
                filter: "invert(1) brightness(1.1)",
              }}
            />
          <div style={{ opacity: 0.8, fontSize: 16, fontWeight: 900, lineHeight: 1.1, textAlign: "center" }}>
            {dateText}
          </div>
          <div style={{ opacity: 0.8, fontSize: 16, fontWeight: 900, lineHeight: 1.1, textAlign: "center" }}>
            {timeText}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginLeft: 16 }}>
            <NavLink href="/" label="Home" variant="soft" />

            {!loggedIn && <NavLink href="/login" label="Login" variant="soft" />}

            {loggedIn && (
              <>
                {role === "parent" ? (
                  <>
                    <NavLink href="/parent" label="Parent Portal" variant="primary" />
                    <NavLink href="/dashboard" label="Dashboard" variant="soft" />
                    <NavLink href="/home-quest" label="Home Quest" variant="soft" />
                    <NavLink href="/parent/announcements" label="Announcements" variant="soft" />
                    <NavLink href="/parent/rewards" label="Rewards & Discounts" variant="soft" />
                    <a href="/parent/messages" style={link("soft")}>
                      <span style={skewReset()}>Messages</span>
                      {parentUnread ? <span style={notifyDot()} /> : null}
                    </a>
                  </>
                ) : (
                  <>
                    {(role === "student" || role === "admin" || role === "coach") && (
                      <NavLink href="/dashboard" label="Dashboard" variant="primary" />
                    )}
                    {role === "student" ? (
                  <>
                    <NavLink href="/home-quest" label="Home Quest" variant="soft" />
                    <NavLink href="/my-metrics" label="My Metrics" variant="soft" />
                    <NavLink href="/skills" label="Skill Tree" variant="soft" />
                    <NavLink href="/rewards" label="Rewards" variant="soft" />
                  </>
                    ) : role === "skill_pulse" ? (
                  <NavLink href="/skill-tracker" label="Skill Pulse" variant="primary" />
                    ) : role === "display" ? (
                  <NavLink href="/classroom/roster" label="Display" variant="primary" />
                    ) : role === "classroom" ? (
                  <>
                    <NavLink href="/checkin" label="Check-in" variant="primary" />
                    <NavLink href="/classroom" label="Classroom" variant="soft" />
                  </>
                    ) : (
                  <>
                    <div
                      style={menuWrap()}
                      onMouseEnter={() => openMenuSafe("classes")}
                      onMouseLeave={scheduleClose}
                      onClick={() => setOpenMenu((prev) => (prev === "classes" ? null : "classes"))}
                    >
                      <button type="button" style={menuBtn(openMenu === "classes")}>
                        <span style={skewReset()}>Classes</span>
                      </button>
                      {openMenu === "classes" ? (
                        <div style={menu()} onMouseEnter={() => openMenuSafe("classes")} onMouseLeave={scheduleClose}>
                          <NavLink href="/checkin" label="Check-in" variant="menu" />
                          <NavLink href="/classroom" label="Classroom" variant="menu" />
                          {role === "admin" ? <NavLink href="/admin/schedule" label="Schedule Builder" variant="menu" /> : null}
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={menuWrap()}
                      onMouseEnter={() => openMenuSafe("performance")}
                      onMouseLeave={scheduleClose}
                      onClick={() => setOpenMenu((prev) => (prev === "performance" ? null : "performance"))}
                    >
                      <button type="button" style={menuBtn(openMenu === "performance")}>
                        <span style={skewReset()}>Performance</span>
                      </button>
                      {openMenu === "performance" ? (
                        <div style={menu()} onMouseEnter={() => openMenuSafe("performance")} onMouseLeave={scheduleClose}>
                          {(role === "admin" || role === "classroom" || role === "coach") && (
                            <NavLink href="/performance-lab" label="Performance Lab" variant="menu" />
                          )}
                          {(role === "admin" || role === "coach") && (
                            <NavLink href="/performance-lab" label="Performance Leaderboards" variant="menu" />
                          )}
                          {(role === "admin" || role === "coach") && (
                            <NavLink href="/taolu-tracker" label="Taolu Tracker" variant="menu" />
                          )}
                          {(role === "admin" || role === "coach") && (
                            <NavLink href="/preps-tracker" label="P.R.E.P.S Tracker" variant="menu" />
                          )}
                          <NavLink href="/skills" label="Skill Tree" variant="menu" />
                          <NavLink href="/skill-tracker" label="Skill Pulse" variant="menu" />
                        </div>
                      ) : null}
                    </div>
                    {role === "admin" || role === "coach" ? (
                      <div
                        style={menuWrap()}
                        onMouseEnter={() => openMenuSafe("tools")}
                        onMouseLeave={scheduleClose}
                        onClick={() => setOpenMenu((prev) => (prev === "tools" ? null : "tools"))}
                      >
                        <button type="button" style={menuBtn(openMenu === "tools")}>
                          <span style={skewReset()}>Tools</span>
                        </button>
                        {openMenu === "tools" ? (
                          <div style={menu()} onMouseEnter={() => openMenuSafe("tools")} onMouseLeave={scheduleClose}>
                            <NavLink href="/coach" label="Coach Dashboard" variant="menu" />
                            <NavLink href="/coach/display" label="Coach Display" variant="menu" />
                            <NavLink href="/tools/timers" label="Timers" variant="menu" />
                            <NavLink href="/tools/lesson-forge" label="LessonForge" variant="menu" />
                            <NavLink href="/tools" label="Tools Hub" variant="menu" />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <NavLink href="/rewards" label="Rewards" variant="soft" />
                    {role === "admin" || ["admin", "coach", "camp", "display"].includes(role) ? (
                      <div
                        style={menuWrap()}
                        onMouseEnter={() => openMenuSafe("more")}
                        onMouseLeave={scheduleClose}
                        onClick={() => setOpenMenu((prev) => (prev === "more" ? null : "more"))}
                      >
                        <button type="button" style={moreBtn(openMenu === "more")}>
                          <span style={skewReset()}>More</span>
                          <span style={moreChevron()} aria-hidden="true">▾</span>
                        </button>
                        {openMenu === "more" ? (
                          <div style={menu()} onMouseEnter={() => openMenuSafe("more")} onMouseLeave={scheduleClose}>
                            {role === "admin" ? (
                              <>
                                <NavLink href="/admin/passes" label="Pass Management" variant="menu" />
                                <NavLink href="/admin/passes-assign" label="Pass Assignment" variant="menu" />
                                <NavLink href="/admin/passes-accounting" label="Pass Accounting" variant="menu" />
                                <NavLink href="/register/passes" label="Registration" variant="menu" />
                              </>
                            ) : null}
                            {["admin", "coach", "camp", "display"].includes(role) ? (
                              <>
                                <NavLink href="/camp/menu" label="Menu Display" variant="menu" />
                                <NavLink href="/camp/register" label="Points POS" variant="menu" />
                                <NavLink href="/camp/menu-editor" label="Menu Editor" variant="menu" />
                                <NavLink href="/camp" label="Camp Hub" variant="menu" />
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {loggedIn && role === "admin" ? (
          <div style={adminFlagRow()}>
            <a href="/admin/custom/access" style={adminFlag("ribbon")}>
              <span>ACCESS</span>
            </a>
            <a href="/admin/announcements" style={adminFlag("announce")}>
              <span>ANNOUNCE</span>
            </a>
            <a href="/award" style={adminFlag("award")}>
              <span>AWARD</span>
            </a>
            <div ref={createRef} style={createWrap()}>
              <button type="button" onClick={() => setCreateOpen((prev) => !prev)} style={adminFlag("builder")}>
                <span>CREATE</span>
              </button>
              {createOpen ? (
                <div style={createMenu()}>
                  <a href="/admin/custom/create" style={createCard()}>
                    <div style={{ fontWeight: 900 }}>Email & Flyer Builder</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Create promo emails, flyers, and overlays.</div>
                  </a>
                  <a href="/admin/custom/create?tab=avatar-border" style={createCard()}>
                    <div style={{ fontWeight: 900 }}>Avatar Borders Builder</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Design square avatar borders with code or images.</div>
                  </a>
                  <a href="/admin/custom/create?tab=avatar-effect" style={createCard()}>
                    <div style={{ fontWeight: 900 }}>Avatar Background Builder</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Build particle or code-based avatar backgrounds.</div>
                  </a>
                  <div style={createCard()}>
                    <div style={{ fontWeight: 900 }}>Create Placeholder</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Reserved for future creator.</div>
                  </div>
                  <div style={createCard()}>
                    <div style={{ fontWeight: 900 }}>Create Placeholder</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Reserved for future creator.</div>
                  </div>
                  <div style={createCard()}>
                    <div style={{ fontWeight: 900 }}>Create Placeholder</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>Reserved for future creator.</div>
                  </div>
                </div>
              ) : null}
            </div>
            <a href="/admin/parent-messages" style={adminFlag("messages")}>
              <span>MESSAGES</span>
              {adminParentMsgCount > 0 ? <span style={adminFlagBadge()}>{adminParentMsgCount}</span> : null}
            </a>
            <a href="/admin/parent-pairing" style={adminFlag("pairing")}>
              <span>PAIRING</span>
              {adminParentRequestCount > 0 ? <span style={adminFlagBadge()}>{adminParentRequestCount}</span> : null}
            </a>
            <a href="/admin/rewards" style={adminFlag("rewards")}>
              <span>REWARDS</span>
              {adminRewardCount > 0 ? <span style={adminFlagBadge()}>{adminRewardCount}</span> : null}
            </a>
            <a href="/admin/roster?tab=students" style={adminFlag("roster")}>
              <span>ROSTER</span>
            </a>
            <button type="button" onClick={() => setGroupPointsOpen(true)} style={adminFlag("squad")}>
              <span>SQUAD</span>
            </button>
            <div
              style={adminHoverWrap()}
              onMouseEnter={() => {
                if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
                setAdminTodoHoverOpen(true);
              }}
              onMouseLeave={() => {
                if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
                hoverCloseTimer.current = setTimeout(() => setAdminTodoHoverOpen(false), 320);
              }}
            >
              <a href="/admin" style={adminFlag("admin")}>
                <span>ADMIN</span>
              {todoCount > 0 ? <span style={adminFlagBadge()}>{todoCount}</span> : null}
              </a>
              {adminTodoHoverOpen ? (
                <div
                  style={adminHoverPanel()}
                  onMouseEnter={() => {
                    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
                  }}
                  onMouseLeave={() => {
                    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
                    hoverCloseTimer.current = setTimeout(() => setAdminTodoHoverOpen(false), 320);
                  }}
                >
                  <div style={adminHoverHeader()}>
                    <div style={{ fontWeight: 900 }}>Coach Notes & Alerts</div>
                    <a href="/admin/custom/notes" style={adminHoverLink()}>
                      Open notes →
                    </a>
                  </div>
                  <div style={adminHoverForm()}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <select value={hoverNoteCategory} onChange={(e) => setHoverNoteCategory(e.target.value)} style={adminHoverSelect()}>
                        <option value="note">Note</option>
                        <option value="todo">To-Do</option>
                      </select>
                      <select value={hoverNoteUrgency} onChange={(e) => setHoverNoteUrgency(e.target.value)} style={adminHoverSelect()}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <input
                      value={hoverStudentQuery}
                      onChange={(e) => setHoverStudentQuery(e.target.value)}
                      placeholder="Student name"
                      style={adminHoverInput()}
                    />
                    {hoverStudentResults.length ? (
                      <div style={adminHoverChipRow()}>
                        {hoverStudentResults.slice(0, 5).map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            style={adminHoverChip()}
                            onClick={() => {
                              setHoverStudent(row);
                              setHoverStudentQuery(row.name);
                              setHoverStudentResults([]);
                            }}
                          >
                            {row.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {hoverStudent ? (
                      <div style={{ fontSize: 10, opacity: 0.7 }}>Selected: {hoverStudent.name}</div>
                    ) : null}
                    <textarea
                      value={hoverNoteBody}
                      onChange={(e) => setHoverNoteBody(e.target.value)}
                      placeholder="Note or to-do..."
                      rows={2}
                      style={adminHoverTextarea()}
                    />
                    <button
                      type="button"
                      style={adminHoverSaveBtn()}
                      disabled={hoverNoteSaving}
                      onClick={async () => {
                        if (!hoverStudent?.id || !hoverNoteBody.trim()) {
                          setAdminTodoHoverMsg("Student + note required.");
                          return;
                        }
                        setHoverNoteSaving(true);
                        setAdminTodoHoverMsg("");
                        try {
                          const res = await fetch("/api/student-notes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              student_id: hoverStudent.id,
                              body: hoverNoteBody.trim(),
                              category: hoverNoteCategory,
                              urgency: hoverNoteUrgency,
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setAdminTodoHoverMsg(data?.error || "Failed to save note");
                          } else {
                            setHoverNoteBody("");
                            setHoverStudent(null);
                            setHoverStudentQuery("");
                            setHoverStudentResults([]);
                            setAdminTodoHoverItems((prev) => [
                              {
                                id: data?.note?.id ?? `${Date.now()}`,
                                body: data?.note?.body ?? hoverNoteBody.trim(),
                                urgency: data?.note?.urgency ?? hoverNoteUrgency,
                                student_name: hoverStudent?.name ?? "Student",
                                category: data?.note?.category ?? hoverNoteCategory,
                                created_at: data?.note?.created_at ?? new Date().toISOString(),
                              },
                              ...prev,
                            ]);
                            if (hoverNoteCategory === "todo") {
                              setTodoCount((prev) => prev + 1);
                            }
                          }
                        } catch {
                          setAdminTodoHoverMsg("Failed to save note");
                        } finally {
                          setHoverNoteSaving(false);
                        }
                      }}
                    >
                      Add note
                    </button>
                  </div>
                  {adminTodoHoverLoading ? (
                    <div style={adminHoverEmpty()}>Loading...</div>
                  ) : adminTodoHoverMsg ? (
                    <div style={adminHoverEmpty()}>{adminTodoHoverMsg}</div>
                  ) : adminTodoHoverItems.length ? (
                    <div style={adminHoverList()}>
                      {adminTodoHoverItems.map((todo) => {
                        const category = String(todo.category ?? "note").toLowerCase();
                        return (
                          <div key={todo.id} style={adminHoverCard()}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <div style={{ fontWeight: 900, fontSize: 12 }}>{todo.student_name || "Student"}</div>
                              {todo.urgency ? <span style={todoUrgency(todo.urgency)}>{todo.urgency.toUpperCase()}</span> : null}
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={noteCategory(category)}>{category.toUpperCase()}</span>
                              <span style={{ fontSize: 11, opacity: 0.85 }}>{todo.body}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <div style={{ fontSize: 10, opacity: 0.6 }}>
                                {todo.created_at ? `Added ${new Date(todo.created_at).toLocaleDateString()}` : ""}
                              </div>
                              <button
                                type="button"
                                style={todoDoneBtn()}
                                disabled={!!adminTodoHoverBusy[todo.id]}
                                onClick={async (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setAdminTodoHoverBusy((prev) => ({ ...prev, [todo.id]: true }));
                                  try {
                                    const res = await fetch("/api/student-notes/status", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: todo.id, status: "done" }),
                                    });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) {
                                      setAdminTodoHoverMsg(data?.error || "Failed to update");
                                    } else {
                                      setAdminTodoHoverItems((prev) => prev.filter((row) => row.id !== todo.id));
                                      if (category === "todo") {
                                        setTodoCount((prev) => Math.max(0, prev - 1));
                                      }
                                    }
                                  } catch {
                                    setAdminTodoHoverMsg("Failed to update");
                                  } finally {
                                    setAdminTodoHoverBusy((prev) => ({ ...prev, [todo.id]: false }));
                                  }
                                }}
                              >
                                {category === "todo" ? "Mark done" : "Hide"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={adminHoverEmpty()}>No open coach notes.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : loggedIn && role ? (
          <div style={roleFlag(role)}>
            <span style={skewReset()}>{roleLabel(role, studentName)}</span>
          </div>
        ) : null}
      </div>

        {loggedIn && (
          <div style={accountBox()}>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 900, letterSpacing: 0.6 }}>
              ACCOUNT
            </div>
            <div style={{ fontWeight: 950, fontSize: 12 }}>{accountName || "User"}</div>
            <div style={{ fontWeight: 900, fontSize: 12 }}>{me.user.email}</div>
            <a href="/logout" style={miniLink()}>
              Log out
            </a>
          </div>
        )}
      </div>
      <GroupPointsOverlay
        open={groupPointsOpen}
        onClose={() => setGroupPointsOpen(false)}
        students={groupStudents}
        title="Squad Points"
        loading={groupLoading}
        contextLabel={groupMsg ? groupMsg : "Select names, choose points, then enter admin PIN."}
      />
    </div>
  );
}

function NavLink({ href, label, variant = "soft" }: { href: string; label: string; variant?: "soft" | "primary" | "menu" }) {
  return (
    <a href={href} style={link(variant)} className={variant === "primary" ? "navSkew" : undefined}>
      <span style={variant === "menu" ? undefined : skewReset()}>{label}</span>
    </a>
  );
}

function bar(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 9997,
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 18px",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(10,18,34,0.98), rgba(2,6,23,0.98)), radial-gradient(circle at top right, rgba(56,189,248,0.25), transparent 55%)",
    border: "1px solid rgba(56,189,248,0.28)",
    backdropFilter: "blur(12px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 60px rgba(0,0,0,0.5)",
    minHeight: 72,
  };
}

function adminFlagRow(): React.CSSProperties {
  return {
    position: "absolute",
    right: 20,
    bottom: -16,
    display: "flex",
    gap: 8,
    alignItems: "center",
  };
}

function adminFlag(
  kind: "admin" | "messages" | "pairing" | "rewards" | "squad" | "announce" | "builder" | "roster" | "ribbon" | "award",
): React.CSSProperties {
  const palette: Record<string, { border: string; background: string; shadow: string }> = {
    ribbon: {
      border: "1px solid rgba(236,72,153,0.55)",
      background: "linear-gradient(135deg, rgba(236,72,153,0.35), rgba(190,24,93,0.35))",
      shadow: "0 10px 24px rgba(236,72,153,0.25)",
    },
    roster: {
      border: "1px solid rgba(59,130,246,0.55)",
      background: "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(37,99,235,0.35))",
      shadow: "0 10px 24px rgba(59,130,246,0.25)",
    },
    squad: {
      border: "1px solid rgba(34,197,94,0.55)",
      background: "linear-gradient(135deg, rgba(34,197,94,0.35), rgba(16,185,129,0.35))",
      shadow: "0 10px 24px rgba(34,197,94,0.25)",
    },
    announce: {
      border: "1px solid rgba(14,165,233,0.6)",
      background: "linear-gradient(135deg, rgba(14,165,233,0.4), rgba(2,132,199,0.4))",
      shadow: "0 10px 24px rgba(14,165,233,0.3)",
    },
    builder: {
      border: "1px solid rgba(168,85,247,0.55)",
      background: "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(147,51,234,0.35))",
      shadow: "0 10px 24px rgba(168,85,247,0.25)",
    },
    admin: {
      border: "1px solid rgba(59,130,246,0.55)",
      background: "linear-gradient(135deg, rgba(59,130,246,0.5), rgba(30,64,175,0.5))",
      shadow: "0 10px 24px rgba(59,130,246,0.3)",
    },
    messages: {
      border: "1px solid rgba(34,197,94,0.55)",
      background: "linear-gradient(135deg, rgba(34,197,94,0.35), rgba(16,185,129,0.35))",
      shadow: "0 10px 24px rgba(34,197,94,0.25)",
    },
    pairing: {
      border: "1px solid rgba(250,204,21,0.55)",
      background: "linear-gradient(135deg, rgba(250,204,21,0.35), rgba(245,158,11,0.35))",
      shadow: "0 10px 24px rgba(250,204,21,0.25)",
    },
    rewards: {
      border: "1px solid rgba(236,72,153,0.55)",
      background: "linear-gradient(135deg, rgba(236,72,153,0.35), rgba(244,63,94,0.35))",
      shadow: "0 10px 24px rgba(236,72,153,0.25)",
    },
    award: {
      border: "1px solid rgba(34,197,94,0.55)",
      background: "linear-gradient(135deg, rgba(34,197,94,0.35), rgba(16,185,129,0.35))",
      shadow: "0 10px 24px rgba(34,197,94,0.25)",
    },
  };
  const style = palette[kind] ?? palette.admin;
  return {
    padding: "8px 12px",
    borderRadius: "0 0 12px 12px",
    border: style.border,
    background: style.background,
    color: "white",
    fontWeight: 950,
    fontSize: 11,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxShadow: style.shadow,
    letterSpacing: 0.6,
  };
}

function adminFlagBadge(): React.CSSProperties {
  return {
    minWidth: 18,
    height: 18,
    padding: "0 6px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(255,255,255,0.45)",
    color: "white",
    fontSize: 10,
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
  };
}

function adminHoverWrap(): React.CSSProperties {
  return {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  };
}

function adminHoverPanel(): React.CSSProperties {
  return {
    position: "absolute",
    right: 0,
    top: 42,
    width: 320,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(8,10,18,0.97)",
    boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
    zIndex: 30,
    display: "grid",
    gap: 10,
  };
}

function adminHoverHeader(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  };
}

function adminHoverLink(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    color: "white",
    textDecoration: "none",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
  };
}

function adminHoverList(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    maxHeight: 260,
    overflowY: "auto",
    paddingRight: 4,
  };
}

function adminHoverForm(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  };
}

function adminHoverInput(): React.CSSProperties {
  return {
    padding: "6px 8px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
  };
}

function adminHoverTextarea(): React.CSSProperties {
  return {
    ...adminHoverInput(),
    minHeight: 54,
    resize: "vertical",
  };
}

function adminHoverSelect(): React.CSSProperties {
  return {
    ...adminHoverInput(),
    cursor: "pointer",
  };
}

function adminHoverChipRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  };
}

function adminHoverChip(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.1)",
    color: "white",
    fontWeight: 900,
    fontSize: 10,
    cursor: "pointer",
  };
}

function adminHoverSaveBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.45)",
    background: "rgba(56,189,248,0.2)",
    color: "white",
    fontWeight: 900,
    fontSize: 10,
    cursor: "pointer",
  };
}

function adminHoverCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 6,
  };
}

function adminHoverEmpty(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
  };
}

function todoUrgency(level: string): React.CSSProperties {
  const norm = String(level || "").toLowerCase();
  const palette: Record<string, string> = {
    low: "rgba(148,163,184,0.35)",
    normal: "rgba(59,130,246,0.35)",
    high: "rgba(249,115,22,0.4)",
    urgent: "rgba(239,68,68,0.45)",
  };
  return {
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: palette[norm] ?? "rgba(148,163,184,0.3)",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.4,
  };
}

function noteCategory(kind: string): React.CSSProperties {
  const isTodo = kind === "todo";
  return {
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: isTodo ? "rgba(59,130,246,0.35)" : "rgba(148,163,184,0.3)",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.4,
  };
}

function todoDoneBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.22)",
    color: "white",
    fontWeight: 900,
    fontSize: 10,
    padding: "4px 8px",
    borderRadius: 999,
    cursor: "pointer",
  };
}

function createWrap(): React.CSSProperties {
  return {
    position: "relative",
  };
}

function createMenu(): React.CSSProperties {
  return {
    position: "absolute",
    top: 46,
    right: 0,
    width: 280,
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(8,10,18,0.95)",
    boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
    zIndex: 20,
  };
}

function createCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    textDecoration: "none",
    display: "grid",
    gap: 4,
  };
}

function roleFlag(role: string): React.CSSProperties {
  const lower = role.toLowerCase();
  const styles: Record<string, { border: string; background: string; shadow: string }> = {
    admin: {
      border: "1px solid rgba(59,130,246,0.55)",
      background: "linear-gradient(135deg, rgba(59,130,246,0.45), rgba(30,64,175,0.45))",
      shadow: "0 10px 24px rgba(59,130,246,0.3)",
    },
    parent: {
      border: "1px solid rgba(34,197,94,0.5)",
      background: "linear-gradient(135deg, rgba(34,197,94,0.35), rgba(16,185,129,0.35))",
      shadow: "0 10px 24px rgba(34,197,94,0.25)",
    },
    student: {
      border: "1px solid rgba(59,130,246,0.35)",
      background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(30,64,175,0.25))",
      shadow: "0 10px 24px rgba(59,130,246,0.2)",
    },
    coach: {
      border: "1px solid rgba(148,163,184,0.4)",
      background: "linear-gradient(135deg, rgba(148,163,184,0.2), rgba(71,85,105,0.2))",
      shadow: "0 10px 24px rgba(15,23,42,0.35)",
    },
    classroom: {
      border: "1px solid rgba(250,204,21,0.45)",
      background: "linear-gradient(135deg, rgba(250,204,21,0.25), rgba(245,158,11,0.25))",
      shadow: "0 10px 24px rgba(250,204,21,0.18)",
    },
    display: {
      border: "1px solid rgba(14,165,233,0.45)",
      background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(59,130,246,0.25))",
      shadow: "0 10px 24px rgba(14,165,233,0.2)",
    },
    skill_pulse: {
      border: "1px solid rgba(236,72,153,0.45)",
      background: "linear-gradient(135deg, rgba(236,72,153,0.25), rgba(244,63,94,0.25))",
      shadow: "0 10px 24px rgba(236,72,153,0.2)",
    },
  };

  const style = styles[lower] ?? styles.coach;
  return {
    position: "absolute",
    right: 28,
    bottom: -16,
    padding: "8px 14px",
    borderRadius: "0 0 12px 12px",
    border: style.border,
    background: style.background,
    color: "white",
    fontWeight: 950,
    fontSize: 12,
    textDecoration: "none",
    transform: "skewX(-10deg)",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxShadow: style.shadow,
  };
}

function roleLabel(role: string, studentName: string) {
  const lower = role.toLowerCase();
  if (lower === "student") return studentName ? `STUDENT: ${studentName}` : "STUDENT";
  if (lower === "parent") return "PARENT";
  if (lower === "admin") return "ADMIN";
  if (lower === "coach") return "COACH";
  if (lower === "classroom") return "CLASSROOM";
  if (lower === "display") return "DISPLAY";
  if (lower === "skill_pulse") return "SKILL PULSE";
  return role.toUpperCase();
}

function displayMenuWrap(): React.CSSProperties {
  return {
    position: "fixed",
    top: 16,
    left: 16,
    zIndex: 9999,
    display: "grid",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(10px)",
  };
}


function displayMenuToggle(open: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: open ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.1)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  };
}

function displayMenuTitle(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.4,
    opacity: 0.85,
  };
}

function displayMenu(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    minWidth: 160,
  };
}

function displayLink(): React.CSSProperties {
  return {
    textDecoration: "none",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function displayMuted(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: 800,
  };
}

function notifyDot(): React.CSSProperties {
  return {
    marginLeft: 8,
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(248,113,113,0.95)",
    display: "inline-block",
  };
}

function link(variant: "soft" | "primary" | "menu"): React.CSSProperties {
  if (variant === "menu") {
    return {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(56,189,248,0.35)",
      background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(14,165,233,0.12))",
      textDecoration: "none",
      color: "white",
      fontWeight: 900,
      fontSize: 13,
      display: "block",
    };
  }
  if (variant === "primary") {
    return {
      padding: "14px 22px",
      borderRadius: 16,
      border: "1px solid rgba(56,189,248,0.65)",
      background: "linear-gradient(135deg, rgba(56,189,248,0.65), rgba(59,130,246,0.45))",
      textDecoration: "none",
      color: "white",
      fontWeight: 950,
      fontSize: 14,
      minHeight: 54,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transform: "skewX(-10deg)",
      boxShadow: "0 16px 32px rgba(56,189,248,0.2), inset 0 0 18px rgba(255,255,255,0.08)",
      transition: "background 160ms ease, box-shadow 160ms ease",
    };
  }
  return {
    padding: "13px 18px",
    borderRadius: 16,
    border: "1px solid rgba(56,189,248,0.35)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(15,23,42,0.6))",
    textDecoration: "none",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    minHeight: 54,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "skewX(-10deg)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  };
}

function menuWrap(): React.CSSProperties {
  return {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  };
}

function menuBtn(active: boolean): React.CSSProperties {
  return {
    padding: "14px 18px",
    borderRadius: 16,
    border: active ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(56,189,248,0.3)",
    background: active
      ? "linear-gradient(135deg, rgba(56,189,248,0.45), rgba(59,130,246,0.3))"
      : "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(15,23,42,0.6))",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    minHeight: 54,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "skewX(-10deg)",
    boxShadow: active ? "0 16px 30px rgba(56,189,248,0.2)" : "0 8px 20px rgba(0,0,0,0.25)",
  };
}

function menuBtnMini(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 14,
    border: active ? "1px solid rgba(56,189,248,0.55)" : "1px solid rgba(56,189,248,0.28)",
    background: active
      ? "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(14,165,233,0.2))"
      : "linear-gradient(135deg, rgba(56,189,248,0.1), rgba(15,23,42,0.6))",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "skewX(-10deg)",
    boxShadow: active ? "0 12px 24px rgba(56,189,248,0.18)" : "0 6px 16px rgba(0,0,0,0.25)",
  };
}

function moreBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(56,189,248,0.45)" : "1px dashed rgba(255,255,255,0.25)",
    background: active ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
    minHeight: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "skewX(-10deg)",
    gap: 6,
    letterSpacing: 0.6,
  };
}

function moreChevron(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
    transform: "skewX(10deg)",
  };
}

function menu(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    minWidth: 190,
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(155deg, rgba(15,23,42,0.95), rgba(2,6,23,0.92))",
    boxShadow: "0 20px 45px rgba(0,0,0,0.45)",
    zIndex: 10,
  };
}

function skewReset(): React.CSSProperties {
  return {
    display: "inline-block",
    transform: "skewX(10deg)",
  };
}

function accountBox(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.2)",
    background: "rgba(8,15,25,0.6)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.25)",
    minWidth: 140,
    textAlign: "right",
  };
}

function miniLink(): React.CSSProperties {
  return {
    fontSize: 11,
    textDecoration: "none",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 900,
    alignSelf: "flex-end",
  };
}
