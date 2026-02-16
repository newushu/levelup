import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Allow these paths without auth (debug + auth endpoints + static)
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/parent/request") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/debug-env") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/parent/request") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets");

  if (isPublic) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: any) => {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase()).filter(Boolean);
  const roleSet = new Set(roleList);
  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (parent?.id) roleSet.add("parent");
  const role = roleList.includes("admin")
    ? "admin"
    : parent?.id || roleList.includes("parent")
    ? "parent"
    : roleList.includes("coach")
    ? "coach"
    : roleList.includes("coach-dashboard")
    ? "coach-dashboard"
    : roleList.includes("skill-tablet")
    ? "skill-tablet"
    : roleList.includes("camp")
    ? "camp"
    : roleList.includes("checkin")
    ? "checkin"
    : roleList.includes("classroom")
    ? "classroom"
    : roleList.includes("skill_pulse")
    ? "skill_pulse"
    : roleList.includes("display")
    ? "display"
    : roleList.includes("student")
    ? "student"
    : "coach";

  if (role === "parent") {
    const isParentAllowed =
      pathname === "/" ||
      pathname.startsWith("/parent") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/home-quest") ||
      pathname.startsWith("/logout");
    if (!isParentAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/parent";
      return NextResponse.redirect(url);
    }
  }

  const isCampOnlyUser =
    roleSet.has("camp") &&
    !roleSet.has("admin") &&
    !roleSet.has("coach") &&
    !roleSet.has("classroom");

  if (isCampOnlyUser) {
    const campBaseAllowed =
      pathname === "/" ||
      pathname.startsWith("/camp") ||
      pathname.startsWith("/logout");

    if (!campBaseAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/camp";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/camp") && pathname !== "/camp") {
      const unlocked = request.cookies.get("camp_hub_ok")?.value === "1";
      if (!unlocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/camp";
        return NextResponse.redirect(url);
      }
    }
  }

  let routePerms: Array<{ route_path: string; allowed_roles: string[] }> = [];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: adminPerms } = await adminClient
      .from("route_permissions")
      .select("route_path,allowed_roles");
    routePerms = (adminPerms ?? []) as Array<{ route_path: string; allowed_roles: string[] }>;
  } else {
    const { data: userPerms } = await supabase
      .from("route_permissions")
      .select("route_path,allowed_roles");
    routePerms = (userPerms ?? []) as Array<{ route_path: string; allowed_roles: string[] }>;
  }

  const matchRoute = (path: string, pattern: string) => {
    if (pattern === path) return true;
    const pathParts = path.split("/").filter(Boolean);
    const patParts = pattern.split("/").filter(Boolean);
    if (pathParts.length !== patParts.length) return false;
    for (let i = 0; i < patParts.length; i += 1) {
      const seg = patParts[i];
      if (seg.startsWith(":")) continue;
      if (seg !== pathParts[i]) return false;
    }
    return true;
  };
  const matchRoutePrefix = (path: string, pattern: string) => {
    if (pattern === "/") return path === "/";
    if (!pattern || pattern === path) return false;
    if (!path.startsWith(pattern)) return false;
    return path.length === pattern.length || path[pattern.length] === "/";
  };

  let matchedPerm: { route_path: string; allowed_roles: string[] } | null = null;
  if (routePerms.length) {
    const matches = routePerms.filter((p) => {
      const pattern = String(p.route_path ?? "");
      return matchRoute(pathname, pattern) || matchRoutePrefix(pathname, pattern);
    });
    if (matches.length) {
      matches.sort((a: any, b: any) => String(b.route_path).length - String(a.route_path).length);
      matchedPerm = matches[0];
    }
  }

  if (matchedPerm) {
    const allowed = (matchedPerm.allowed_roles ?? []).map((r: any) => String(r).toLowerCase());
    const hasAccess = roleSet.has("admin") || allowed.some((r) => roleSet.has(r));
    const allowCheckinBypass =
      pathname === "/classroom/checkin" &&
      roleSet.has("checkin") &&
      !roleSet.has("admin");
    const allowClassroomHubBypass =
      pathname === "/classroom" &&
      roleSet.has("classroom") &&
      !roleSet.has("admin");
    if (!hasAccess && !allowCheckinBypass && !allowClassroomHubBypass) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const isCheckinOnlyUser =
    roleSet.has("checkin") &&
    !roleSet.has("admin") &&
    !roleSet.has("coach") &&
    !roleSet.has("classroom");

  if (isCheckinOnlyUser) {
    const allowed = pathname === "/classroom/checkin" || pathname.startsWith("/logout");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/classroom/checkin";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const isClassroomOnlyUser =
    roleSet.has("classroom") &&
    !roleSet.has("admin") &&
    !roleSet.has("coach") &&
    !roleSet.has("camp");

  if (isClassroomOnlyUser) {
    const allowed = pathname === "/classroom" || pathname === "/classroom/checkin" || pathname === "/student" || pathname.startsWith("/logout");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/classroom";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (pathname.startsWith("/admin") && !roleSet.has("admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if ((pathname.startsWith("/coach") || pathname.startsWith("/classroom")) && !["admin", "coach", "classroom"].some((r) => roleSet.has(r))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Apply middleware to everything except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
