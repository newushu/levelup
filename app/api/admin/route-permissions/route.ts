import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAGE_FILES = new Set(["page.tsx", "page.jsx", "page.ts", "page.js"]);

function isIgnoredSegment(segment: string) {
  if (!segment) return true;
  if (segment.startsWith("_")) return true;
  if (segment.startsWith("(") && segment.endsWith(")")) return true;
  return false;
}

function toRoutePath(segments: string[]) {
  const parts = segments
    .filter((seg) => !isIgnoredSegment(seg))
    .map((seg) => {
      if (seg.startsWith("[") && seg.endsWith("]")) {
        const name = seg.slice(1, -1).replace(/\.\.\./g, "");
        return `:${name || "param"}`;
      }
      return seg;
    });
  const route = "/" + parts.filter(Boolean).join("/");
  return route === "/index" ? "/" : route;
}

function describeRoute(route: string) {
  if (route === "/") return "Home";

  const exact: Record<string, string> = {
    "/login": "Login",
    "/reset-password": "Reset Password",
    "/dashboard": "Main Dashboard (your daily hub)",
    "/checkin": "Student Check-In",
    "/skills": "Skills Overview",
    "/preps-tracker": "P.R.E.P.S Tracker",
    "/taolu-tracker": "Taolu Tracker",
    "/performance-lab": "Performance Lab",
    "/classroom": "Classroom HQ (daily tools)",
    "/classroom/roster": "Classroom Roster (who's here)",
    "/admin": "Admin Workspace",
    "/admin/custom/access": "Access & Permissions",
    "/admin/custom/camp": "Camp Access Settings",
    "/camp": "Camp HQ (all camp tools)",
    "/camp/menu": "Camp Menu (what's on)",
    "/camp/register": "Camp Registration (sign-ups)",
    "/coach": "Coach HQ (daily coaching)",
    "/coach/classroom": "Coach Classroom (live class view)",
    "/coach/display": "Coach Display Controls (big screen)",
    "/display": "Display Launchpad (big screen start)",
    "/display/skill-pulse": "Skill Pulse (live skills board)",
    "/display/battle-pulse": "Battle Pulse (live battle board)",
    "/display/siege-survive": "Siege Survive (game display)",
    "/display/badges": "Badges Display (awards screen)",
    "/parent": "Parent Portal (family view)",
    "/parent/rewards": "Parent Rewards (redeem)",
    "/parent/announcements": "Parent Announcements (updates)",
  };
  if (exact[route]) return exact[route];

  const segmentLabels: Record<string, string> = {
    admin: "Admin",
    coach: "Coach",
    classroom: "Classroom",
    display: "Display",
    parent: "Parent",
    camp: "Camp",
    tools: "Tools",
    "lesson-forge": "Lesson Forge (plan builder)",
    "scorekeeper": "Scorekeeper (quick points)",
    "video-library": "Video Library (watch & teach)",
    "skill-pulse": "Skill Pulse (live skills)",
    "battle-pulse": "Battle Pulse (live battles)",
    "siege-survive": "Siege Survive (game)",
    "preps-tracker": "P.R.E.P.S Tracker",
    "taolu-tracker": "Taolu Tracker",
    "performance-lab": "Performance Lab",
    "custom": "Custom Settings",
    "access": "Access & Permissions",
    "badge-library": "Badge Library (award bank)",
    "parent-messages": "Parent Messages",
    "parent-pairing": "Parent Pairing",
    "parent-relationships": "Parent Relationships",
    "announcements": "Announcements",
    "schedule": "Schedule",
    "passes": "Passes",
    "passes-accounting": "Passes Accounting",
    "passes-assign": "Passes Assign",
    "display-settings": "Display Settings",
    "badges": "Badges",
    "rewards": "Rewards",
    "profile": "Profile",
    "settings": "Settings",
  };

  const label = route
    .split("/")
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(":")) return "ID";
      const key = part.toLowerCase();
      if (segmentLabels[key]) return segmentLabels[key];
      return part
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    })
    .join(" · ");
  return label || "Route";
}

async function walk(dir: string, segments: string[], routes: Array<{ route_path: string; description: string }>) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      await walk(path.join(dir, entry.name), [...segments, entry.name], routes);
      continue;
    }
    if (!PAGE_FILES.has(entry.name)) continue;
    const route_path = toRoutePath(segments);
    routes.push({ route_path, description: describeRoute(route_path) });
  }
}

async function listRoutes() {
  const appDir = path.join(process.cwd(), "app");
  const routes: Array<{ route_path: string; description: string }> = [];
  await walk(appDir, [], routes);
  const unique = new Map<string, { route_path: string; description: string }>();
  routes.forEach((r) => {
    if (!unique.has(r.route_path)) unique.set(r.route_path, r);
  });
  return Array.from(unique.values()).sort((a, b) => a.route_path.localeCompare(b.route_path));
}

function defaultRolesForRoute(route_path: string) {
  if (route_path.startsWith("/admin")) return ["admin"];
  if (route_path.startsWith("/coach") || route_path.startsWith("/classroom")) return ["admin", "coach"];
  return ["admin"];
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: existing, error } = await admin
    .from("route_permissions")
    .select("id,route_path,allowed_roles,description,created_at,updated_at");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const routes = await listRoutes();
  const byPath = new Map<string, any>();
  (existing ?? []).forEach((row: any) => byPath.set(String(row.route_path), row));

  const merged = routes.map((r) => {
    const saved = byPath.get(r.route_path);
    const fallbackRoles = defaultRolesForRoute(r.route_path);
    return {
      route_path: r.route_path,
      description: saved?.description || r.description,
      allowed_roles: saved?.allowed_roles ?? fallbackRoles,
      has_rules: Boolean(saved),
      id: saved?.id ?? null,
    };
  });

  return NextResponse.json({ ok: true, routes: merged });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const route_path = String(body?.route_path ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const allowed_roles = Array.isArray(body?.allowed_roles)
    ? body.allowed_roles.map((r: any) => String(r).toLowerCase()).filter(Boolean)
    : [];
  if (!route_path) return NextResponse.json({ ok: false, error: "route_path required" }, { status: 400 });

  const admin = supabaseAdmin();
  const payload = {
    route_path,
    description,
    allowed_roles,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from("route_permissions")
    .upsert(payload, { onConflict: "route_path" })
    .select("id,route_path,allowed_roles,description,created_at,updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, route: data });
}
