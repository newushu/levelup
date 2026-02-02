"use client";

import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  image_url?: string | null;
  image_scale?: number | null;
  image_x?: number | null;
  image_y?: number | null;
  image_rotate?: number | null;
  border_style?: string | null;
  border_color?: string | null;
  template_key?: string | null;
  template_payload?: Record<string, any> | null;
  created_at: string;
};
type Coupon = {
  id: string;
  name: string;
  student_id: string;
  approved_at?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentMarketingCard() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(true);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [academyLogoUrl, setAcademyLogoUrl] = useState("");

  useEffect(() => {
    const onResize = () => setVisible(window.innerWidth >= 1200);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const res = await fetch("/api/marketing/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!mounted) return;
      if (!sj.ok) return setAnnouncement(null);
      const list = (sj.json?.announcements ?? []) as Announcement[];
      setAnnouncement(list[0] ?? null);
    }
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadLogo() {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!mounted || !sj.ok) return;
      setAcademyLogoUrl(String(sj.json?.logo_url ?? ""));
    }
    loadLogo();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadCoupon() {
      const res = await fetch("/api/parent/discounts/approved", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!mounted) return;
      if (!sj.ok) return setCoupon(null);
      const list = (sj.json?.coupons ?? []) as Coupon[];
      setCoupon(list[0] ?? null);
    }
    loadCoupon();
    const timer = window.setInterval(loadCoupon, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);


  if (!visible) return null;

  const border = resolveBorder(announcement?.border_style, announcement?.border_color);
  const templatePayload = normalizeTemplatePayload(announcement?.template_payload);
  const useTemplate = announcement?.template_key === "enroll_now";

  return (
    <div style={wrap(border)}>
      {coupon ? (
        <div style={couponCard()}>
          <div style={{ fontWeight: 1000 }}>Approved Discount</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{coupon.name}</div>
        </div>
      ) : null}
      <div style={{ fontWeight: 1000 }}>{announcement?.title ?? "Parent Spotlight"}</div>
      {useTemplate ? (
        renderEnrollTemplate(templatePayload, academyLogoUrl)
      ) : announcement?.image_url ? (
        <div style={imageWrap()}>
          <img
            src={announcement.image_url}
            alt={announcement.title || "Marketing"}
            style={image(announcement)}
          />
        </div>
      ) : null}
      <div style={{ opacity: 0.85, fontSize: 12 }}>
        {announcement?.message ?? "Weekly updates, promos, and family highlights will appear here."}
      </div>
    </div>
  );
}

function wrap(border?: React.CSSProperties): React.CSSProperties {
  return {
    position: "fixed",
    right: 18,
    top: 170,
    width: 320,
    minHeight: 420,
    borderRadius: 18,
    padding: "14px 14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(155deg, rgba(59,130,246,0.2), rgba(14,165,233,0.1)), rgba(10,14,20,0.92)",
    boxShadow: "0 18px 36px rgba(0,0,0,0.4)",
    display: "grid",
    gap: 6,
    zIndex: 60,
    ...(border ?? {}),
  };
}

function couponCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 10px",
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.15)",
    display: "grid",
    gap: 4,
  };
}


function imageWrap(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    background: "rgba(0,0,0,0.35)",
  };
}

function image(announcement: {
  image_scale?: number | null;
  image_x?: number | null;
  image_y?: number | null;
  image_rotate?: number | null;
}): React.CSSProperties {
  const scale = Number(announcement.image_scale ?? 1);
  const x = Number(announcement.image_x ?? 0);
  const y = Number(announcement.image_y ?? 0);
  const rotate = Number(announcement.image_rotate ?? 0);
  return {
    width: "100%",
    height: 160,
    objectFit: "cover",
    display: "block",
    transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
    transformOrigin: "center",
  };
}

function resolveBorder(style?: string | null, color?: string | null): React.CSSProperties {
  const hue = (color && color.trim()) || "";
  if (style === "none") {
    return { border: "1px solid transparent", boxShadow: "none" };
  }
  if (style === "neon") {
    return {
      border: `1px solid ${hue || "rgba(59,130,246,0.6)"}`,
      boxShadow: "0 0 20px rgba(59,130,246,0.35)",
    };
  }
  if (style === "sunset") {
    return {
      border: `1px solid ${hue || "rgba(251,146,60,0.7)"}`,
      boxShadow: "0 0 24px rgba(249,115,22,0.35)",
    };
  }
  if (style === "mint") {
    return {
      border: `1px solid ${hue || "rgba(16,185,129,0.7)"}`,
      boxShadow: "0 0 18px rgba(16,185,129,0.3)",
    };
  }
  return {
    border: `1px solid ${hue || "rgba(255,255,255,0.12)"}`,
    boxShadow: "0 18px 36px rgba(0,0,0,0.4)",
  };
}

function normalizeTemplatePayload(payload?: Record<string, any> | null) {
  return {
    theme: "winter",
    discount_amount: "25% OFF",
    discount_date: "Ends Dec 20",
    offer_title: "What's it for",
    offer_for: "Winter Enrollment Pass",
    cta_text: "Enroll Now",
    cta_url: "https://",
    logo_url: "",
    logo_x: 18,
    logo_y: 18,
    logo_box_size: 70,
    logo_image_scale: 1,
    logo_invert: false,
    badge_x: 18,
    badge_y: 120,
    badge_scale: 1,
    offer_x: 18,
    offer_y: 260,
    offer_scale: 1,
    cta_x: 18,
    cta_y: 310,
    cta_scale: 1,
    ...(payload ?? {}),
  };
}

function renderEnrollTemplate(
  payload: ReturnType<typeof normalizeTemplatePayload>,
  academyLogoUrl: string
) {
  const theme = themeStyles(payload.theme);
  const logoUrl = payload.logo_url || academyLogoUrl;
  return (
    <div style={templateShell(theme)}>
      <div style={templateGlow(theme)} />
      {theme.snow ? <div style={templateSnow()} /> : null}
      <div style={templateLogo(payload, theme)}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" style={templateLogoImage(payload)} />
        ) : (
          <div style={templateLogoFallback()}>Logo</div>
        )}
      </div>
      <div style={templateBadge(payload, theme)}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{payload.discount_amount}</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>{payload.discount_date}</div>
      </div>
      <div style={templateOffer(payload, theme)}>
        <div style={offerTitle()}>{payload.offer_title}</div>
        <div>{payload.offer_for}</div>
      </div>
      <a href={payload.cta_url || "#"} style={templateCta(payload, theme)} target="_blank" rel="noreferrer">
        {payload.cta_text}
      </a>
    </div>
  );
}

function themeStyles(theme: string) {
  if (theme === "winter") {
    return {
      bg: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(14,165,233,0.28))",
      accent: "rgba(56,189,248,0.95)",
      glow: "rgba(59,130,246,0.45)",
      snow: true,
    };
  }
  if (theme === "sunset") {
    return {
      bg: "linear-gradient(135deg, rgba(249,115,22,0.35), rgba(236,72,153,0.25))",
      accent: "rgba(249,115,22,0.75)",
      glow: "rgba(249,115,22,0.3)",
      snow: false,
    };
  }
  if (theme === "mint") {
    return {
      bg: "linear-gradient(135deg, rgba(16,185,129,0.32), rgba(45,212,191,0.18))",
      accent: "rgba(16,185,129,0.75)",
      glow: "rgba(16,185,129,0.3)",
      snow: false,
    };
  }
  return {
    bg: "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(99,102,241,0.2))",
    accent: "rgba(59,130,246,0.75)",
    glow: "rgba(59,130,246,0.3)",
    snow: false,
  };
}

function templateShell(theme: { bg: string; accent: string; snow?: boolean }): React.CSSProperties {
  return {
    position: "relative",
    borderRadius: 14,
    padding: 14,
    minHeight: 220,
    background: theme.bg,
    overflow: "hidden",
    border: `2px solid ${theme.accent}`,
    boxShadow: theme.snow ? "0 0 22px rgba(56,189,248,0.45)" : "0 0 16px rgba(0,0,0,0.25)",
  };
}

function templateGlow(theme: { glow: string }): React.CSSProperties {
  return {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: "50%",
    right: -60,
    top: -60,
    background: theme.glow,
    filter: "blur(12px)",
  };
}

function templateSnow(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1.5px), radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 2px), radial-gradient(circle, rgba(255,255,255,0.25) 2px, transparent 3px)",
    backgroundSize: "18px 18px, 32px 32px, 70px 70px",
    backgroundPosition: "0 0, 10px 12px, -10px -20px",
    opacity: 0.55,
    pointerEvents: "none",
  };
}

function templateLogo(payload: ReturnType<typeof normalizeTemplatePayload>, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.logo_x,
    top: payload.logo_y,
    width: payload.logo_box_size,
    height: payload.logo_box_size,
    borderRadius: 12,
    border: `1px solid ${theme.accent}`,
    background: "rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function templateLogoImage(payload: ReturnType<typeof normalizeTemplatePayload>): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${payload.logo_image_scale})`,
    filter: payload.logo_invert ? "invert(1)" : "none",
  };
}

function templateLogoFallback(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "white",
  };
}

function templateBadge(payload: ReturnType<typeof normalizeTemplatePayload>, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.badge_x,
    top: payload.badge_y,
    transform: `scale(${payload.badge_scale})`,
    transformOrigin: "left top",
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${theme.accent}`,
    background: "rgba(0,0,0,0.35)",
    color: "white",
  };
}

function templateOffer(payload: ReturnType<typeof normalizeTemplatePayload>, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.offer_x,
    top: payload.offer_y,
    transform: `scale(${payload.offer_scale})`,
    transformOrigin: "left top",
    fontSize: 12,
    fontWeight: 700,
    color: "white",
    textShadow: "0 4px 10px rgba(0,0,0,0.4)",
    borderLeft: `3px solid ${theme.accent}`,
    paddingLeft: 8,
  };
}

function offerTitle(): React.CSSProperties {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    opacity: 0.7,
  };
}

function templateCta(payload: ReturnType<typeof normalizeTemplatePayload>, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.cta_x,
    top: payload.cta_y,
    transform: `scale(${payload.cta_scale})`,
    transformOrigin: "left top",
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${theme.accent}`,
    background: theme.accent,
    color: "white",
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 10px 20px rgba(56,189,248,0.35)",
  };
}
