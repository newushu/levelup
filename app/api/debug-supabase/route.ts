import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(url, anon);

  // Simple call that should work with a valid key:
  const { data, error } = await supabase.auth.getSession();

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    gotSession: !!data?.session,
  });
}

