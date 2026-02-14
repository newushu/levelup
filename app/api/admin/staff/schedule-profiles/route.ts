import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("staff_schedule_profiles")
    .select("user_id,availability_hours,services,updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profiles: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id ?? "").trim();
  const availability_hours = String(body?.availability_hours ?? "").trim();
  const services = Array.isArray(body?.services)
    ? body.services.map((row: any) => String(row ?? "").trim()).filter(Boolean)
    : [];

  if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("staff_schedule_profiles")
    .upsert(
      {
        user_id,
        availability_hours,
        services,
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

