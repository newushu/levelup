"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MenuItem = {
  id: string;
  name: string;
  price_points: number;
  allow_second: boolean;
  second_price_points?: number | null;
  image_url?: string | null;
  image_text?: string | null;
  use_text?: boolean | null;
  image_x?: number | null;
  image_y?: number | null;
  image_zoom?: number | null;
  enabled: boolean;
  visible_on_menu?: boolean | null;
  visible_on_pos?: boolean | null;
  sold_out?: boolean | null;
};

type Menu = { id: string; name: string; enabled: boolean; items: MenuItem[] };

const CAMP_MENU_SYNC_CHANNEL = "camp-menu-sync";

export default function CampMenuDisplayPage() {
  const [role, setRole] = useState("student");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [menuCount, setMenuCount] = useState(2);
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);

  async function loadMenus() {
    const res = await fetch("/api/camp/menus?items=1", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setMenus((data.menus ?? []) as Menu[]);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setRole(String(data?.role ?? "student"));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    loadMenus();
  }, []);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CAMP_MENU_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event?.data?.type === "refresh") {
          loadMenus();
        }
      };
    } catch {}
    const timer = window.setInterval(() => {
      loadMenus();
    }, 15000);
    return () => {
      window.clearInterval(timer);
      try {
        channel?.close();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const enabled = menus.filter((m) => m.enabled !== false);
    setSelectedMenuIds((prev) => {
      const next = prev.filter((id) => enabled.some((m) => m.id === id));
      if (next.length >= menuCount) return next.slice(0, menuCount);
      const remaining = enabled.filter((m) => !next.includes(m.id)).slice(0, menuCount - next.length);
      return [...next, ...remaining.map((m) => m.id)];
    });
  }, [menus, menuCount]);

  const visibleMenus = useMemo(() => {
    const enabled = menus.filter((m) => m.enabled !== false);
    const selected = enabled.filter((m) => selectedMenuIds.includes(m.id));
    return selected.slice(0, Math.max(1, menuCount));
  }, [menus, menuCount, selectedMenuIds]);

  const canView = ["admin", "coach", "camp", "display"].includes(role);
  const canEdit = ["admin"].includes(role);
  const canRegister = ["admin", "camp"].includes(role);

  if (!canView) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Camp display only.</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>Display, camp, coach, or admin accounts can access this page.</div>
      </main>
    );
  }

  return (
    <main style={page()}>
      <div style={header()}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 1000 }}>Camp Menu</div>
          <div style={{ opacity: 0.7 }}>Snack + lunch selections for today.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/camp/register" style={navBtn(!canRegister)}>Points POS</Link>
          <Link href="/camp/menu-editor" style={navBtn(!canEdit)}>Menu Editor</Link>
          <Link href="/spin" style={navBtn(false)}>Prize Wheel</Link>
        </div>
      </div>

      <div style={controls()}>
        <label style={label()}>
          Menus to show
          <input
            type="number"
            value={menuCount}
            onChange={(e) =>
              setMenuCount(Math.min(2, Math.max(1, Number(e.target.value) || 1)))
            }
            style={input()}
          />
        </label>
        <div style={menuPicks()}>
          {menus
            .filter((m) => m.enabled !== false)
            .map((menu) => {
              const active = selectedMenuIds.includes(menu.id);
              const atLimit = !active && selectedMenuIds.length >= menuCount;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() =>
                    setSelectedMenuIds((prev) => {
                      if (active) return prev.filter((id) => id !== menu.id);
                      if (prev.length >= menuCount) return prev;
                      return [...prev, menu.id];
                    })
                  }
                  style={menuPick(active, atLimit)}
                >
                  {menu.name}
                </button>
              );
            })}
        </div>
      </div>

      <div style={menuGrid(menuCount)}>
        {visibleMenus.map((menu) => (
          <section key={menu.id} style={menuCard()}>
            <div style={{ fontWeight: 900, fontSize: 44, textAlign: "center" }}>{menu.name}</div>
            <div style={itemGrid()}>
              {(menu.items ?? [])
                .filter((i) => i.enabled !== false && i.visible_on_menu !== false)
                .map((item) => (
                  <div key={item.id} style={itemCard()}>
                    <div style={itemImage(item)}>
                      {!item.image_url || item.use_text ? (
                        <div style={imageText()}>{item.image_text || item.name}</div>
                      ) : null}
                      {item.sold_out ? <div style={soldOutOverlay()}>SOLD OUT</div> : null}
                      <div style={imageLabel()}>
                        <div style={{ fontWeight: 900, fontSize: 24, lineHeight: 1.2 }}>{item.name}</div>
                        <div style={{ fontSize: 20, opacity: 0.9 }}>{item.price_points} pts</div>
                      </div>
                    </div>
                    {item.allow_second ? (
                      <div style={{ opacity: 0.6, fontSize: 14 }}>
                        2nd: {Number(item.second_price_points ?? item.price_points)} pts
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </section>
        ))}
        {!visibleMenus.length ? <div style={{ opacity: 0.7 }}>No menus yet.</div> : null}
      </div>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    padding: "24px 40px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 20% 10%, rgba(14,116,144,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(248,113,113,0.18), transparent 45%), #070a0f",
    color: "white",
  };
}

function header(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
}

function controls(): React.CSSProperties {
  return { marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function input(): React.CSSProperties {
  return {
    width: 120,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
  };
}

function menuPicks(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap" };
}

function menuPick(active: boolean, atLimit: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.8)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 800,
    opacity: atLimit ? 0.35 : 1,
    cursor: atLimit ? "not-allowed" : "pointer",
  };
}

function menuGrid(count: number): React.CSSProperties {
  return {
    marginTop: 18,
    display: "grid",
    gap: 18,
    gridTemplateColumns: count === 1 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
    alignItems: "start",
  };
}

function menuCard(): React.CSSProperties {
  return {
    minWidth: 0,
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,12,18,0.75)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    overflow: "hidden",
  };
}

function itemGrid(): React.CSSProperties {
  return {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    minWidth: 0,
    width: "100%",
  };
}

function itemCard(): React.CSSProperties {
  return {
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(8,10,15,0.65)",
    display: "grid",
    gap: 6,
    textAlign: "center",
    minHeight: 300,
    overflow: "hidden",
  };
}

function itemImage(item: MenuItem): React.CSSProperties {
  const hasImage = item.image_url && !item.use_text;
  const xRaw = Number(item.image_x);
  const yRaw = Number(item.image_y);
  const zoomRaw = Number(item.image_zoom);
  const x = Number.isFinite(xRaw) && String(item.image_x).trim() !== "" ? xRaw : 50;
  const y = Number.isFinite(yRaw) && String(item.image_y).trim() !== "" ? yRaw : 50;
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 120;
  return {
    minWidth: 0,
    maxWidth: "100%",
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "rgba(15,23,42,0.35)",
    backgroundImage: hasImage
      ? `url("${item.image_url}")`
      : "linear-gradient(135deg, rgba(14,116,144,0.25), rgba(30,41,59,0.35))",
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: hasImage ? `${zoom}%` : "cover",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    position: "relative",
    overflow: "hidden",
  };
}

function imageText(): React.CSSProperties {
  return {
    fontWeight: 800,
    fontSize: 16,
    textAlign: "center",
  };
}

function imageLabel(): React.CSSProperties {
  return {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    display: "grid",
    justifyItems: "end",
    textAlign: "right",
    padding: "8px 12px",
    borderRadius: 12,
    background: "rgba(7,10,15,0.65)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(6px)",
    maxWidth: "calc(100% - 20px)",
    overflow: "hidden",
    whiteSpace: "normal",
    wordBreak: "break-word",
  };
}

function soldOutOverlay(): React.CSSProperties {
  return {
    position: "absolute",
    left: "-24%",
    right: "-24%",
    top: "46%",
    transform: "rotate(-24deg)",
    textAlign: "center",
    background: "rgba(220,38,38,0.9)",
    border: "2px solid rgba(254,226,226,0.92)",
    color: "white",
    fontSize: 30,
    fontWeight: 1000,
    letterSpacing: 3,
    padding: "10px 0",
    boxShadow: "0 12px 30px rgba(127,29,29,0.45)",
    pointerEvents: "none",
  };
}


function navBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
    color: disabled ? "rgba(255,255,255,0.35)" : "white",
    textDecoration: "none",
    fontWeight: 800,
    pointerEvents: disabled ? "none" : "auto",
    opacity: disabled ? 0.5 : 1,
  };
}
