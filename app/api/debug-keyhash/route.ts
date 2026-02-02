import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const hash = crypto.createHash("sha256").update(anon).digest("hex").slice(0, 12);
  return NextResponse.json({
    anonLen: anon.length,
    anonHash12: hash, // safe: just first 12 chars of sha256
  });
}
