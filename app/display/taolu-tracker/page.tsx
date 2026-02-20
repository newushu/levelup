"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { supabaseClient } from "@/lib/supabase/client";

type TaoluCard = {
  session_id: string;
  student_id: string;
  student_name: string;
  age_group_name?: string | null;
  form_name: string;
  source?: string;
  is_cumulative?: boolean;
  section_numbers?: number[];
  status?: "pending" | "finished";
  refinement_status?: "none" | "awaiting_refinement" | "refined";
  deductions_count: number;
  points_lost: number;
  deductions: Array<{ id: string; section_number?: number | null; code_label?: string; note?: string | null }>;
};

type TaoluPayload = {
  mode?: "track" | "practice" | "refine";
  pushed_at?: string;
  session_label?: string;
  practice_timer?: {
    duration_sec: number;
    started_at?: string | null;
    running?: boolean;
  };
  cards?: TaoluCard[];
  class_tools_bar?: Array<{
    source?: string;
    pushed_at?: string;
    student_name?: string;
    age_group_name?: string | null;
    form_name?: string;
    is_cumulative?: boolean;
    section_summary?: string;
    session_id?: string;
    status?: "pending" | "finished";
    deductions?: Array<{ code_label?: string; section_number?: number | null; note?: string }>;
  }>;
};

type DisplayState = {
  coach_user_id: string;
  tool_key: string;
  tool_payload?: TaoluPayload | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 220) } };
  }
}

function formatMMSS(totalSeconds: number) {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function modeLabel(mode: string) {
  if (mode === "practice") return "PRACTICE";
  if (mode === "refine") return "REFINEMENT";
  return "TRACKING";
}

export default function TaoluTrackerDisplayPage() {
  return (
    <AuthGate>
      <TaoluTrackerDisplayInner />
    </AuthGate>
  );
}

function TaoluTrackerDisplayInner() {
  const params = useSearchParams();
  const [coachUserId, setCoachUserId] = useState("");
  const [state, setState] = useState<DisplayState | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [rotationPage, setRotationPage] = useState(0);
  const [msg, setMsg] = useState("");
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const requestedCoach = String(params.get("coach_user_id") ?? "").trim();
      if (requestedCoach) {
        setCoachUserId(requestedCoach);
        return;
      }
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const meJson = await safeJson(meRes);
      const meId = String(meJson.json?.user?.id ?? "").trim();
      if (meId) {
        setCoachUserId(meId);
      } else {
        setMsg("Missing coach id. Add ?coach_user_id=... to URL.");
      }
    })();
  }, [params]);

  useEffect(() => {
    if (!coachUserId) return;

    const loadState = async () => {
      const qs = `?coach_user_id=${encodeURIComponent(coachUserId)}`;
      const res = await fetch(`/api/coach/display-state${qs}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok || !sj.json?.ok) {
        setMsg(sj.json?.error || "Failed to load taolu display state");
        return;
      }
      setState(sj.json?.state as DisplayState);
    };

    loadState();

    const supabase = supabaseClient();
    const setupChannel = async () => {
      const session = await supabase.auth.getSession();
      if (session.data?.session?.access_token) {
        supabase.realtime.setAuth(session.data.session.access_token);
      }
      if (channelRef.current) await supabase.removeChannel(channelRef.current);
      channelRef.current = supabase
        .channel("display-taolu-tracker")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "coach_display_state" },
          (payload) => {
            const nextId = String((payload as any)?.new?.coach_user_id ?? "");
            if (nextId === coachUserId) loadState();
          }
        )
        .subscribe();
    };

    setupChannel();
    const poll = window.setInterval(loadState, 15000);
    return () => {
      window.clearInterval(poll);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [coachUserId]);

  const payload = (state?.tool_key === "taolu_tracker" ? state.tool_payload : null) as TaoluPayload | null;
  const cards = payload?.cards ?? [];
  const classToolsBar = payload?.class_tools_bar ?? [];
  const mode = String(payload?.mode ?? "track");
  const timerCfg = payload?.practice_timer;

  const remainingSec = useMemo(() => {
    if (!timerCfg) return 0;
    const duration = Math.max(0, Number(timerCfg.duration_sec ?? 0));
    if (!timerCfg.running || !timerCfg.started_at) return duration;
    const started = new Date(timerCfg.started_at).getTime();
    if (!Number.isFinite(started)) return duration;
    const elapsed = Math.floor((nowMs - started) / 1000);
    return Math.max(0, duration - elapsed);
  }, [timerCfg, nowMs]);

  const cardsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(cards.length / cardsPerPage));
  useEffect(() => {
    setRotationPage(0);
  }, [cards.length]);
  useEffect(() => {
    const t = window.setInterval(() => {
      setRotationPage((prev) => (prev + 1) % totalPages);
    }, 20000);
    return () => window.clearInterval(t);
  }, [totalPages]);
  const visibleCards = cards.slice(rotationPage * cardsPerPage, rotationPage * cardsPerPage + cardsPerPage);

  const activeBar = classToolsBar.length ? classToolsBar[0] : null;

  return (
    <main style={shell()}>
      <div style={topBar()}>
        <div style={topCenterRow()}>
          <div style={timerBlock()}>
            <div style={{ fontSize: 14, opacity: 0.8, fontWeight: 900, textAlign: "center" }}>Practice Timer</div>
            <div style={timerValue()}>{formatMMSS(remainingSec)}</div>
            <div style={{ fontSize: 12, opacity: 0.72, textAlign: "center" }}>Session: {payload?.session_label || "Latest pushed"}</div>
          </div>
          <div style={modeBlock()}>
            <div className="taolu-mode-text">{modeLabel(mode)}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {payload?.pushed_at ? `Pushed ${new Date(payload.pushed_at).toLocaleTimeString()}` : "Waiting for push"}
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.88, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setRotationPage((prev) => (prev - 1 + totalPages) % totalPages)}
          disabled={totalPages <= 1}
          style={pagerBtn(totalPages <= 1)}
        >
          ←
        </button>
        <span style={{ margin: "0 10px" }}>
          Page {Math.min(rotationPage + 1, totalPages)} / {totalPages} • 6 per page • rotates every 20s
        </span>
        <button
          type="button"
          onClick={() => setRotationPage((prev) => (prev + 1) % totalPages)}
          disabled={totalPages <= 1}
          style={pagerBtn(totalPages <= 1)}
        >
          →
        </button>
      </div>

      {msg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{msg}</div> : null}

      <section style={displayBody()}>
        <div style={leftPane()}>
          <div className="taolu-display-grid" style={grid()}>
            {visibleCards.map((card) => (
              <div key={card.session_id} style={{ position: "relative", paddingTop: 20 }}>
                {card.is_cumulative ? (
                  <div style={topStatusBadge("cumulative")}>CUMULATIVE</div>
                ) : card.refinement_status === "awaiting_refinement" ? (
                  <div style={topStatusBadge("refining")}>NEED REFINING</div>
                ) : null}
                <article
                  style={cardStyle(
                    card.status === "pending",
                    card.status === "finished",
                    card.refinement_status === "awaiting_refinement"
                  )}
                >
                  <div style={{ fontSize: 34, fontWeight: 1000, lineHeight: 1.05, textAlign: "center" }}>{card.student_name}</div>
                  <div style={{ fontSize: 24, opacity: 0.9, fontWeight: 900, textAlign: "center" }}>{card.form_name}</div>
                  <div style={{ fontSize: 19, opacity: 0.86, fontWeight: 900, textAlign: "center" }}>
                    {(card.age_group_name ? `${card.age_group_name} • ` : "")}
                    Sections: {Array.isArray(card.section_numbers) && card.section_numbers.length ? card.section_numbers.join(", ") : "—"}
                  </div>
                  <div style={{ fontSize: 27, fontWeight: 900, marginTop: 4 }}>
                    <div style={{ textAlign: "center" }}>Deductions: {card.deductions_count} • Lost: {card.points_lost}</div>
                  </div>
                  <div style={{ fontSize: 20, opacity: 0.9, textAlign: "center", fontWeight: 900, marginBottom: 10 }}>
                    {card.status === "pending" ? "OPEN CARD" : "COMPLETED CARD"}
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 18 }}>
                    {card.deductions.length ? (
                      card.deductions.map((d, idx) => (
                        <div key={d.id || `${card.session_id}-${idx}`} style={deductionLine()}>
                          <div style={{ fontSize: 30, fontWeight: 1000, lineHeight: 1, minWidth: 42, textAlign: "center" }}>
                            {extractCodeNumber(d.code_label) || "—"}
                          </div>
                          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.15 }}>
                              {(extractCodeName(d.code_label) || "Unassigned code")}
                              {d.section_number != null ? ` • Sec ${d.section_number}` : ""}
                            </div>
                            <div style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.15 }}>
                              {d.note?.trim() || "No coach note"}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 22, opacity: 0.82, fontWeight: 900, textAlign: "center" }}>
                        {card.status === "pending"
                          ? `In Progress • ${card.deductions_count} deductions`
                          : `Completed • ${card.deductions_count} deductions`}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: "auto", display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                    {card.status === "finished" ? (
                      <span className="taolu-chip-complete">Complete</span>
                    ) : (
                      <span className="taolu-chip-pending">Open</span>
                    )}
                    {card.status === "finished" ? (
                      card.refinement_status === "refined" ? (
                        <span className="taolu-chip-refined">Refined</span>
                      ) : (
                        <span className="taolu-chip-awaiting">Awaiting Refine</span>
                      )
                    ) : null}
                  </div>
                </article>
              </div>
            ))}
          </div>
          {!cards.length ? <div style={{ opacity: 0.7 }}>No pushed taolu session yet.</div> : null}
        </div>
        <aside style={classToolsRail()}>
          <div style={{ fontSize: 20, fontWeight: 1000, opacity: 0.9 }}>Class Tools Bar • Taolu Tracker</div>
          {activeBar ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={railName()}>
                {activeBar.student_name || "Student"}
              </div>
              <div style={railSubhead()}>
                {(activeBar.age_group_name ? `${activeBar.age_group_name} • ` : "")}{activeBar.form_name || "Taolu"} • Sec {activeBar.section_summary || "—"}
              </div>
              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                {(activeBar.deductions ?? []).map((d, idx) => (
                  <div key={`${idx}-${d.code_label ?? ""}`} style={barCodeChip()}>
                    <div style={{ fontWeight: 900, fontSize: 30, lineHeight: 1.05 }}>
                      {d.code_label || "Unassigned"} • Sec {d.section_number ?? "—"}
                    </div>
                    <div style={{ fontSize: 22, opacity: 0.8, lineHeight: 1.1 }}>{String(d.note ?? "").trim() || "No coach note"}</div>
                  </div>
                ))}
                {!(activeBar.deductions ?? []).length ? <div style={{ opacity: 0.7, fontSize: 24, fontWeight: 900 }}>No deductions logged.</div> : null}
              </div>
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>No class tools taolu push yet.</div>
          )}
        </aside>
      </section>

      <style>{`
        @keyframes taoluModePulse {
          0% { transform: translateY(0); text-shadow: 0 0 10px rgba(59,130,246,0.35); }
          50% { transform: translateY(-2px); text-shadow: 0 0 24px rgba(56,189,248,0.6); }
          100% { transform: translateY(0); text-shadow: 0 0 10px rgba(59,130,246,0.35); }
        }
        .taolu-mode-text {
          font-size: clamp(28px, 5vw, 62px);
          font-weight: 1000;
          letter-spacing: 1.1px;
          color: rgba(191,219,254,0.98);
          animation: taoluModePulse 2.4s ease-in-out infinite;
        }
        .taolu-display-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .taolu-chip-complete,
        .taolu-chip-awaiting,
        .taolu-chip-refined,
        .taolu-chip-pending {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.32);
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .taolu-chip-complete {
          color: #dcfce7;
          border-color: rgba(34,197,94,0.65);
          background: linear-gradient(100deg, rgba(16,185,129,0.25) 0%, rgba(34,197,94,0.55) 45%, rgba(16,185,129,0.25) 100%);
          background-size: 250% 100%;
          animation: chipFlowGreen 1.8s linear infinite;
          box-shadow: 0 0 14px rgba(34,197,94,0.4);
        }
        .taolu-chip-awaiting {
          color: #ffedd5;
          border-color: rgba(249,115,22,0.65);
          background: linear-gradient(100deg, rgba(124,45,18,0.62) 0%, rgba(249,115,22,0.55) 50%, rgba(124,45,18,0.62) 100%);
          background-size: 220% 100%;
          animation: chipFlowGreen 2s linear infinite;
          box-shadow: 0 0 12px rgba(249,115,22,0.38);
        }
        .taolu-chip-refined {
          color: #dbeafe;
          border-color: rgba(59,130,246,0.72);
          background: linear-gradient(100deg, rgba(30,58,138,0.45) 0%, rgba(59,130,246,0.55) 50%, rgba(30,58,138,0.45) 100%);
          background-size: 250% 100%;
          animation: chipFlowBlue 1.8s linear infinite;
          box-shadow: 0 0 14px rgba(59,130,246,0.42);
        }
        .taolu-chip-pending {
          color: #bae6fd;
          border-color: rgba(56,189,248,0.55);
          background: rgba(2,132,199,0.25);
        }
        @keyframes chipFlowGreen {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes chipFlowBlue {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @media (max-width: 760px) {
          .taolu-display-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        }
      `}</style>
    </main>
  );
}

function shell(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    gap: 12,
    padding: 12,
    background: "radial-gradient(120% 140% at 50% 0%, #0f2748 0%, #0a1020 60%, #05070f 100%)",
    color: "white",
  };
}

function topBar(): React.CSSProperties {
  return {
    height: "20vh",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "linear-gradient(120deg, rgba(30,64,175,0.3), rgba(15,23,42,0.7))",
    padding: 12,
    display: "grid",
    alignItems: "center",
    gap: 16,
  };
}

function topCenterRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    width: "100%",
  };
}

function timerBlock(): React.CSSProperties {
  return { display: "grid", gap: 4 };
}

function timerValue(): React.CSSProperties {
  return {
    fontSize: "clamp(32px, 6vw, 74px)",
    lineHeight: 1,
    fontWeight: 1000,
    color: "rgba(125,211,252,0.98)",
  };
}

function modeBlock(): React.CSSProperties {
  return {
    display: "grid",
    justifyItems: "start",
    alignContent: "center",
    textAlign: "left",
    gap: 6,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    alignContent: "start",
    overflow: "hidden",
  };
}

function displayBody(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 414px",
    gap: 12,
    minHeight: 0,
    alignItems: "start",
  };
}

function leftPane(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    minHeight: 0,
  };
}

function classToolsRail(): React.CSSProperties {
  return {
    minHeight: "calc(100vh - 290px)",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "linear-gradient(120deg, rgba(15,23,42,0.92), rgba(2,6,23,0.96))",
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 8,
    overflow: "auto",
  };
}

function railName(): React.CSSProperties {
  return {
    fontSize: "clamp(44px, 4.2vw, 66px)",
    fontWeight: 1000,
    lineHeight: 0.92,
    wordBreak: "break-word",
  };
}

function railSubhead(): React.CSSProperties {
  return {
    fontSize: 26,
    fontWeight: 900,
    opacity: 0.9,
    lineHeight: 1.1,
  };
}

function barCodeChip(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(15,23,42,0.75)",
    padding: "8px 10px",
    minWidth: 0,
    display: "grid",
    gap: 3,
  };
}

function cardStyle(isPending: boolean, isFinished: boolean, isAwaitingRefinement: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    border: isAwaitingRefinement
      ? "1px solid rgba(249,115,22,0.72)"
      : isFinished
      ? "1px solid rgba(34,197,94,0.58)"
      : isPending
        ? "1px solid rgba(59,130,246,0.5)"
        : "1px solid rgba(148,163,184,0.26)",
    background: isAwaitingRefinement
      ? "linear-gradient(155deg, rgba(194,65,12,0.52), rgba(2,6,23,0.9))"
      : isPending
      ? "linear-gradient(155deg, rgba(30,64,175,0.35), rgba(2,6,23,0.9))"
      : isFinished
        ? "linear-gradient(155deg, rgba(6,78,59,0.45), rgba(2,6,23,0.9))"
        : "linear-gradient(155deg, rgba(15,23,42,0.86), rgba(2,6,23,0.9))",
    boxShadow: "0 8px 26px rgba(2,6,23,0.4)",
    padding: 10,
    minHeight: 782,
    display: "grid",
    alignContent: "start",
    gap: 3,
    paddingBottom: 12,
  };
}

function topStatusBadge(mode: "cumulative" | "refining"): React.CSSProperties {
  const cumulative = mode === "cumulative";
  return {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: 0.6,
    color: cumulative ? "#fef3c7" : "#ffedd5",
    background: cumulative ? "rgba(202,138,4,0.88)" : "rgba(194,65,12,0.9)",
    border: cumulative ? "1px solid rgba(253,224,71,0.7)" : "1px solid rgba(251,146,60,0.7)",
    boxShadow: cumulative ? "0 0 16px rgba(234,179,8,0.35)" : "0 0 16px rgba(249,115,22,0.35)",
    textTransform: "uppercase",
    zIndex: 3,
  };
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.5)",
    background: disabled ? "rgba(51,65,85,0.5)" : "rgba(30,64,175,0.65)",
    color: "white",
    fontWeight: 1000,
    padding: "4px 10px",
    fontSize: 16,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function deductionLine(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "6px 8px",
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(148,163,184,0.2)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  };
}

function extractCodeNumber(label?: string | null): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "";
  const [first] = raw.split(/\s+/, 1);
  return String(first ?? "").trim();
}

function extractCodeName(label?: string | null): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "";
  const num = extractCodeNumber(raw);
  if (!num) return raw;
  const rest = raw.slice(num.length).trim();
  return rest || raw;
}
