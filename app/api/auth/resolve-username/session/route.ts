import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  // NOTE: This is a simple anon-client session check; cookie-based SSR session
  // comes later. For now we just confirm client auth state on the browser.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon);

  const { data, error } = await supabase.auth.getSession();

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    hasSession: !!data?.session,
  });
}
