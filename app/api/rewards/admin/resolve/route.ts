import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

async function requireStaff() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .in("role", ["admin", "coach"])
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Staff access required" };

  return { ok: true as const, userId: u.user.id };
}

export async function POST(req: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const redemption_id = String(body?.redemption_id ?? "").trim();
  const action = String(body?.action ?? "").trim();

  if (!redemption_id || !action) {
    return NextResponse.json({ ok: false, error: "Missing redemption_id/action" }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const { data: redemption, error: rErr } = await supabase
    .from("reward_redemptions")
    .select("id,student_id,reward_id,cost,status,mode")
    .eq("id", redemption_id)
    .single();
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  if (redemption.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Redemption already resolved" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  if (action === "approve") {
    const { error } = await supabase
      .from("reward_redemptions")
      .update({
        status: "approved",
        approved_at: nowIso,
        approved_by: gate.userId,
        redeemed_at: nowIso,
        redeemed_by: gate.userId,
      })
      .eq("id", redemption_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("reward_redemptions")
      .update({
        status: "rejected",
        approved_at: nowIso,
        approved_by: gate.userId,
      })
      .eq("id", redemption_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const refund = Number(redemption.cost ?? 0);
    if (refund > 0) {
      const { error: ledErr } = await supabase.from("ledger").insert({
        student_id: redemption.student_id,
        points: Math.abs(refund),
        note: "Hold request rejected (refund)",
        category: "redeem_hold_refund",
      });
      if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

      const { error: rpcErr } = await supabase.rpc("recompute_student_points", { p_student_id: redemption.student_id });
      if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
