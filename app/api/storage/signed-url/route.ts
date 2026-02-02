import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function GET(req: NextRequest) {
  const raw = String(req.nextUrl.searchParams.get("path") ?? "").trim();
  if (!raw) return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });

  // Try a few variants to survive inconsistent DB values
  const candidates: string[] = [raw];

  if (raw.startsWith("avatars/")) candidates.push(raw.slice("avatars/".length));
  if (!raw.startsWith("avatars/")) candidates.push(`avatars/${raw}`);

  const supabase = supabaseAdmin();

  let lastErr: string | null = null;

  for (const objectPath of candidates) {
    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(objectPath, 60 * 30);

    if (!error && data?.signedUrl) {
      // Redirect so <img src="/api/storage/signed-url?..."> works
      return NextResponse.redirect(data.signedUrl, { status: 302 });
    }

    lastErr = error?.message ?? "Unknown error";
  }

  // Use 404 if it's just missing objects (this is common)
  const status = /not found|does not exist|NoSuchKey/i.test(lastErr ?? "") ? 404 : 500;

  return NextResponse.json(
    { ok: false, error: lastErr ?? "Failed to sign", tried: candidates },
    { status }
  );
}
