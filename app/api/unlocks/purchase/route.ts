import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ITEM_TABLES: Record<
  string,
  { table: string; keyField: string; selectFields: string; labelField?: string }
> = {
  avatar: { table: "avatars", keyField: "id", selectFields: "id,name,unlock_level,unlock_points" },
  effect: { table: "avatar_effects", keyField: "key", selectFields: "key,name,unlock_level,unlock_points" },
  corner_border: { table: "ui_corner_borders", keyField: "key", selectFields: "key,name,unlock_level,unlock_points" },
  card_plate: { table: "ui_card_plate_borders", keyField: "key", selectFields: "key,name,unlock_level,unlock_points" },
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const item_type = String(body?.item_type ?? "").trim();
  const item_key = String(body?.item_key ?? "").trim();
  if (!student_id || !item_type || !item_key) {
    return NextResponse.json({ ok: false, error: "Missing student_id, item_type, or item_key" }, { status: 400 });
  }

  const itemDef = ITEM_TABLES[item_type];
  if (!itemDef) return NextResponse.json({ ok: false, error: "Unsupported item_type" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: student, error: sErr } = await admin
    .from("students")
    .select("id,name,level,points_balance")
    .eq("id", student_id)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

  const { data: itemRaw, error: iErr } = await admin
    .from(itemDef.table)
    .select(itemDef.selectFields)
    .eq(itemDef.keyField, item_key)
    .maybeSingle();
  if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
  const item = itemRaw as any;
  if (!item) return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 });

  const unlockLevel = Number(item?.unlock_level ?? 1);
  const unlockPoints = Math.max(0, Math.floor(Number(item?.unlock_points ?? 0)));
  if (Number(student.level ?? 1) < unlockLevel) {
    return NextResponse.json({ ok: false, error: `Requires level ${unlockLevel}` }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("student_custom_unlocks")
    .select("id")
    .eq("student_id", student_id)
    .eq("item_type", item_type)
    .eq("item_key", item_key)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyUnlocked: true });
  }

  const pointsBalance = Number(student.points_balance ?? 0);
  if (unlockPoints > 0 && pointsBalance < unlockPoints) {
    return NextResponse.json({ ok: false, error: `Need ${unlockPoints} points` }, { status: 400 });
  }

  const { error: insErr } = await admin
    .from("student_custom_unlocks")
    .insert({ student_id, item_type, item_key });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  if (unlockPoints > 0) {
    const label = String(item?.name ?? item_key);
    const note = `Unlock ${item_type}: ${label} (-${unlockPoints})`;
    const { error: ledgerErr } = await admin.from("ledger").insert({
      student_id,
      points: -Math.abs(unlockPoints),
      note,
      category: `unlock_${item_type}`,
      created_by: u.user.id,
    });
    if (ledgerErr) return NextResponse.json({ ok: false, error: ledgerErr.message }, { status: 500 });

    const rpc = await admin.rpc("recompute_student_points", { p_student_id: student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  const { data: updatedStudent } = await admin
    .from("students")
    .select("id,name,level,points_total,points_balance,lifetime_points,is_competition_team")
    .eq("id", student_id)
    .maybeSingle();

  return NextResponse.json({ ok: true, student: updatedStudent ?? student });
}
