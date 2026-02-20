"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type StudentRow = { id: string; name: string; points_total?: number | null };

type GiftRow = {
  id: string;
  student_id: string;
  gift_item_id: string;
  qty: number;
  opened_qty: number;
  expires_at?: string | null;
  expired_at?: string | null;
  is_expired?: boolean;
  gift_items?: {
    id: string;
    name: string;
    category: string;
    category_tags?: string[] | null;
    gift_type: string;
    points_value: number;
    design_image_url?: string | null;
    design_html?: string | null;
    design_css?: string | null;
    design_js?: string | null;
    gift_designs?: {
      id: string;
      name: string;
      preview_image_url?: string | null;
      html?: string | null;
      css?: string | null;
      js?: string | null;
    } | null;
  } | null;
};

type GiftOpenLogRow = {
  id: string;
  student_id: string;
  student_gift_id: string;
  gift_item_id: string;
  points_awarded: number;
  points_before_open?: number | null;
  points_after_open?: number | null;
  opened_at: string;
  gift_items?: {
    name?: string | null;
    category?: string | null;
    category_tags?: string[] | null;
    gift_type?: string | null;
    design_image_url?: string | null;
    gift_designs?: { preview_image_url?: string | null } | null;
  } | null;
};

function renderGiftVisual(g: GiftRow) {
  const item = g.gift_items;
  if (!item) return null;
  const design = item.gift_designs;
  const image = String(item.design_image_url ?? design?.preview_image_url ?? "").trim();
  if (image) {
    return <img src={image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />;
  }

  const html = String(item.design_html ?? design?.html ?? "").trim();
  const css = String(item.design_css ?? design?.css ?? "").trim();
  if (html) {
    return (
      <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", position: "relative" }}>
        {css ? <style>{css}</style> : null}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", borderRadius: 12, display: "grid", placeItems: "center", background: "radial-gradient(circle at 35% 25%, rgba(251,191,36,0.55), rgba(180,83,9,0.45))", fontSize: 36 }}>
      🎁
    </div>
  );
}

function formatExpiryMeta(expiresAt?: string | null) {
  const raw = String(expiresAt ?? "").trim();
  if (!raw) return "";
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return "";
  const now = Date.now();
  const diffMs = ts - now;
  const hoursLeft = Math.max(0, Math.floor(diffMs / (60 * 60 * 1000)));
  return `${new Date(ts).toLocaleString()} (${hoursLeft}h left)`;
}

export default function StudentGiftsPage() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [msg, setMsg] = useState("");
  const [hubMode, setHubMode] = useState<"giftbox" | "stash" | "expired">("giftbox");
  const [openingId, setOpeningId] = useState("");
  const [result, setResult] = useState<null | { gift_name: string; category: string; points_awarded: number; remaining: number; package_items_added?: number }>(null);
  const [giftOpenAudio, setGiftOpenAudio] = useState("");
  const [openLogs, setOpenLogs] = useState<GiftOpenLogRow[]>([]);

  async function loadStudent() {
    const res = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to load student"));
    const rows = (sj?.students ?? []) as StudentRow[];
    let id = "";
    try {
      id = localStorage.getItem("active_student_id") || "";
    } catch {}
    const selected = rows.find((r) => String(r.id) === String(id)) ?? null;
    setStudent(selected);
  }

  async function loadGifts(studentId: string) {
    const res = await fetch(`/api/student/gifts?student_id=${encodeURIComponent(studentId)}`, { cache: "no-store" });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to load gifts"));
    setGifts((sj?.gifts ?? []) as GiftRow[]);
  }

  async function loadOpenLogs(studentId: string) {
    const res = await fetch(`/api/student/gifts/logs?student_id=${encodeURIComponent(studentId)}`, { cache: "no-store" });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setOpenLogs((sj?.logs ?? []) as GiftOpenLogRow[]);
  }

  useEffect(() => {
    loadStudent();
    (async () => {
      const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = Array.isArray(sj?.effects) ? sj.effects : [];
      const row = list.find((x: any) => String(x?.key ?? "") === "gift_open");
      const url = String(row?.audio_url ?? "").trim();
      if (url) setGiftOpenAudio(url);
    })();
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    loadGifts(student.id);
    loadOpenLogs(student.id);
  }, [student?.id]);

  const expiredGifts = useMemo(() => {
    const now = Date.now();
    return gifts.filter((g) => {
      if (g.is_expired || g.expired_at) return true;
      const expiresMs = Date.parse(String(g.expires_at ?? ""));
      return Number.isFinite(expiresMs) && expiresMs <= now;
    });
  }, [gifts]);
  const expiredGiftIds = useMemo(
    () => new Set(expiredGifts.map((g) => String(g.id ?? "")).filter(Boolean)),
    [expiredGifts]
  );
  const unopened = useMemo(
    () =>
      gifts.filter((g) => !expiredGiftIds.has(String(g.id ?? ""))).filter((g) => Math.max(0, Number(g.qty ?? 0) - Number(g.opened_qty ?? 0)) > 0),
    [gifts, expiredGiftIds]
  );
  const inventoryItems = useMemo(() => {
    return gifts.filter((g) => {
      if (expiredGiftIds.has(String(g.id ?? ""))) return false;
      const openedCount = Math.max(0, Number(g.opened_qty ?? 0));
      if (!openedCount) return false;
      const category = String(g.gift_items?.category ?? "").toLowerCase();
      const points = Math.max(0, Number(g.gift_items?.points_value ?? 0));
      const autoAward = category === "points" || category === "package" || points > 0;
      return !autoAward;
    });
  }, [gifts, expiredGiftIds]);

  async function openGift(gift: GiftRow) {
    if (!student?.id || !gift?.id) return;
    const giftName = String(gift?.gift_items?.name ?? "this gift");
    const ok = window.confirm(`Open gift: ${giftName}?`);
    if (!ok) return;
    setOpeningId(gift.id);
    setMsg("");
    setResult(null);

    if (giftOpenAudio) {
      const audio = new Audio(giftOpenAudio);
      audio.volume = 1;
      audio.play().catch(() => {});
    }

    const res = await fetch("/api/student/gifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, student_gift_id: gift.id }),
    });
    const sj = await res.json().catch(() => ({}));
    setOpeningId("");
    if (!res.ok) return setMsg(String(sj?.error ?? "Failed to open gift"));
    setResult(sj?.result ?? null);
    await loadGifts(student.id);
    await loadOpenLogs(student.id);
  }

  return (
    <AuthGate>
      <main className="gifts-page" style={{ minHeight: "100vh", color: "white", background: "radial-gradient(circle at 30% 8%, rgba(147,51,234,0.22), rgba(2,6,23,0.98) 58%)", display: "grid", gap: 14, alignContent: "start" }}>
        <style>{giftStyles}</style>
        <style>{`
          .gifts-page {
            padding-left: 252px;
            padding-right: 14px;
          }
          @media (max-width: 1100px) {
            .gifts-page {
              padding-left: 0;
              padding-right: 0;
              padding-bottom: 92px;
            }
          }
        `}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 1000 }}>Gift Box</div>
            <div style={{ opacity: 0.76 }}>Open rewards and see what you got.</div>
          </div>
        </div>

        {!student?.id ? <div style={notice()}>No active student selected.</div> : null}
        {msg ? <div style={notice()}>{msg}</div> : null}

        <section style={{ borderRadius: 16, border: "1px solid rgba(147,197,253,0.45)", background: "linear-gradient(160deg, rgba(15,23,42,0.82), rgba(2,6,23,0.94))", padding: 14, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Your Inventory</div>
          <div className="inventory-hub">
            <button
              type="button"
              className={`hub-card hub-card--gift ${hubMode === "giftbox" ? "hub-card--active" : ""}`}
              onClick={() => setHubMode("giftbox")}
            >
              <span className="hub-card__giftbox" aria-hidden>
                <span className="hub-card__lid" />
                <span className="hub-card__rb hub-card__rb--v" />
                <span className="hub-card__rb hub-card__rb--h" />
                <span className="hub-card__bow" />
                <span className="hub-card__glow" />
              </span>
              <span className="hub-card__title">Gift Box</span>
              <span className="hub-card__meta">{unopened.length} unopened</span>
            </button>
            <button
              type="button"
              className={`hub-card hub-card--stash ${hubMode === "stash" ? "hub-card--active" : ""}`}
              onClick={() => setHubMode("stash")}
            >
              <span className="hub-card__stash-icon" aria-hidden>🧰</span>
              <span className="hub-card__title">Inventory Stash</span>
              <span className="hub-card__meta">{inventoryItems.length} stored</span>
            </button>
            <button
              type="button"
              className={`hub-card hub-card--expired ${hubMode === "expired" ? "hub-card--active" : ""}`}
              onClick={() => setHubMode("expired")}
            >
              <span className="hub-card__stash-icon" aria-hidden>⌛</span>
              <span className="hub-card__title">Expired Gifts</span>
              <span className="hub-card__meta">{expiredGifts.length} expired</span>
            </button>
          </div>
          <div className="gift-tabs">
            {hubMode === "giftbox" ? (
              <button
                type="button"
                className="gift-tab gift-tab--active"
              >
                Unopened Gifts ({unopened.length})
              </button>
            ) : hubMode === "stash" ? (
              <button
                type="button"
                className="gift-tab gift-tab--active"
              >
                Inventory Stash ({inventoryItems.length})
              </button>
            ) : (
              <button
                type="button"
                className="gift-tab gift-tab--active"
              >
                Expired Gifts ({expiredGifts.length})
              </button>
            )}
          </div>
            <div className="gift-grid">
              {(hubMode === "giftbox" ? unopened : hubMode === "stash" ? inventoryItems : expiredGifts).map((g) => {
                const item = g.gift_items;
                const remaining = Math.max(0, Number(g.qty ?? 0) - Number(g.opened_qty ?? 0));
                const openedCount = Math.max(0, Number(g.opened_qty ?? 0));
                const giftPoints = Math.max(0, Number(item?.points_value ?? 0));
                const expiresLabel = String(g.expires_at ?? "").trim();
                const expiryMeta = formatExpiryMeta(expiresLabel);
                return (
                  <div key={g.id} className={`gift-card ${openingId === g.id ? "gift-card--opening" : ""}`}>
                    <div className="gift-card__visual-shell">
                      <div className="gift-card__visual">{renderGiftVisual(g)}</div>
                      <div className="gift-card__burst" aria-hidden>
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                    <div className="gift-card__name">{item?.name ?? "Gift"}</div>
                    <div className="gift-card__meta">
                      {(item?.category_tags && item.category_tags.length ? item.category_tags.join(", ") : item?.category ?? "item")} • {item?.gift_type ?? "generic"}
                    </div>
                    {expiresLabel ? <div className="gift-card__meta">Expires: {expiryMeta || new Date(expiresLabel).toLocaleString()}</div> : null}
                    {giftPoints > 0 ? <div className="gift-card__points">+{giftPoints} pts on open</div> : null}
                    <div className="gift-card__qty">x{hubMode === "giftbox" ? remaining : hubMode === "stash" ? openedCount : remaining}</div>
                    {hubMode === "giftbox" ? (
                      <button type="button" className="gift-card__open" disabled={openingId === g.id} onClick={() => openGift(g)}>
                        {openingId === g.id ? "Opening..." : "Open Gift"}
                      </button>
                    ) : hubMode === "stash" ? (
                      <div className="gift-card__owned">In Inventory</div>
                    ) : (
                      <div className="gift-card__owned">Expired</div>
                    )}
                  </div>
                );
              })}
            </div>
            {hubMode === "giftbox" && !unopened.length ? <div className="gift-empty">No unopened gifts.</div> : null}
            {hubMode === "stash" && !inventoryItems.length ? <div className="gift-empty">No inventory items yet. Open non-auto-award gifts to store them here.</div> : null}
            {hubMode === "expired" && !expiredGifts.length ? <div className="gift-empty">No expired gifts.</div> : null}
          </section>

        {result ? (
          <section className="gift-result">
            <div className="gift-result__title">Gift Opened!</div>
            <div className="gift-result__name">{result.gift_name}</div>
            <div className="gift-result__line">Category: {result.category}</div>
            <div className="gift-result__points">+{Math.round(Number(result.points_awarded ?? 0))} pts awarded</div>
            {Number(result.package_items_added ?? 0) > 0 ? (
              <div className="gift-result__line">Package unpacked: {Math.round(Number(result.package_items_added ?? 0))} item(s) added to inventory</div>
            ) : null}
            <div className="gift-result__line">Remaining of this gift: {result.remaining}</div>
          </section>
        ) : null}
        <section style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.4)", background: "linear-gradient(160deg, rgba(15,23,42,0.7), rgba(2,6,23,0.94))", padding: 12, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Opened Gifts Log</div>
          {!openLogs.length ? <div className="gift-empty">No gifts opened yet.</div> : null}
          {openLogs.map((log) => {
            const thumb = String(log.gift_items?.design_image_url ?? log.gift_items?.gift_designs?.preview_image_url ?? "").trim();
            const before = Math.round(Number(log.points_before_open ?? 0));
            const after = Math.round(Number(log.points_after_open ?? 0));
            return (
              <div key={log.id} style={{ borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(15,23,42,0.55)", padding: 10, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {thumb ? <img src={thumb} alt={String(log.gift_items?.name ?? "Gift")} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} /> : <span>🎁</span>}
                  <div style={{ fontWeight: 900 }}>{String(log.gift_items?.name ?? "Gift")}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.82 }}>
                  +{Math.round(Number(log.points_awarded ?? 0))} pts • {String(log.gift_items?.category ?? "item")}
                </div>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  Before {before} → After {after}
                </div>
                <div style={{ fontSize: 11, opacity: 0.66 }}>{new Date(log.opened_at).toLocaleString()}</div>
              </div>
            );
          })}
        </section>
      </main>
    </AuthGate>
  );
}

const giftStyles = `
.gifts-page {
  padding: 18px 18px 18px 88px;
}
.inventory-hub {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.hub-card {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,0.38);
  background: linear-gradient(160deg, rgba(30,41,59,0.7), rgba(2,6,23,0.95));
  color: #e2e8f0;
  padding: 10px;
  min-height: 132px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}
.hub-card:hover { transform: translateY(-2px); border-color: rgba(125,211,252,0.5); }
.hub-card--active {
  border-color: rgba(56,189,248,0.72);
  box-shadow: 0 0 26px rgba(56,189,248,0.25), inset 0 0 24px rgba(30,64,175,0.22);
}
.hub-card__title { font-size: 14px; font-weight: 1000; letter-spacing: 0.4px; }
.hub-card__meta { font-size: 12px; opacity: .82; font-weight: 700; }
.hub-card__giftbox {
  position: relative;
  width: 72px;
  height: 58px;
  border-radius: 10px;
  background: linear-gradient(155deg, rgba(251,191,36,0.9), rgba(180,83,9,0.96));
  box-shadow: 0 10px 18px rgba(0,0,0,0.35);
}
.hub-card__lid {
  position: absolute;
  left: 6px;
  right: 6px;
  top: -10px;
  height: 18px;
  border-radius: 8px;
  background: linear-gradient(160deg, rgba(253,224,71,0.95), rgba(217,119,6,0.95));
  transform-origin: 50% 100%;
  transition: transform .28s ease;
}
.hub-card__rb {
  position: absolute;
  background: linear-gradient(180deg, rgba(147,51,234,0.95), rgba(109,40,217,0.98));
}
.hub-card__rb--v { width: 10px; left: 50%; top: 0; bottom: 0; transform: translateX(-50%); }
.hub-card__rb--h { height: 10px; left: 0; right: 0; top: 46%; transform: translateY(-50%); }
.hub-card__bow {
  position: absolute;
  top: -14px;
  left: 50%;
  width: 16px;
  height: 16px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(233,213,255,0.96), rgba(126,34,206,0.95));
  box-shadow: 12px 0 0 rgba(126,34,206,0.95), -12px 0 0 rgba(126,34,206,0.95);
}
.hub-card__glow {
  position: absolute;
  inset: -12px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(125,211,252,0.24), rgba(125,211,252,0));
  opacity: 0;
}
.hub-card--gift.hub-card--active .hub-card__lid { transform: rotateX(72deg) translateY(-6px); }
.hub-card--gift.hub-card--active .hub-card__glow { opacity: 1; animation: hubPulse 1.2s ease-in-out infinite; }
.hub-card__stash-icon {
  font-size: 40px;
  line-height: 1;
  filter: drop-shadow(0 3px 8px rgba(56,189,248,0.3));
}
.hub-card--expired {
  background: linear-gradient(160deg, rgba(120,53,15,0.68), rgba(30,41,59,0.95));
  border-color: rgba(251,146,60,0.4);
}
@keyframes hubPulse {
  0%, 100% { transform: scale(0.94); opacity: 0.4; }
  50% { transform: scale(1.08); opacity: 1; }
}
@media (max-width: 760px) {
  .gifts-page { padding: 14px; }
  .inventory-hub { grid-template-columns: 1fr; }
}
.gift-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.gift-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.gift-tab {
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,0.46);
  background: rgba(15,23,42,0.62);
  color: #e2e8f0;
  font-weight: 900;
  font-size: 12px;
  padding: 6px 10px;
}
.gift-tab--active {
  border-color: rgba(56,189,248,0.72);
  background: linear-gradient(145deg, rgba(56,189,248,0.26), rgba(15,23,42,0.72));
  color: #e0f2fe;
}
@media (max-width: 980px) { .gift-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.gift-card {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,0.4);
  background: linear-gradient(160deg, rgba(15,23,42,0.76), rgba(2,6,23,0.94));
  padding: 10px;
  display: grid;
  gap: 8px;
  position: relative;
  overflow: hidden;
}
.gift-card--opening { animation: shakeGift .46s ease-in-out 2, popGift .35s ease-out .45s 1; }
@keyframes shakeGift { 0%{transform:translateX(0)} 20%{transform:translateX(-4px) rotate(-1.2deg)} 40%{transform:translateX(4px) rotate(1.2deg)} 60%{transform:translateX(-3px) rotate(-1deg)} 80%{transform:translateX(2px) rotate(.8deg)} 100%{transform:translateX(0)} }
@keyframes popGift { 0%{transform:scale(1)} 55%{transform:scale(1.06)} 100%{transform:scale(1)} }
.gift-card__visual-shell { position: relative; width: 100%; display: grid; justify-items: center; }
.gift-card__visual {
  width: 52%;
  min-width: 64px;
  max-width: 92px;
  aspect-ratio: 1/1;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148,163,184,0.3);
  transition: transform .22s ease, filter .22s ease;
}
.gift-card--opening .gift-card__visual { transform: scale(1.16) rotate(-2deg); filter: brightness(1.18) saturate(1.2); }
.gift-card__name { font-weight: 1000; font-size: 18px; line-height: 1.15; text-align: center; }
.gift-card__meta { font-size: 12px; opacity: .75; }
.gift-card__points {
  font-size: 12px;
  font-weight: 900;
  color: #86efac;
  text-shadow: 0 0 10px rgba(34,197,94,0.35);
}
.gift-card__qty { font-size: 12px; opacity: .9; font-weight: 800; }
.gift-card__burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.gift-card__burst span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 26px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(56,189,248,0.72));
  --rot: 0deg;
  transform: translate(-50%, -50%) rotate(var(--rot)) scaleY(.15);
  opacity: 0;
}
.gift-card__burst span:nth-child(1) { --rot: 0deg; }
.gift-card__burst span:nth-child(2) { --rot: 60deg; }
.gift-card__burst span:nth-child(3) { --rot: 120deg; }
.gift-card__burst span:nth-child(4) { --rot: 180deg; }
.gift-card__burst span:nth-child(5) { --rot: 240deg; }
.gift-card__burst span:nth-child(6) { --rot: 300deg; }
.gift-card--opening .gift-card__burst span {
  animation: giftBurst .48s ease-out .36s 1;
}
@keyframes giftBurst {
  0% { opacity: 0; }
  20% { opacity: .95; transform: translate(-50%, -50%) rotate(var(--rot)) scaleY(.4); }
  100% { opacity: 0; transform: translate(-50%, -150%) rotate(var(--rot)) scaleY(1.2); }
}
.gift-card__open {
  border-radius: 10px;
  border: 1px solid rgba(59,130,246,0.8);
  background: linear-gradient(135deg, rgba(30,64,175,0.92), rgba(30,58,138,0.96));
  color: white;
  font-weight: 900;
  padding: 8px 10px;
}
.gift-card__owned {
  border-radius: 10px;
  border: 1px solid rgba(74,222,128,0.58);
  background: rgba(22,101,52,0.26);
  color: #dcfce7;
  font-weight: 900;
  font-size: 12px;
  text-align: center;
  padding: 8px 10px;
}
.gift-empty {
  border-radius: 10px;
  border: 1px dashed rgba(148,163,184,0.42);
  padding: 10px;
  font-size: 12px;
  opacity: 0.8;
}
.gift-result {
  border-radius: 14px;
  border: 1px solid rgba(125,211,252,0.58);
  background: radial-gradient(circle at 50% 12%, rgba(14,165,233,0.22), rgba(2,6,23,0.9));
  padding: 14px;
  display: grid;
  gap: 6px;
  justify-items: center;
}
.gift-result__title { font-size: 22px; font-weight: 1000; color: #e0f2fe; }
.gift-result__name { font-size: 18px; font-weight: 900; }
.gift-result__line { font-size: 13px; opacity: 0.86; }
.gift-result__points { font-size: 20px; font-weight: 1000; color: #86efac; }
`;

function notice(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(127,29,29,0.4)",
    padding: "8px 10px",
    fontWeight: 800,
  };
}
