import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: student } = await admin.from("students").select("id,name").eq("id", student_id).maybeSingle();
  if (!student) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

  const { data: acct } = await admin.from("camp_accounts").select("balance_points").eq("student_id", student_id).maybeSingle();
  const balance_points = Number(acct?.balance_points ?? 0);

  const { data: aura } = await admin.from("camp_student_auras").select("aura_name,discount_points").eq("student_id", student_id).maybeSingle();

  const { data: coupons } = await admin
    .from("camp_student_coupons")
    .select("id,remaining_qty,camp_coupon_types(id,name,coupon_type,points_value,item_id)")
    .eq("student_id", student_id)
    .gt("remaining_qty", 0);

  const { data: avatarSettings } = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style")
    .eq("student_id", student_id)
    .maybeSingle();
  const avatarId = String(avatarSettings?.avatar_id ?? "").trim();
  let avatarPath: string | null = null;
  if (avatarId) {
    const { data: avatar } = await admin.from("avatars").select("id,storage_path").eq("id", avatarId).maybeSingle();
    avatarPath = avatar?.storage_path ?? null;
  }

  return NextResponse.json({
    ok: true,
    student: {
      ...student,
      avatar_storage_path: avatarPath,
      avatar_bg: avatarSettings?.bg_color ?? null,
      avatar_effect: avatarSettings?.particle_style ?? null,
    },
    balance_points,
    aura: aura ?? null,
    coupons:
      (coupons ?? []).map((row: any) => ({
        id: row.id,
        remaining_qty: row.remaining_qty,
        type: row.camp_coupon_types ?? null,
      })) ?? [],
  });
}
