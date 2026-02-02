import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const r = await fetch(`${url}/auth/v1/settings`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    cache: "no-store",
  });

  const text = await r.text();
  return NextResponse.json({
    status: r.status,
    bodyPrefix: text.slice(0, 300),
  });
}
