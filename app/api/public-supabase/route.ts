import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return NextResponse.json({
    url,
    anonLen: anon.length,
    anonPrefix: anon.slice(0, 12), // safe-ish: not full key
  });
}
