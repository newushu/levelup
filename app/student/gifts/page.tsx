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

export default function StudentGiftsPage() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [msg, setMsg] = useState("");
  const [openInventory, setOpenInventory] = useState(false);
  const [openingId, setOpeningId] = useState("");
  const [result, setResult] = useState<null | { gift_name: string; category: string; points_awarded: number; remaining: number; package_items_added?: number }>(null);
  const [giftOpenAudio, setGiftOpenAudio] = useState("");

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
  }, [student?.id]);

  const unopened = useMemo(
    () => gifts.filter((g) => Math.max(0, Number(g.qty ?? 0) - Number(g.opened_qty ?? 0)) > 0),
    [gifts]
  );

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
  }

  return (
    <AuthGate>
      <main style={{ minHeight: "100vh", padding: 18, color: "white", background: "radial-gradient(circle at 30% 8%, rgba(147,51,234,0.22), rgba(2,6,23,0.98) 58%)", display: "grid", gap: 14, alignContent: "start" }}>
        <style>{giftStyles}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 1000 }}>Gift Box</div>
            <div style={{ opacity: 0.76 }}>Open rewards and see what you got.</div>
          </div>
          <a href="/student/info" style={{ borderRadius: 999, border: "1px solid rgba(148,163,184,0.45)", background: "rgba(15,23,42,0.65)", color: "white", textDecoration: "none", padding: "8px 12px", fontWeight: 800 }}>
            Back to Student Info
          </a>
        </div>

        {!student?.id ? <div style={notice()}>No active student selected.</div> : null}
        {msg ? <div style={notice()}>{msg}</div> : null}

        <button
          type="button"
          className={`gift-launch ${openInventory ? "gift-launch--open" : ""}`}
          onClick={() => setOpenInventory((v) => !v)}
        >
          <span className="gift-launch__lid" />
          <span className="gift-launch__ribbon gift-launch__ribbon--v" />
          <span className="gift-launch__ribbon gift-launch__ribbon--h" />
          <span className="gift-launch__bow" />
          <span className="gift-launch__label">{openInventory ? "Close Gift Inventory" : "Open Gift Inventory"}</span>
        </button>

        {openInventory ? (
          <section style={{ borderRadius: 16, border: "1px solid rgba(147,197,253,0.45)", background: "linear-gradient(160deg, rgba(15,23,42,0.82), rgba(2,6,23,0.94))", padding: 14, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Your Gifts</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>{unopened.length} unopened gift(s)</div>
            <div className="gift-grid">
              {unopened.map((g) => {
                const item = g.gift_items;
                const remaining = Math.max(0, Number(g.qty ?? 0) - Number(g.opened_qty ?? 0));
                return (
                  <div key={g.id} className={`gift-card ${openingId === g.id ? "gift-card--opening" : ""}`}>
                    <div className="gift-card__visual">{renderGiftVisual(g)}</div>
                    <div className="gift-card__name">{item?.name ?? "Gift"}</div>
                    <div className="gift-card__meta">
                      {(item?.category_tags && item.category_tags.length ? item.category_tags.join(", ") : item?.category ?? "item")} • {item?.gift_type ?? "generic"}
                    </div>
                    <div className="gift-card__qty">x{remaining}</div>
                    <button type="button" className="gift-card__open" disabled={openingId === g.id} onClick={() => openGift(g)}>
                      {openingId === g.id ? "Opening..." : "Open Gift"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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
      </main>
    </AuthGate>
  );
}

const giftStyles = `
.gift-launch {
  position: relative;
  width: min(340px, 92vw);
  height: 180px;
  border-radius: 18px;
  border: 1px solid rgba(250,204,21,0.52);
  background: linear-gradient(160deg, rgba(180,83,9,0.86), rgba(146,64,14,0.94));
  justify-self: center;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 24px 44px rgba(0,0,0,0.42), 0 0 32px rgba(250,204,21,0.26);
  transition: transform .22s ease, box-shadow .22s ease;
}
.gift-launch:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 30px 52px rgba(0,0,0,0.46), 0 0 38px rgba(250,204,21,0.32); }
.gift-launch__lid {
  position: absolute;
  left: 6%;
  top: 9%;
  width: 88%;
  height: 32%;
  border-radius: 14px;
  background: linear-gradient(155deg, rgba(251,191,36,0.88), rgba(217,119,6,0.94));
  transform-origin: bottom center;
  transition: transform .35s ease;
}
.gift-launch--open .gift-launch__lid { transform: rotateX(55deg) translateY(-12px); }
.gift-launch__ribbon { position: absolute; background: linear-gradient(180deg, rgba(147,51,234,0.92), rgba(126,34,206,0.98)); }
.gift-launch__ribbon--v { left: 49%; top: 0; width: 16px; height: 100%; transform: translateX(-50%); }
.gift-launch__ribbon--h { left: 0; top: 44%; width: 100%; height: 16px; transform: translateY(-50%); }
.gift-launch__bow {
  position: absolute;
  top: 22%;
  left: 50%;
  width: 56px;
  height: 28px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle at 30% 50%, rgba(196,181,253,0.9), rgba(109,40,217,0.95));
  border-radius: 999px;
  box-shadow: 30px 0 0 rgba(126,34,206,0.95), -30px 0 0 rgba(126,34,206,0.95);
}
.gift-launch__label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18px;
  text-align: center;
  color: #fff7ed;
  font-size: 22px;
  font-weight: 1000;
  text-shadow: 0 2px 0 rgba(120,53,15,0.8);
}
.gift-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 980px) { .gift-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.gift-card {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,0.4);
  background: linear-gradient(160deg, rgba(15,23,42,0.76), rgba(2,6,23,0.94));
  padding: 10px;
  display: grid;
  gap: 6px;
}
.gift-card--opening { animation: shakeGift .4s ease-in-out 2; }
@keyframes shakeGift { 0%{transform:translateX(0)} 25%{transform:translateX(-3px) rotate(-1deg)} 50%{transform:translateX(3px) rotate(1deg)} 75%{transform:translateX(-2px) rotate(-1deg)} 100%{transform:translateX(0)} }
.gift-card__visual { width: 100%; aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; border: 1px solid rgba(148,163,184,0.3); }
.gift-card__name { font-weight: 900; font-size: 14px; line-height: 1.2; }
.gift-card__meta { font-size: 12px; opacity: .75; }
.gift-card__qty { font-size: 12px; opacity: .9; font-weight: 800; }
.gift-card__open {
  border-radius: 10px;
  border: 1px solid rgba(59,130,246,0.8);
  background: linear-gradient(135deg, rgba(30,64,175,0.92), rgba(30,58,138,0.96));
  color: white;
  font-weight: 900;
  padding: 8px 10px;
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
