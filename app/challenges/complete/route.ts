import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  studentId: string;
  challengeId: string;
  completed?: boolean; // default true
};

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const body = (await req.json()) as Body;

    const studentId = body.studentId;
    const challengeId = body.challengeId;
    const completed = body.completed ?? true;

    if (!studentId || !challengeId) {
      return NextResponse.json({ error: "Missing studentId or challengeId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("student_challenges")
      .upsert(
        {
          student_id: studentId,
          challenge_id: challengeId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: "student_id,challenge_id" }
      )
      .select("student_id,challenge_id,completed,completed_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // OPTIONAL: if your app expects points to recompute after completion
    // This will work if you ran the SQL function in the migration:
    const { error: rpcErr } = await supabase.rpc("recompute_student_points", {
      p_student_id: studentId,
    });

    // If you don't have students.points, you can ignore RPC error safely:
    // (or comment out rpc call entirely)
    if (rpcErr) {
      // don't fail the request; just report it
      return NextResponse.json({
        ok: true,
        row: data,
        warning: `recompute_student_points failed: ${rpcErr.message}`,
      });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
