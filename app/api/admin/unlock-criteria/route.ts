import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isMissingColumn(err: any, column: string) {
  const msg = String(err?.message ?? "").toLowerCase();
  const key = column.toLowerCase();
  return msg.includes(`column \"${key}\"`) || msg.includes(`.${key}`) || msg.includes(key);
}

async function loadAll(studentId?: string) {
  const admin = supabaseAdmin();
  let defsRes: any = await admin
    .from("unlock_criteria_definitions")
    .select("key,label,description,enabled,start_date,end_date,daily_free_points,created_at,updated_at")
    .order("label", { ascending: true });
  if (defsRes.error && (isMissingColumn(defsRes.error, "start_date") || isMissingColumn(defsRes.error, "end_date") || isMissingColumn(defsRes.error, "daily_free_points"))) {
    defsRes = await admin
      .from("unlock_criteria_definitions")
      .select("key,label,description,enabled,created_at,updated_at")
      .order("label", { ascending: true });
  }

  const [reqRes, studentsRes, avatarsRes, effectsRes, studentCriteriaRes] = await Promise.all([
    admin.from("unlock_criteria_item_requirements").select("id,item_type,item_key,criteria_key,created_at").order("created_at", { ascending: true }),
    admin.from("students").select("id,name").order("name", { ascending: true }),
    admin.from("avatars").select("id,name,enabled").order("name", { ascending: true }),
    admin.from("avatar_effects").select("key,name,enabled").order("name", { ascending: true }),
    studentId
      ? admin.from("student_unlock_criteria").select("student_id,criteria_key,fulfilled,note,fulfilled_at,updated_at").eq("student_id", studentId)
      : admin
          .from("student_unlock_criteria")
          .select("student_id,criteria_key,fulfilled,note,fulfilled_at,updated_at"),
  ]);

  if (defsRes.error) return NextResponse.json({ ok: false, error: defsRes.error.message }, { status: 500 });
  if (reqRes.error) return NextResponse.json({ ok: false, error: reqRes.error.message }, { status: 500 });
  if (studentsRes.error) return NextResponse.json({ ok: false, error: studentsRes.error.message }, { status: 500 });
  if (avatarsRes.error) return NextResponse.json({ ok: false, error: avatarsRes.error.message }, { status: 500 });
  if (effectsRes.error) return NextResponse.json({ ok: false, error: effectsRes.error.message }, { status: 500 });
  if (studentCriteriaRes.error) return NextResponse.json({ ok: false, error: studentCriteriaRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    criteria: defsRes.data ?? [],
    requirements: reqRes.data ?? [],
    students: studentsRes.data ?? [],
    avatars: avatarsRes.data ?? [],
    effects: effectsRes.data ?? [],
    student_criteria: studentCriteriaRes.data ?? [],
  });
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const url = new URL(req.url);
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();
  return loadAll(studentId || undefined);
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();
  const admin = supabaseAdmin();

  if (action === "upsert_criteria") {
    const key = String(body?.key ?? "").trim().toLowerCase();
    const label = String(body?.label ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const enabled = body?.enabled !== false;
    const start_date = String(body?.start_date ?? "").trim() || null;
    const end_date = String(body?.end_date ?? "").trim() || null;
    const daily_free_points = Math.max(0, Math.floor(Number(body?.daily_free_points ?? 0) || 0));
    if (!key || !label) return NextResponse.json({ ok: false, error: "key and label are required" }, { status: 400 });
    let up = await admin
      .from("unlock_criteria_definitions")
      .upsert({ key, label, description, enabled, start_date, end_date, daily_free_points }, { onConflict: "key" });
    if (up.error && (isMissingColumn(up.error, "start_date") || isMissingColumn(up.error, "end_date") || isMissingColumn(up.error, "daily_free_points"))) {
      up = await admin
        .from("unlock_criteria_definitions")
        .upsert({ key, label, description, enabled }, { onConflict: "key" });
    }
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
    return loadAll();
  }

  if (action === "delete_criteria") {
    const key = String(body?.key ?? "").trim().toLowerCase();
    if (!key) return NextResponse.json({ ok: false, error: "key is required" }, { status: 400 });
    const del = await admin.from("unlock_criteria_definitions").delete().eq("key", key);
    if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
    return loadAll();
  }

  if (action === "set_requirement") {
    const item_type = String(body?.item_type ?? "").trim();
    const item_key = String(body?.item_key ?? "").trim();
    const criteria_key = String(body?.criteria_key ?? "").trim().toLowerCase();
    const required = body?.required !== false;
    if (!item_type || !item_key || !criteria_key) {
      return NextResponse.json({ ok: false, error: "item_type, item_key, criteria_key required" }, { status: 400 });
    }
    if (required) {
      const up = await admin
        .from("unlock_criteria_item_requirements")
        .upsert({ item_type, item_key, criteria_key }, { onConflict: "item_type,item_key,criteria_key" });
      if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
    } else {
      const del = await admin
        .from("unlock_criteria_item_requirements")
        .delete()
        .eq("item_type", item_type)
        .eq("item_key", item_key)
        .eq("criteria_key", criteria_key);
      if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
    }
    return loadAll();
  }

  if (action === "set_student_criteria") {
    const student_id = String(body?.student_id ?? "").trim();
    const criteria_key = String(body?.criteria_key ?? "").trim().toLowerCase();
    const fulfilled = body?.fulfilled !== false;
    const note = String(body?.note ?? "").trim();
    if (!student_id || !criteria_key) return NextResponse.json({ ok: false, error: "student_id and criteria_key required" }, { status: 400 });
    const up = await admin
      .from("student_unlock_criteria")
      .upsert({
        student_id,
        criteria_key,
        fulfilled,
        note,
        fulfilled_at: fulfilled ? new Date().toISOString() : null,
      }, { onConflict: "student_id,criteria_key" });
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
    return loadAll(student_id);
  }

  return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
}
