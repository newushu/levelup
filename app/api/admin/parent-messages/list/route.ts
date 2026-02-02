import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parentId = String(searchParams.get("parent_id") ?? "").trim();

  const admin = supabaseAdmin();
  let query = admin
    .from("parent_messages")
    .select("id,parent_id,body,created_at,is_from_admin,admin_user_id,coach_user_id,thread_key,student_id,note_id")
    .order("created_at", { ascending: true });

  if (parentId) query = query.eq("parent_id", parentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const messages = data ?? [];
  const parentIds = new Set<string>();
  const staffIds = new Set<string>();

  messages.forEach((row: any) => {
    if (row?.parent_id) parentIds.add(String(row.parent_id));
    const adminId = String(row?.admin_user_id ?? "").trim();
    const coachId = String(row?.coach_user_id ?? "").trim();
    if (adminId) staffIds.add(adminId);
    if (coachId) staffIds.add(coachId);
  });

  const parentNameById = new Map<string, string>();
  if (parentIds.size) {
    const { data: parents } = await admin.from("parents").select("id,name").in("id", Array.from(parentIds));
    (parents ?? []).forEach((row: any) => parentNameById.set(String(row.id), String(row.name || "Parent")));
  }

  const staffNameById = new Map<string, string>();
  if (staffIds.size) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id,username,email")
      .in("user_id", Array.from(staffIds));
    (profiles ?? []).forEach((row: any) =>
      staffNameById.set(String(row.user_id), String(row.username || row.email || "Coach"))
    );
  }

  const shaped = messages.map((row: any) => {
    const staffId = String(row?.coach_user_id ?? row?.admin_user_id ?? "").trim();
    const staffName = staffNameById.get(staffId) || "Coach";
    const parentName = parentNameById.get(String(row.parent_id)) || "Parent";
    return {
      ...row,
      sender_name: row?.is_from_admin ? staffName : parentName,
    };
  });

  return NextResponse.json({ ok: true, messages: shaped });
}
