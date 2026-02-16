"use client";

import { useEffect, useMemo, useState } from "react";

type Menu = { id?: string; name: string; enabled: boolean; display_order: number };
type Item = {
  id?: string;
  menu_id: string;
  name: string;
  price_points: string;
  allow_second: boolean;
  second_price_points: string;
  image_url: string;
  image_text: string;
  use_text: boolean;
  image_x: string;
  image_y: string;
  image_zoom: string;
  enabled: boolean;
  visible_on_menu: boolean;
  visible_on_pos: boolean;
  sold_out: boolean;
  display_order: number;
};

type LibraryImage = {
  name: string;
  url: string;
};

const CAMP_MENU_SYNC_CHANNEL = "camp-menu-sync";

function broadcastCampMenuSync(reason: string) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel(CAMP_MENU_SYNC_CHANNEL);
    channel.postMessage({ type: "refresh", reason, at: Date.now() });
    channel.close();
  } catch {}
}

export default function CampMenuEditorPage() {
  const [role, setRole] = useState("student");
  const [pinOk, setPinOk] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [libraryOpenFor, setLibraryOpenFor] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [menusSaved, setMenusSaved] = useState(false);
  const [itemsSaved, setItemsSaved] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string>("");
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setRole(String(data?.role ?? "student"));
      } catch {}
    })();
  }, []);

  const canAccess = ["admin", "coach", "camp"].includes(role);
  const canEdit = role === "admin";

  async function verifyPin() {
    setMsg("");
    if (!pin.trim()) return setMsg("Enter PIN or NFC code.");
    const res = await fetch("/api/camp/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "PIN verification failed");
    setPinOk(true);
    setPin("");
  }

  async function load() {
    const res = await fetch("/api/camp/menus?items=1", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to load menus");
    const list = (data.menus ?? []) as Array<any>;
    setMenus(
      list.map((m, idx) => ({
        id: m.id,
        name: m.name,
        enabled: m.enabled !== false,
        display_order: Number.isFinite(Number(m.display_order)) ? Number(m.display_order) : idx,
      }))
    );
    const allItems: Item[] = [];
    list.forEach((m) => {
      (m.items ?? []).forEach((it: any, iIdx: number) => {
        allItems.push({
          id: it.id,
          menu_id: String(m.id),
          name: it.name ?? "",
          price_points: String(it.price_points ?? ""),
          allow_second: it.allow_second === true,
          second_price_points: String(it.second_price_points ?? ""),
          image_url: String(it.image_url ?? ""),
          image_text: String(it.image_text ?? ""),
          use_text: it.use_text === true,
          image_x: String(it.image_x ?? ""),
          image_y: String(it.image_y ?? ""),
          image_zoom: String(it.image_zoom ?? ""),
          enabled: it.enabled !== false,
          visible_on_menu: it.visible_on_menu !== false,
          visible_on_pos: it.visible_on_pos !== false,
          sold_out: it.sold_out === true,
          display_order: Number.isFinite(Number(it.display_order)) ? Number(it.display_order) : iIdx,
        });
      });
    });
    setItems(allItems);
    if (!activeMenuId && list[0]?.id) setActiveMenuId(list[0].id);
  }

  useEffect(() => {
    if (canAccess && pinOk) load();
  }, [canAccess, pinOk]);

  useEffect(() => {
    if (!canAccess || !pinOk) return;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CAMP_MENU_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event?.data?.type === "refresh") {
          load();
        }
      };
    } catch {}
    return () => {
      try {
        channel?.close();
      } catch {}
    };
  }, [canAccess, pinOk]);

  const itemsForMenu = useMemo(() => items.filter((i) => i.menu_id === activeMenuId), [items, activeMenuId]);
  const activeMenu = useMemo(() => menus.find((m) => String(m.id) === activeMenuId) ?? null, [menus, activeMenuId]);

  async function saveMenus() {
    if (!canEdit) return;
    const res = await fetch("/api/camp/menus/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menus }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to save menus");
    await load();
    broadcastCampMenuSync("menus_saved");
    setMenusSaved(true);
    window.setTimeout(() => setMenusSaved(false), 2000);
  }

  async function deleteMenu(menuId: string) {
    if (!canEdit) return;
    if (!confirm("Delete this menu and all items?")) return;
    const res = await fetch("/api/camp/menus/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: menuId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to delete menu");
    setActiveMenuId("");
    await load();
    broadcastCampMenuSync("menu_deleted");
    setMsg("Menu deleted");
  }

  async function saveItems() {
    if (!canEdit || !activeMenuId) return;
    const res = await fetch("/api/camp/items/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: itemsForMenu }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to save items");
    await load();
    broadcastCampMenuSync("items_saved");
    setMsg("Items saved");
    setItemsSaved(true);
    window.setTimeout(() => setItemsSaved(false), 2000);
  }

  async function uploadItemImage(itemId: string, file: File) {
    if (!canEdit) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/camp/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Image upload failed");
    const url = data.public_url ? `${data.public_url}?v=${Date.now()}` : "";
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, image_url: url || it.image_url, use_text: false } : it))
    );
  }

  async function openLibrary(itemId: string) {
    if (!canEdit) return;
    if (libraryOpenFor === itemId) {
      setLibraryOpenFor(null);
      return;
    }
    setLibraryOpenFor(itemId);
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/camp/images/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLibraryImages((data.images ?? []) as LibraryImage[]);
    } finally {
      setLibraryLoading(false);
    }
  }

  if (!canAccess) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Camp access only.</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>Camp, coach, or admin accounts can access this page.</div>
      </main>
    );
  }

  if (!pinOk) {
    return (
      <main style={{ padding: 18, maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Camp Menu Editor</div>
        <div style={{ marginTop: 12 }}>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") verifyPin();
            }}
            placeholder="Enter PIN or scan NFC"
            style={pinInput()}
          />
          {msg ? <div style={{ color: "crimson", marginTop: 6 }}>{msg}</div> : null}
          <button onClick={verifyPin} style={btnPrimary()}>Unlock</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Camp Menu Editor</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/camp/menu" style={btnGhost()}>Menu Display</a>
          <a href="/camp/register" style={btnGhost()}>Points POS</a>
          <a href="/spin" style={btnGhost()}>Prize Wheel</a>
        </div>
      </div>
      {msg ? <div style={{ color: "crimson", marginTop: 6 }}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Menu Sets</div>
        <div style={menuGrid()}>
          {canEdit ? (
            <button
              onClick={() => {
                const tempId = `tmp-${Date.now()}`;
                setMenus((prev) => [...prev, { id: tempId, name: "New Menu", enabled: true, display_order: prev.length }]);
                setActiveMenuId(tempId);
              }}
              style={addCard()}
            >
              + Add menu
            </button>
          ) : null}
          {menus.map((menu, idx) => (
            <button
              key={menu.id ?? `menu-${idx}`}
              onClick={() => menu.id && setActiveMenuId(String(menu.id))}
              style={menuCard(menu.id === activeMenuId)}
            >
              <div style={{ fontWeight: 900 }}>{menu.name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{menu.enabled ? "Enabled" : "Hidden"}</div>
            </button>
          ))}
        </div>
        {activeMenu ? (
          <div style={detailCard()}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Menu Details</div>
            <div style={row()}>
              <label style={fieldLabel()}>
                Menu name
                <input
                  value={activeMenu.name}
                  onChange={(e) =>
                    setMenus((prev) => prev.map((m) => (String(m.id) === activeMenuId ? { ...m, name: e.target.value } : m)))
                  }
                  placeholder="Menu name"
                  style={input()}
                  disabled={!canEdit}
                />
              </label>
              <label style={toggle()}>
                <input
                  type="checkbox"
                  checked={activeMenu.enabled}
                  onChange={(e) =>
                    setMenus((prev) => prev.map((m) => (String(m.id) === activeMenuId ? { ...m, enabled: e.target.checked } : m)))
                  }
                  disabled={!canEdit}
                />
                Enabled (show this menu on display)
              </label>
            </div>
            {canEdit ? (
              <button onClick={() => activeMenu.id && deleteMenu(String(activeMenu.id))} style={btnDanger()}>
                Delete menu
              </button>
            ) : null}
          </div>
        ) : null}
        <button onClick={saveMenus} style={menusSaved ? btnSaved() : btnPrimary()} disabled={!canEdit}>
          {menusSaved ? "Saved" : "Save menus"}
        </button>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Menu Items</div>
        {!activeMenuId ? <div style={{ opacity: 0.7 }}>Select a menu to edit items.</div> : null}
        <div style={itemGrid()}>
          {canEdit && activeMenuId && isUuid(activeMenuId) ? (
            <button
              onClick={() => {
                const tempId = `tmp-${Date.now()}`;
                setItems((prev) => [
                  ...prev,
                  {
                    id: tempId,
                    menu_id: activeMenuId,
                    name: "New Item",
                    price_points: "",
                    allow_second: false,
                    second_price_points: "",
                    image_url: "",
                    image_text: "",
                    use_text: false,
                    image_x: "",
                    image_y: "",
                    image_zoom: "",
                    enabled: true,
                    visible_on_menu: true,
                    visible_on_pos: true,
                    sold_out: false,
                    display_order: itemsForMenu.length,
                  },
                ]);
              }}
              style={addCard()}
            >
              + Add menu item
            </button>
          ) : null}
          {itemsForMenu.map((item, idx) => (
            <div key={item.id ?? `item-${idx}`} style={itemCard()}>
              <label style={fieldLabel()}>
                Item name
                <input
                  value={item.name}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, name: e.target.value } : it)))
                  }
                  placeholder="Item name"
                  style={primaryInput()}
                  disabled={!canEdit}
                />
              </label>
              <label style={fieldLabel()}>
                Price (points)
                <input
                  value={item.price_points}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, price_points: e.target.value } : it)))
                  }
                  placeholder="Price (points)"
                  style={secondaryInput()}
                  disabled={!canEdit}
                />
              </label>
              <div style={imageFrame(item)}>
                {!item.image_url || item.use_text ? <div style={imageText()}>{item.image_text || item.name}</div> : null}
              </div>
              <label style={fieldLabel()}>
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && item.id) uploadItemImage(item.id, file);
                    e.currentTarget.value = "";
                  }}
                  style={input()}
                  disabled={!canEdit}
                />
              </label>
              <div style={row()}>
                <button
                  type="button"
                  onClick={() => openLibrary(item.id ?? "")}
                  style={btnGhost()}
                  disabled={!canEdit || !item.id}
                >
                  {libraryOpenFor === item.id ? "Hide Library" : "Choose from Library"}
                </button>
                {libraryLoading && libraryOpenFor === item.id ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Loading...</div>
                ) : null}
              </div>
              {libraryOpenFor === item.id ? (
                <div style={libraryGrid()}>
                  {libraryImages.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() =>
                        setItems((prev) =>
                          prev.map((it) =>
                            it.id === item.id ? { ...it, image_url: img.url, use_text: false } : it
                          )
                        )
                      }
                      style={libraryThumb()}
                    >
                      <img src={img.url} alt={img.name} style={libraryThumbImage()} />
                    </button>
                  ))}
                  {!libraryImages.length && !libraryLoading ? (
                    <div style={{ opacity: 0.7, fontSize: 12 }}>No images in bucket.</div>
                  ) : null}
                </div>
              ) : null}
              <label style={fieldLabel()}>
                Image URL
                <input
                  value={item.image_url}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, image_url: e.target.value } : it)))
                  }
                  placeholder="https://..."
                  style={input()}
                  disabled={!canEdit}
                />
              </label>
              <div style={row()}>
                <label style={fieldLabel()}>
                  X position (%)
                  <input
                    type="number"
                    value={item.image_x}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, image_x: e.target.value } : it)))
                    }
                    placeholder="50"
                    style={input()}
                    disabled={!canEdit}
                  />
                </label>
                <label style={fieldLabel()}>
                  Y position (%)
                  <input
                    type="number"
                    value={item.image_y}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, image_y: e.target.value } : it)))
                    }
                    placeholder="50"
                    style={input()}
                    disabled={!canEdit}
                  />
                </label>
                <label style={fieldLabel()}>
                  Zoom (%)
                  <input
                    type="number"
                    value={item.image_zoom}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, image_zoom: e.target.value } : it)))
                    }
                    placeholder="100"
                    style={input()}
                    disabled={!canEdit}
                  />
                </label>
              </div>
              <label style={fieldLabel()}>
                Image text (fallback)
                <input
                  value={item.image_text}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, image_text: e.target.value } : it)))
                  }
                  placeholder="Default to item name"
                  style={input()}
                  disabled={!canEdit}
                />
              </label>
              <label style={toggle()}>
                <input
                  type="checkbox"
                  checked={item.use_text}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, use_text: e.target.checked } : it)))
                  }
                  disabled={!canEdit}
                />
                Use text instead of image
              </label>
              <label style={toggle()}>
                <input
                  type="checkbox"
                  checked={item.allow_second}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, allow_second: e.target.checked } : it)))
                  }
                  disabled={!canEdit}
                />
                Allow second serving
              </label>
              <label style={fieldLabel()}>
                Second price (points)
                <input
                  value={item.second_price_points}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it) => (it.id === item.id ? { ...it, second_price_points: e.target.value } : it))
                    )
                  }
                  placeholder="Second price (points)"
                  style={input()}
                  disabled={!canEdit || !item.allow_second}
                />
              </label>
              <label style={toggle()}>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, enabled: e.target.checked } : it)))
                  }
                  disabled={!canEdit}
                />
                Enabled (visible on POS + display)
              </label>
              <div style={chipRow()}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Visible on:</span>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((it) => (it.id === item.id ? { ...it, visible_on_menu: !it.visible_on_menu } : it))
                    )
                  }
                  style={chip(item.visible_on_menu)}
                  disabled={!canEdit}
                >
                  Menu
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((it) => (it.id === item.id ? { ...it, visible_on_pos: !it.visible_on_pos } : it))
                    )
                  }
                  style={chip(item.visible_on_pos)}
                  disabled={!canEdit}
                >
                  POS
                </button>
              </div>
              <div style={chipRow()}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Stock:</span>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, sold_out: false } : it)))
                  }
                  style={chip(!item.sold_out)}
                  disabled={!canEdit}
                >
                  In Stock
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, sold_out: true } : it)))
                  }
                  style={soldOutChip(item.sold_out)}
                  disabled={!canEdit}
                >
                  Sold Out
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={saveItems} style={itemsSaved ? btnSaved() : btnPrimary()} disabled={!canEdit}>
          {itemsSaved ? "Saved" : "Save items"}
        </button>
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

function row(): React.CSSProperties {
  return { display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "center" };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
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

function btnSaved(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.7)",
    background: "linear-gradient(135deg, rgba(34,197,94,0.9), rgba(22,163,74,0.6))",
    color: "white",
    fontWeight: 900,
  };
}

function btnDanger(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.7)",
    background: "linear-gradient(135deg, rgba(239,68,68,0.85), rgba(220,38,38,0.6))",
    color: "white",
    fontWeight: 900,
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
  };
}

function toggle(): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.8 };
}

function chipRow(): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.8)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 12,
    fontWeight: 800,
  };
}

function soldOutChip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(248,113,113,0.9)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 12,
    fontWeight: 900,
  };
}

function fieldLabel(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function primaryInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.7)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(14,165,233,0.08))",
    color: "white",
    fontWeight: 700,
  };
}

function secondaryInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(251,191,36,0.7)",
    background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.08))",
    color: "white",
    fontWeight: 700,
  };
}

function menuGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
}

function menuCard(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 14,
    padding: 14,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
    color: "white",
    display: "grid",
    gap: 6,
  };
}

function addCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 14,
    border: "1px dashed rgba(255,255,255,0.28)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 800,
  };
}

function detailCard(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  };
}

function itemGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 };
}

function itemCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(8,10,15,0.65)",
    display: "grid",
    gap: 8,
  };
}

function imageFrame(item: Item): React.CSSProperties {
  const hasImage = item.image_url && !item.use_text;
  const xRaw = Number(item.image_x);
  const yRaw = Number(item.image_y);
  const zoomRaw = Number(item.image_zoom);
  const x = Number.isFinite(xRaw) && String(item.image_x).trim() !== "" ? xRaw : 50;
  const y = Number.isFinite(yRaw) && String(item.image_y).trim() !== "" ? yRaw : 50;
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 120;
  return {
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
    textAlign: "center",
    padding: 8,
    color: "white",
    fontWeight: 800,
  };
}

function imageText(): React.CSSProperties {
  return { fontSize: 14, lineHeight: 1.2 };
}

function libraryGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,12,18,0.6)",
  };
}

function libraryThumb(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    padding: 0,
    cursor: "pointer",
    overflow: "hidden",
    aspectRatio: "1 / 1",
  };
}

function libraryThumbImage(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };
}
