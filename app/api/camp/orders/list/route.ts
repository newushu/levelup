import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  const canView = roleList.some((r) => ["admin", "camp", "coach"].includes(r));
  let leaderAccess = false;
  if (!canView && roleList.includes("student")) {
    const studentId = String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "");
    const today = new Date().toISOString().slice(0, 10);
    const { data: leader } = await supabase
      .from("camp_leaders")
      .select("id")
      .eq("student_id", studentId)
      .eq("enabled", true)
      .lte("start_date", today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .maybeSingle();
    leaderAccess = !!leader?.id;
  }
  if (!canView && !leaderAccess) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { data, error } = await supabase
    .from("camp_orders")
    .select("id,student_id,student_name,total_points,discount_points,paid_at,items,payments,paid_by,coupons_used")
    .order("paid_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const admin = supabaseAdmin();
  const ids = Array.from(new Set((data ?? []).map((row: any) => String(row.student_id ?? "")).filter(Boolean)));
  const orderIds = Array.from(new Set((data ?? []).map((row: any) => String(row.id ?? "")).filter(Boolean)));
  const studentById = new Map<string, any>();
  const balanceById = new Map<string, number>();
  const avatarSettingsById = new Map<string, any>();
  const avatarById = new Map<string, any>();
  const refundByOrderId = new Map<string, any>();

  if (ids.length) {
    const { data: students } = await admin.from("students").select("id,name,points_total").in("id", ids);
    (students ?? []).forEach((s: any) => studentById.set(String(s.id), s));
    (students ?? []).forEach((s: any) => balanceById.set(String(s.id), Number(s.points_total ?? 0)));

    const { data: settings } = await admin
      .from("student_avatar_settings")
      .select("student_id,avatar_id,bg_color,particle_style")
      .in("student_id", ids);
    (settings ?? []).forEach((row: any) => avatarSettingsById.set(String(row.student_id), row));

    const avatarIds = Array.from(
      new Set((settings ?? []).map((row: any) => String(row.avatar_id ?? "")).filter(Boolean))
    );
    if (avatarIds.length) {
      const { data: avatars } = await admin.from("avatars").select("id,storage_path").in("id", avatarIds);
      (avatars ?? []).forEach((row: any) => avatarById.set(String(row.id), row));
    }
  }
  if (orderIds.length) {
    const { data: refunds } = await admin
      .from("camp_order_refunds")
      .select("order_id,refunded_points,refunded_at,refunded_by")
      .in("order_id", orderIds);
    (refunds ?? []).forEach((row: any) => refundByOrderId.set(String(row.order_id), row));
  }

  const orders = (data ?? []).map((row: any) => {
    const sid = String(row.student_id ?? "");
    const studentBase = sid ? studentById.get(sid) : null;
    const avatarSettings = sid ? avatarSettingsById.get(sid) : null;
    const avatarId = String(avatarSettings?.avatar_id ?? "").trim();
    const avatar = avatarId ? avatarById.get(avatarId) : null;
    const student = studentBase
      ? {
          ...studentBase,
          avatar_storage_path: avatar?.storage_path ?? null,
          avatar_bg: avatarSettings?.bg_color ?? null,
          avatar_effect: avatarSettings?.particle_style ?? null,
        }
      : null;
    return {
      ...row,
      student,
      balance_points: sid ? balanceById.get(sid) ?? null : null,
      refund: refundByOrderId.get(String(row.id)) ?? null,
    };
  });

  return NextResponse.json({ ok: true, orders });
}
