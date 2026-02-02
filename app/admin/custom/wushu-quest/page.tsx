"use client";

import Link from "next/link";

export default function WushuQuestAdminPage() {
  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Wushu Adventure Quest</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Placeholder for item customization used by roulette wheels and future quests.
          </div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Admin Workspace
        </Link>
      </div>

      <section style={card()}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Item Library (coming soon)</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          This space will let you define collectible items, images, and unlock rules for Wushu Adventure Quest.
        </div>
        <div style={placeholder()}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Add your first quest item</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Connects to roulette item segments and lesson tools.</div>
        </div>
      </section>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    display: "grid",
    gap: 12,
  };
}

function placeholder(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.2)",
    padding: 18,
    background: "rgba(30,41,59,0.6)",
    display: "grid",
    gap: 6,
  };
}

function backLink(): React.CSSProperties {
  return { fontWeight: 900, fontSize: 12, opacity: 0.8 };
}
