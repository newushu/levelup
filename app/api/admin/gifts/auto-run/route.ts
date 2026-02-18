import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runDueGiftAutoAssignments } from "@/lib/giftAutoAssignments";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const admin = supabaseAdmin();

  const result = await runDueGiftAutoAssignments(admin, {
    dryRun,
    grantedBy: gate.user.id,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}

