import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function getStudentId(req: Request) {
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    return String(body?.student_id ?? body?.studentId ?? "").trim();
  }
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("student_id") ?? searchParams.get("studentId") ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const studentId = await getStudentId(req);
    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("student_challenges")
      .select("challenge_id,completed,completed_at")
      .eq("student_id", studentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
