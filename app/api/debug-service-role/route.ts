import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(url, service);

  // This should succeed if service role key matches the same project
  const { data, error } = await supabase.from("app_settings").select("id").limit(1);

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    rows: data?.length ?? 0,
  });
}
