import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/authz";
import { resolveParentContext } from "../_parentContext";

export async function GET(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) {
    const { error, status } = ctx as { ok: false; status: number; error: string };
    return NextResponse.json({ ok: false, error }, { status });
  }
  const parent = ctx.parent;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("parent_messages")
    .select("id,body,created_at,is_from_admin,admin_user_id,coach_user_id,thread_key,student_id,note_id")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const staffIds = new Set<string>();
  (data ?? []).forEach((row: any) => {
    const adminId = String(row?.admin_user_id ?? "").trim();
    const coachId = String(row?.coach_user_id ?? "").trim();
    if (adminId) staffIds.add(adminId);
    if (coachId) staffIds.add(coachId);
  });

  let staffNames = new Map<string, string>();
  if (staffIds.size) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id,username,email")
      .in("user_id", Array.from(staffIds));
    staffNames = new Map(
      (profiles ?? []).map((profile: any) => [
        String(profile.user_id),
        String(profile.username || profile.email || "Coach"),
      ])
    );
  }

  const parentName = String(parent?.name || "Parent");
  const messages = (data ?? []).map((row: any) => {
    const staffId = String(row?.coach_user_id ?? row?.admin_user_id ?? "").trim();
    const staffName = staffNames.get(staffId) || "Coach";
    return {
      ...row,
      sender_name: row?.is_from_admin ? staffName : parentName,
    };
  });

  return NextResponse.json({ ok: true, messages });
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body?.body ?? "").trim();
  const threadKeyRaw = String(body?.thread_key ?? "general").trim().toLowerCase() || "general";
  const coachUserId = String(body?.coach_user_id ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Message required" }, { status: 400 });
  if (!threadKeyRaw.startsWith("coach:")) {
    return NextResponse.json({ ok: false, error: "Please select a coach thread." }, { status: 403 });
  }

  const coachIdFromThread = threadKeyRaw.split("coach:")[1] || "";
  if (!coachIdFromThread) {
    return NextResponse.json({ ok: false, error: "Coach thread is missing." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

  const { error } = await admin.from("parent_messages").insert({
    parent_id: parent.id,
    body: text,
    is_from_admin: false,
    thread_key: `coach:${coachIdFromThread}`,
    coach_user_id: coachIdFromThread || coachUserId || null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
