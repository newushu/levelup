import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async () => {
  const appUrl = Deno.env.get("APP_URL");
  const secret = Deno.env.get("ACHIEVEMENTS_CRON_SECRET");

  if (!appUrl || !secret) {
    return new Response("Missing APP_URL or ACHIEVEMENTS_CRON_SECRET", { status: 500 });
  }

  const res = await fetch(`${appUrl}/api/achievements/auto/prestige`, {
    method: "POST",
    headers: { "x-achievement-secret": secret },
  });

  const text = await res.text();
  return new Response(text, { status: res.status });
});
