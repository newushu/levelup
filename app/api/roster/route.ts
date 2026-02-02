import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  points: number | null;
  level?: number | null;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    // Pull students
    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id,first_name,last_name,points,level")
      .order("last_name", { ascending: true });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    const ids = (students ?? []).map((s: StudentRow) => s.id);
    if (ids.length === 0) return NextResponse.json({ students: [] });

    // Aggregate medals (master stars depends on this)
    // If you already store medals elsewhere, replace this query to match your schema.
    const { data: medals, error: mErr } = await supabase
      .from("student_medals")
      .select("student_id, medal_type")
      .in("student_id", ids);

    if (mErr) {
      // If you don't use medals table, still return students with 0 counts
      return NextResponse.json({
        students: (students ?? []).map((s: StudentRow) => ({
          id: s.id,
          firstName: s.first_name ?? "",
          lastName: s.last_name ?? "",
          points: s.points ?? 0,
          medalCounts: { gold: 0, silver: 0, bronze: 0, master: 0 },
          corner_border_url: null,
        })),
        warning: `student_medals query failed: ${mErr.message}`,
      });
    }

    const countsByStudent: Record<string, { gold: number; silver: number; bronze: number; master: number }> = {};
    for (const id of ids) countsByStudent[id] = { gold: 0, silver: 0, bronze: 0, master: 0 };

    for (const row of medals ?? []) {
      const sid = row.student_id as string;
      const t = row.medal_type as "gold" | "silver" | "bronze" | "master";
      if (!countsByStudent[sid]) countsByStudent[sid] = { gold: 0, silver: 0, bronze: 0, master: 0 };
      if (t in countsByStudent[sid]) countsByStudent[sid][t] += 1;
    }

    const studentById = new Map((students ?? []).map((s: StudentRow) => [s.id, s]));
    const { data: settings } = await supabase
      .from("student_avatar_settings")
      .select("student_id,corner_border_key")
      .in("student_id", ids);

    const borderKeys = Array.from(
      new Set((settings ?? []).map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
    );
    const borderByKey = new Map<string, { image_url: string | null; unlock_level: number; enabled: boolean }>();
    if (borderKeys.length) {
      const { data: borders } = await supabase
        .from("ui_corner_borders")
        .select("key,image_url,unlock_level,enabled")
        .in("key", borderKeys);
      (borders ?? []).forEach((b: any) =>
        borderByKey.set(String(b.key), {
          image_url: b.image_url ?? null,
          unlock_level: Number(b.unlock_level ?? 1),
          enabled: b.enabled !== false,
        })
      );
    }
    const cornerByStudent = new Map<string, string | null>();
    (settings ?? []).forEach((s: any) => {
      const studentId = String(s.student_id ?? "");
      const borderKey = String(s.corner_border_key ?? "").trim();
      const border = borderKey ? borderByKey.get(borderKey) : null;
      const level = Number(studentById.get(studentId)?.level ?? 1);
      const borderOk = border && border.enabled && level >= border.unlock_level;
      cornerByStudent.set(studentId, borderOk ? border?.image_url ?? null : null);
    });

    return NextResponse.json({
      students: (students ?? []).map((s: StudentRow) => ({
        id: s.id,
        firstName: s.first_name ?? "",
        lastName: s.last_name ?? "",
        points: s.points ?? 0,
        medalCounts: countsByStudent[s.id] ?? { gold: 0, silver: 0, bronze: 0, master: 0 },
        corner_border_url: cornerByStudent.get(s.id) ?? null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
