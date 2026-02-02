import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return NextResponse.json({
    hasUrl: !!url,
    urlPrefix: url ? url.slice(0, 30) : "",
    anonLen: anon.length,
    serviceRoleLen: svc.length,
  });
}
