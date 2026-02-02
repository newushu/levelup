"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";
import AvatarRender from "@/components/AvatarRender";

type ContactInfo = {
  phone: string;
  location: string;
  website: string;
};

type BuilderKind = "email" | "flyer" | "code" | "avatar-border" | "avatar-effect" | "battle-pulse-effect";

type SavedProject = {
  id: string;
  name: string;
  kind: BuilderKind;
  data: any;
  theme_key?: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
};

type ProjectUsage = {
  useEmail: boolean;
  useWebsite: boolean;
  useOverlay: boolean;
  overlayAudience: string;
  overlayPlacement: string;
};

type CodeTextOverrides = Record<string, { value?: string; enabled?: boolean } | string>;
type CodeFontOverrides = Record<string, string>;
type CodeImageOverrides = Record<
  string,
  { src?: string; enabled?: boolean; width?: number; height?: number; x?: number; y?: number; scale?: number }
>;
type CodeOverrides = {
  textOverrides: CodeTextOverrides;
  fontOverrides: CodeFontOverrides;
  imageOverrides: CodeImageOverrides;
};

type SavedTheme = {
  id: string;
  name: string;
  kind: BuilderKind;
  data: any;
};

type AvatarBorderRow = {
  id?: string;
  key: string;
  name: string;
  image_url?: string | null;
  render_mode?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  unlock_level?: number | null;
  unlock_points?: number | null;
  enabled?: boolean;
};

type AvatarEffectRow = {
  id?: string;
  key: string;
  name: string;
  unlock_level?: number | null;
  unlock_points?: number | null;
  config?: {
    density?: number;
    size?: number;
    speed?: number;
    opacity?: number;
    scale?: number;
    scale_by_context?: Record<string, { scale?: number | null }>;
  };
  render_mode?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  enabled?: boolean;
};

type BattlePulseEffectRow = {
  id?: string;
  key: string;
  name: string;
  effect_type?: string | null;
  effect_types?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  enabled?: boolean;
};

function emptyCodeOverrides(): CodeOverrides {
  return {
    textOverrides: {},
    fontOverrides: {},
    imageOverrides: {},
  };
}

const defaultValues = {
  dojoName: "Your Dojo Name",
  dojoTag: "Martial Arts • Confidence • Discipline",
  promoAmount: "$100",
  promoUnit: "OFF",
  promoTopLabel: "SAVE",
  promoEndsLabel: "Ends",
  countdownDaysLabel: "DAYS",
  countdownHoursLabel: "HRS",
  countdownMinsLabel: "MIN",
  countdownSecsLabel: "SEC",
  endDate: "2026-02-05",
  countdownImageUrl: "",
  countdownHtml: "",
  eyebrow: "Winter Break Training",
  titleMain: "WINTER CAMP",
  titleAccent: "SIGN UP NOW",
  subtitle:
    "High-energy martial arts camp for kids & teens — stay active, build skills, and level up confidence this winter.",
  chips: "All Levels, Fun Drills, Safe & Structured, Limited Spots",
  pointsEnabled: true,
  pointsLabel: "Enrollment Bonus",
  pointsValue: "250",
  pointsSuffix: "points",
  ctaText: "Reserve a Spot",
  ctaUrl: "https://",
  discountPrefix: "Use code:",
  discountCode: "WINTER100",
  discountNote: "Applies to camp tuition",
  detailsTitle: "Camp Details",
  details: "Dates: Dec 26–30\nTime: 9:00 AM–1:00 PM\nAges: 6–14\nGear: Uniform optional",
  learnTitle: "What They’ll Learn",
  learn: "Striking & footwork basics\nDefensive movement & control\nForms / combos / coordination\nConfidence & focus training",
  contactLabelPhone: "Call / Text",
  contactLabelLocation: "Location",
  contactLabelWebsite: "Website",
  contact: {
    phone: "(555) 123-4567",
    location: "123 Main St",
    website: "yourdojowebsite.com",
  } as ContactInfo,
  footerLeft: "Spots fill fast — lock in your discount today.",
  footerTags: "WINTER CAMP, LIMITED SEATS",
  logoUrl: "",
  logoFallbackText: "武",
  logoImageScale: 1,
  logoInvert: false,
  accentHue: 190,
  theme: "winter",
  useCodeTemplate: false,
  codeTemplateKey: "",
  codeOverrides: emptyCodeOverrides(),
  promoWidth: 0,
  promoHeight: 0,
  ctaWidth: 0,
  ctaHeight: 0,
  pointsWidth: 0,
  pointsHeight: 0,
  detailsWidth: 0,
  detailsHeight: 0,
  containerBgColor: "#0b1020",
  containerBgOpacity: 0,
  containerEnabled: false,
  textColor: "#eaf2ff",
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoScale: 1,
  logoBoxWidth: 72,
  logoBoxHeight: 72,
  promoOffsetX: 0,
  promoOffsetY: 0,
  promoScale: 1,
  ctaOffsetX: 0,
  ctaOffsetY: 0,
  ctaScale: 1,
  pointsOffsetX: 0,
  pointsOffsetY: 0,
  pointsScale: 1,
  pointsBorderColor: "rgba(191,231,255,0.75)",
  pointsSize: 1,
  heroOffsetX: 0,
  heroOffsetY: 0,
  heroScale: 1,
  detailsOffsetX: 0,
  detailsOffsetY: 0,
  detailsScale: 1,
};

const AVATAR_CONTEXT_PREVIEWS = [
  { label: "Dashboard", key: "dashboard", size: 150 },
  { label: "Student Picker", key: "student_picker", size: 120 },
  { label: "Live Activity", key: "live_activity", size: 110 },
  { label: "Battle Pulse", key: "battle_pulse", size: 100 },
  { label: "Skill Pulse", key: "skill_pulse", size: 110 },
  { label: "Skill Pulse Tracker", key: "skill_pulse_tracker", size: 110 },
  { label: "Classroom", key: "classroom", size: 120 },
];

const defaultFlyer = {
  title: "SPRING TRAINING CAMP",
  subtitle: "Fresh season, new skills. Join our spring break sessions.",
  logoUrl: "",
  logoFallbackText: "LOGO",
  backgroundImage: "",
  backgroundColor: "#0b1020",
  texture: "snow",
  textureAnimated: true,
  edgeSoftness: 22,
  maskShape: "soft-rect",
  maskFeather: 24,
  borderColor: "#7cf7d4",
  size: "portrait",
  discountEnabled: true,
  discountText: "SAVE $75",
  ctaText: "Enroll Now",
  ctaUrl: "https://",
  pointsEnabled: true,
  pointsLabel: "Enrollment Bonus",
  pointsValue: "250",
  pointsSuffix: "points",
  useCodeTemplate: false,
  codeTemplateKey: "",
  codeOverrides: emptyCodeOverrides(),
  containerBgColor: "#0b1020",
  containerBgOpacity: 0,
  containerEnabled: false,
  textColor: "#ffffff",
  bgPosX: 50,
  bgPosY: 50,
  bgSizeX: 100,
  bgSizeY: 100,
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoScale: 1,
  logoBoxSize: 120,
  logoImageScale: 1,
  logoInvert: false,
  discountOffsetX: 0,
  discountOffsetY: 0,
  discountScale: 1,
  discountWidth: 0,
  discountHeight: 0,
  ctaOffsetX: 0,
  ctaOffsetY: 0,
  ctaScale: 1,
  ctaWidth: 0,
  ctaHeight: 0,
  pointsOffsetX: 0,
  pointsOffsetY: 0,
  pointsScale: 1,
  pointsBorderColor: "rgba(255,255,255,0.35)",
  pointsSize: 1,
  pointsWidth: 0,
  pointsHeight: 0,
  contentOffsetX: 0,
  contentOffsetY: 0,
  contentScale: 1,
  logoBoxWidth: 0,
  logoBoxHeight: 0,
};

const defaultCode = {
  html: "<div class=\"card\">Edit this HTML</div>",
  css: ".card{font-family: 'Bebas Neue', sans-serif; font-size:28px; color:#0f172a; padding:24px; border-radius:16px; background:#e0f2fe; border:2px solid #38bdf8;}",
  js: "",
  originalHtml: "",
  originalCss: "",
  originalJs: "",
  target: "email",
  textOverrides: {} as CodeTextOverrides,
  fontOverrides: {} as CodeFontOverrides,
  imageOverrides: {} as CodeImageOverrides,
};

const emailThemePresets: Record<string, Partial<typeof defaultValues>> = {
  winter: { accentHue: 190 },
  spring: { accentHue: 150 },
  summer: { accentHue: 200 },
  inferno: { accentHue: 20 },
  spotlight: { accentHue: 270 },
};

const flyerThemePresets: Record<string, Partial<typeof defaultFlyer>> = {
  spring: {
    backgroundColor: "#0c2b1e",
    borderColor: "#6ee7b7",
    texture: "noise",
    textureAnimated: true,
  },
  summer: {
    backgroundColor: "#0c1b3a",
    borderColor: "#60a5fa",
    texture: "rays",
    textureAnimated: true,
  },
  inferno: {
    backgroundColor: "#2a0b0b",
    borderColor: "#f97316",
    texture: "rays",
    textureAnimated: true,
  },
  spotlight: {
    backgroundColor: "#150b2b",
    borderColor: "#facc15",
    texture: "noise",
    textureAnimated: false,
  },
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function defaultUsage(kind: BuilderKind): ProjectUsage {
  return {
    useEmail: kind === "email",
    useWebsite: false,
    useOverlay: false,
    overlayAudience: "parents",
    overlayPlacement: "login",
  };
}

function normalizeCodeOverrides(overrides?: Partial<CodeOverrides> | null): CodeOverrides {
  return {
    textOverrides: { ...(overrides?.textOverrides ?? {}) },
    fontOverrides: { ...(overrides?.fontOverrides ?? {}) },
    imageOverrides: { ...(overrides?.imageOverrides ?? {}) },
  };
}

function mergeCodeTemplate(
  template: typeof defaultCode,
  overrides: Partial<CodeOverrides> | null | undefined,
  target: "email" | "digital",
) {
  const base = { ...defaultCode, ...template, target };
  const normalized = normalizeCodeOverrides(overrides);
  return {
    ...base,
    textOverrides: { ...(base.textOverrides ?? {}), ...normalized.textOverrides },
    fontOverrides: { ...(base.fontOverrides ?? {}), ...normalized.fontOverrides },
    imageOverrides: { ...(base.imageOverrides ?? {}), ...normalized.imageOverrides },
  };
}

function extractTextCandidates(html: string) {
  if (typeof window === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const items: Array<{ id: string; text: string }> = [];
  let node: Node | null;
  let index = 0;
  while ((node = walker.nextNode())) {
    const value = (node.nodeValue || "").trim();
    if (!value) {
      index += 1;
      continue;
    }
    const id = `${index}::${value}`;
    items.push({ id, text: value });
    index += 1;
  }
  return items;
}

function extractImageCandidates(html: string) {
  if (typeof window === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const items: Array<{ id: string; src: string; alt: string; isLogo: boolean }> = [];
  const imgs = Array.from(doc.querySelectorAll("img"));
  imgs.forEach((img, index) => {
    const src = img.getAttribute("src") || "";
    const alt = img.getAttribute("alt") || "";
    const className = img.getAttribute("class") || "";
    const isLogo = /logo/i.test(alt + " " + className);
    items.push({ id: `img-${index}`, src, alt, isLogo });
  });
  return items;
}

function extractFontCandidates(css: string) {
  const fonts = new Set<string>();
  const regex = /font-family\s*:\s*([^;]+);/gi;
  let match;
  while ((match = regex.exec(css || ""))) {
    const raw = match[1].trim();
    if (raw) fonts.add(raw);
  }
  return Array.from(fonts);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyTextOverrides(
  html: string,
  overrides: Record<string, { value?: string; enabled?: boolean } | string> | undefined | null,
  editable = false,
) {
  if (typeof window === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Node[] = [];
  let node: Node | null;
  let index = 0;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }
  nodes.forEach((current) => {
    const value = (current.nodeValue || "").trim();
    if (!value) {
      index += 1;
      return;
    }
    const id = `${index}::${value}`;
    const raw = (overrides ?? {})[id];
    let nextValue = value;
    let enabled = true;
    if (raw !== undefined) {
      if (typeof raw === "string") {
        nextValue = raw;
      } else if (raw.enabled === false) {
        enabled = false;
        nextValue = "";
      } else if (raw.value !== undefined && raw.value !== "") {
        nextValue = raw.value;
      }
    }
    if (editable) {
      const span = doc.createElement("span");
      span.setAttribute("data-scope", "code");
      span.setAttribute("data-field", id);
      span.setAttribute("contenteditable", "true");
      if (!enabled) {
        span.setAttribute("data-disabled", "true");
      }
      span.className = "inline-edit";
      span.textContent = enabled ? nextValue : value;
      current.parentNode?.replaceChild(span, current);
    } else if (!enabled) {
      current.nodeValue = "";
    } else {
      current.nodeValue = nextValue;
    }
    index += 1;
  });
  return doc.body.innerHTML;
}

function applyFontOverrides(css: string, overrides: Record<string, string> | undefined | null) {
  let output = css;
  Object.entries(overrides ?? {}).forEach(([original, value]) => {
    if (!value || value === original) return;
    const pattern = new RegExp(escapeRegExp(original), "g");
    output = output.replace(pattern, value);
  });
  return output;
}

function applyImageOverrides(
  html: string,
  overrides: Record<
    string,
    { src?: string; enabled?: boolean; width?: number; height?: number; x?: number; y?: number; scale?: number }
  > | undefined | null,
) {
  if (typeof window === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));
  imgs.forEach((img, index) => {
    const id = `img-${index}`;
    const override = (overrides ?? {})[id];
    if (!override) return;
    if (override.enabled === false) {
      img.remove();
      return;
    }
    if (override.src) img.setAttribute("src", override.src);
    const styles: string[] = [];
    if (override.width) styles.push(`width:${override.width}px`);
    if (override.height) styles.push(`height:${override.height}px`);
    const scale = Number.isFinite(override.scale) ? override.scale : 1;
    const x = Number.isFinite(override.x) ? override.x : 0;
    const y = Number.isFinite(override.y) ? override.y : 0;
    if (scale !== 1 || x !== 0 || y !== 0) {
      styles.push(`transform: translate(${x}px, ${y}px) scale(${scale})`);
      styles.push("transform-origin: top left");
      styles.push("display:inline-block");
    }
    if (styles.length) {
      const existing = img.getAttribute("style") || "";
      img.setAttribute("style", `${existing};${styles.join(";")}`);
    }
  });
  return doc.body.innerHTML;
}

function emailVars(state: typeof defaultValues): Record<string, string> {
  const sizeOrAuto = (value: number) => (value ? `${value}px` : "auto");
  return {
    "--container-bg": state.containerBgColor,
    "--container-opacity": String(state.containerEnabled ? state.containerBgOpacity : 0),
    "--text-color": state.textColor,
    "--logo-x": `${state.logoOffsetX}px`,
    "--logo-y": `${state.logoOffsetY}px`,
    "--logo-scale": String(state.logoScale),
    "--logo-box-w": `${state.logoBoxWidth}px`,
    "--logo-box-h": `${state.logoBoxHeight}px`,
    "--promo-x": `${state.promoOffsetX}px`,
    "--promo-y": `${state.promoOffsetY}px`,
    "--promo-scale": String(state.promoScale),
    "--promo-w": sizeOrAuto(state.promoWidth),
    "--promo-h": sizeOrAuto(state.promoHeight),
    "--cta-x": `${state.ctaOffsetX}px`,
    "--cta-y": `${state.ctaOffsetY}px`,
    "--cta-scale": String(state.ctaScale),
    "--cta-w": sizeOrAuto(state.ctaWidth),
    "--cta-h": sizeOrAuto(state.ctaHeight),
    "--points-x": `${state.pointsOffsetX}px`,
    "--points-y": `${state.pointsOffsetY}px`,
    "--points-scale": String(state.pointsScale),
    "--points-border": state.pointsBorderColor,
    "--points-size": String(state.pointsSize),
    "--points-w": sizeOrAuto(state.pointsWidth),
    "--points-h": sizeOrAuto(state.pointsHeight),
    "--hero-x": `${state.heroOffsetX}px`,
    "--hero-y": `${state.heroOffsetY}px`,
    "--hero-scale": String(state.heroScale),
    "--details-x": `${state.detailsOffsetX}px`,
    "--details-y": `${state.detailsOffsetY}px`,
    "--details-scale": String(state.detailsScale),
    "--details-w": sizeOrAuto(state.detailsWidth),
    "--details-h": sizeOrAuto(state.detailsHeight),
  };
}

function styleString(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function buildCodePreviewHtml(code: typeof defaultCode, options?: { editable?: boolean }) {
  const helperCss = options?.editable
    ? `
  .inline-edit{
    outline: 1px dashed rgba(124,247,212,0.55);
    outline-offset: 2px;
    border-radius: 8px;
    padding: 2px 6px;
    background: rgba(124,247,212,0.08);
    cursor: text;
    pointer-events: auto;
    user-select: text;
  }
  .inline-edit[data-disabled="true"]{
    opacity: 0.45;
  }
  .inline-active{
    outline: 6px solid rgba(124,247,212,0.9);
  }
  `
    : "";
  const html = applyImageOverrides(
    applyTextOverrides(code.html, code.textOverrides, options?.editable),
    code.imageOverrides,
  );
  const css = applyFontOverrides(code.css, code.fontOverrides);
  return `<style>${css}\n${helperCss}</style>${html}`;
}

function buildCodePreviewDocument(code: typeof defaultCode) {
  const html = applyImageOverrides(applyTextOverrides(code.html, code.textOverrides, false), code.imageOverrides);
  const css = applyFontOverrides(code.css, code.fontOverrides);
  const js = code.target === "digital" ? code.js : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${html}${
    js ? `<script>${js}</script>` : ""
  }</body></html>`;
}

function collectStringTokens(value: any, tokens: string[], limit = 40) {
  if (tokens.length >= limit) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) tokens.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringTokens(item, tokens, limit));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStringTokens(item, tokens, limit));
  }
}

function projectKeywords(project: SavedProject, themes: SavedTheme[], codeThemes: SavedTheme[]) {
  const tokens: string[] = [];
  tokens.push(project.name || "");
  if (project.theme_key) {
    const theme = themes.find((t) => t.id === project.theme_key) || codeThemes.find((t) => t.id === project.theme_key);
    if (theme?.name) tokens.push(theme.name);
  }
  collectStringTokens(project.data ?? {}, tokens, 30);
  return tokens
    .flatMap((item) => item.split(/[\n,]+/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCodeTemplate(
  key: string,
  codeProjects: SavedProject[],
  codeThemes: SavedTheme[],
) {
  if (!key) return null;
  if (key.startsWith("theme:")) {
    const id = key.slice("theme:".length);
    return codeThemes.find((theme) => theme.id === id)?.data ?? null;
  }
  if (key.startsWith("project:")) {
    const id = key.slice("project:".length);
    return codeProjects.find((proj) => proj.id === id)?.data ?? null;
  }
  return null;
}

export default function EmailBuilderPage() {
  return (
    <AuthGate>
      <EmailBuilderInner />
    </AuthGate>
  );
}

function EmailBuilderInner() {
  const searchParams = useSearchParams();
  const [builderTab, setBuilderTab] = useState<BuilderKind>("email");
  const [emailState, setEmailState] = useState(defaultValues);
  const [flyerState, setFlyerState] = useState(defaultFlyer);
  const [codeState, setCodeState] = useState(defaultCode);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [themes, setThemes] = useState<SavedTheme[]>([]);
  const [codeProjects, setCodeProjects] = useState<SavedProject[]>([]);
  const [codeThemes, setCodeThemes] = useState<SavedTheme[]>([]);
  const [avatarBorders, setAvatarBorders] = useState<AvatarBorderRow[]>([]);
  const [avatarEffects, setAvatarEffects] = useState<AvatarEffectRow[]>([]);
  const [battlePulseEffects, setBattlePulseEffects] = useState<BattlePulseEffectRow[]>([]);
  const [activeBorderId, setActiveBorderId] = useState("");
  const [activeEffectId, setActiveEffectId] = useState("");
  const [activeBattleEffectId, setActiveBattleEffectId] = useState("");
  const [projectUsage, setProjectUsage] = useState<ProjectUsage>(() => defaultUsage("email"));
  const [flyerUploading, setFlyerUploading] = useState(false);
  const [codeUploading, setCodeUploading] = useState(false);
  const [navLogoUrl, setNavLogoUrl] = useState("");
  const [activeField, setActiveField] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("New Project");
  const [activeThemeId, setActiveThemeId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const borderPreviewRef = useRef<HTMLDivElement | null>(null);
  const effectPreviewRef = useRef<HTMLDivElement | null>(null);
  const battleEffectPreviewRef = useRef<HTMLDivElement | null>(null);
  const borderDragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const borderDragContextRef = useRef<string>("builder");
  const [borderDragging, setBorderDragging] = useState(false);
  const battleEffectDragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [battleEffectDragging, setBattleEffectDragging] = useState(false);

  const [borderDraft, setBorderDraft] = useState<AvatarBorderRow>({
    key: "",
    name: "",
    render_mode: "code",
    offset_x: 0,
    offset_y: 0,
    offsets_by_context: { builder: { x: 0, y: 0, scale: 1 } },
    html: "<div class=\"avatar-border\">Border</div>",
    css: ".avatar-border{width:100%;height:100%;border:3px solid #7cf7d4;border-radius:18px;box-shadow:0 0 24px rgba(124,247,212,0.35);}",
    js: "",
    unlock_level: 1,
    unlock_points: 0,
    enabled: true,
  });
  const [effectDraft, setEffectDraft] = useState<AvatarEffectRow>({
    key: "",
    name: "",
    render_mode: "particles",
    config: { density: 40, size: 6, speed: 6, opacity: 70, scale: 1, scale_by_context: { builder: { scale: 1 } } },
    html: "<div class=\"avatar-bg\"></div>",
    css: ".avatar-bg{width:100%;height:100%;background:radial-gradient(circle at 20% 20%, rgba(59,130,246,0.4), transparent 60%), radial-gradient(circle at 80% 70%, rgba(34,197,94,0.35), transparent 55%);}",
    js: "",
    unlock_level: 1,
    unlock_points: 0,
    enabled: true,
  });
  const [battleEffectDraft, setBattleEffectDraft] = useState<BattlePulseEffectRow>({
    key: "",
    name: "",
    effect_type: "attack",
    effect_types: "attack",
    offset_x: 0,
    offset_y: 0,
    html: "<div class=\"bombardment\"><canvas class=\"fx\"></canvas></div>",
    css: `.bombardment{position:absolute;inset:0;border-radius:18px;overflow:hidden;pointer-events:none;}
.bombardment canvas{position:absolute;inset:0;width:100%;height:100%;display:block;mix-blend-mode:screen;opacity:.9;}`,
    js: `(() => {
  const wrap = document.querySelector(".bombardment");
  const canvas = wrap ? wrap.querySelector("canvas") : null;
  if (!wrap || !canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const { width, height } = wrap.getBoundingClientRect();
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  let W = 0, H = 0;
  function onResize() {
    const r = resizeCanvas();
    W = r.width; H = r.height;
  }
  onResize();
  window.addEventListener("resize", onResize);

  let running = false;
  let rafId = 0;
  let lastT = 0;
  let shake = 0;
  const fireballs = [];
  const particles = [];

  const CFG = {
    spawnRate: 3.0,
    maxFireballs: 18,
    gravity: 1300,
    wind: 80,
    trailParticles: 6,
    impactBurst: 42,
    smokeBurst: 14,
    sparkBurst: 22,
  };

  function spawnFireball(x = rand(0.15, 0.85) * W) {
    if (fireballs.length >= CFG.maxFireballs) return;
    const y = -rand(30, 120);
    const speedY = rand(520, 850);
    const speedX = rand(-CFG.wind, CFG.wind);
    fireballs.push({
      x, y,
      vx: speedX,
      vy: speedY,
      r: rand(7, 12),
      heat: rand(0.7, 1.0),
      rot: rand(0, Math.PI * 2),
      spin: rand(-3, 3),
    });
  }

  function addParticle(p) {
    particles.push(p);
  }

  function explosion(x, y, power = 1) {
    const n = Math.floor(CFG.impactBurst * power);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(220, 820) * power;
      addParticle({
        type: "ember",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(2.0, 4.5) * power,
        life: rand(0.35, 0.75),
        t: 0,
        heat: rand(0.8, 1.2),
      });
    }

    const s = Math.floor(CFG.sparkBurst * power);
    for (let i = 0; i < s; i++) {
      const a = rand(-Math.PI, 0);
      const sp = rand(500, 1400) * power;
      addParticle({
        type: "spark",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(1.0, 2.0),
        life: rand(0.15, 0.35),
        t: 0,
      });
    }

    const m = Math.floor(CFG.smokeBurst * power);
    for (let i = 0; i < m; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 220) * power;
      addParticle({
        type: "smoke",
        x: x + rand(-8, 8),
        y: y + rand(-8, 8),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(80, 160),
        r: rand(10, 22) * power,
        life: rand(0.7, 1.4),
        t: 0,
      });
    }

    shake = Math.max(shake, 10 * power);
  }

  function drawGlowCircle(x, y, r, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, \`rgba(255,240,200,\${alpha})\`);
    g.addColorStop(0.35, \`rgba(255,160,60,\${alpha * 0.9})\`);
    g.addColorStop(0.75, \`rgba(255,60,0,\${alpha * 0.35})\`);
    g.addColorStop(1, \`rgba(255,60,0,0)\`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function clear(dt) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = \`rgba(0,0,0,\${clamp(0.18 + dt * 0.12, 0.12, 0.28)})\`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  let spawnAcc = 0;
  function step(t) {
    if (!running) return;
    const now = t * 0.001;
    const dt = Math.min(0.033, now - lastT || 0.016);
    lastT = now;

    spawnAcc += dt * CFG.spawnRate;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      spawnFireball();
    }

    shake = Math.max(0, shake - dt * 18);
    clear(dt);

    ctx.save();
    if (shake > 0.001) {
      const sx = rand(-shake, shake) * 0.3;
      const sy = rand(-shake, shake) * 0.3;
      ctx.translate(sx, sy);
    }

    for (let i = fireballs.length - 1; i >= 0; i--) {
      const b = fireballs[i];
      b.vy += CFG.gravity * dt;
      b.vx += rand(-20, 20) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;

      const trailCount = Math.floor(CFG.trailParticles * (dt / 0.016));
      for (let k = 0; k < trailCount; k++) {
        addParticle({
          type: "trail",
          x: b.x + rand(-b.r * 0.2, b.r * 0.2),
          y: b.y + rand(-b.r * 0.2, b.r * 0.2),
          vx: -b.vx * rand(0.05, 0.12),
          vy: -b.vy * rand(0.05, 0.12),
          r: rand(2.5, 5.0) * b.heat,
          life: rand(0.12, 0.22),
          t: 0,
          heat: b.heat
        });
      }

      if (b.y + b.r >= H - 2) {
        explosion(clamp(b.x, 8, W - 8), H - 4, rand(0.85, 1.25));
        fireballs.splice(i, 1);
        continue;
      }

      ctx.globalCompositeOperation = "lighter";
      drawGlowCircle(b.x, b.y, b.r * 3.2, 0.35 * b.heat);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = "rgba(255,220,160,0.95)";
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,110,30,0.75)";
      ctx.beginPath();
      ctx.arc(-b.r * 0.2, -b.r * 0.2, b.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = "source-over";
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      const life = p.life;
      const u = p.t / life;
      if (u >= 1) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === "smoke") {
        p.vx *= (1 - dt * 0.7);
        p.vy *= (1 - dt * 0.6);
        p.vy -= 40 * dt;
        p.r *= (1 + dt * 0.35);
      } else if (p.type === "spark") {
        p.vy += CFG.gravity * 0.35 * dt;
        p.vx *= (1 - dt * 2.8);
        p.vy *= (1 - dt * 2.2);
      } else {
        p.vy += CFG.gravity * 0.2 * dt;
        p.vx *= (1 - dt * 1.6);
        p.vy *= (1 - dt * 1.3);
      }

      if (p.x < -200 || p.x > W + 200 || p.y < -250 || p.y > H + 250) {
        particles.splice(i, 1);
        continue;
      }

      const fade = 1 - u;
      if (p.type === "trail") {
        ctx.globalCompositeOperation = "lighter";
        drawGlowCircle(p.x, p.y, p.r * 2.0, 0.18 * fade * (p.heat || 1));
        ctx.globalCompositeOperation = "source-over";
      } else if (p.type === "ember") {
        ctx.globalCompositeOperation = "lighter";
        drawGlowCircle(p.x, p.y, p.r * 3.0, 0.22 * fade);
        ctx.fillStyle = \`rgba(255,210,140,\${0.8 * fade})\`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.55 + 0.25 * (1 - u)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.type === "spark") {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = \`rgba(255,255,240,\${0.85 * fade})\`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.type === "smoke") {
        ctx.globalCompositeOperation = "source-over";
        const a = 0.22 * fade;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, \`rgba(80,80,90,\${a})\`);
        g.addColorStop(0.6, \`rgba(50,50,60,\${a * 0.7})\`);
        g.addColorStop(1, "rgba(20,20,30,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = 0;
    for (let i = 0; i < 3; i++) spawnFireball(rand(0.15, 0.85) * W);
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onResize();
    fireballs.length = 0;
    particles.length = 0;
  }

  start();
  window.FireballFX = { start, stop };
})();`,
    enabled: true,
  });
  const builderTabRef = useRef<BuilderKind>(builderTab);
  const emailUsesCodeRef = useRef<boolean>(emailState.useCodeTemplate);
  const flyerUsesCodeRef = useRef<boolean>(flyerState.useCodeTemplate);

  useEffect(() => {
    builderTabRef.current = builderTab;
  }, [builderTab]);

  useEffect(() => {
    emailUsesCodeRef.current = emailState.useCodeTemplate;
  }, [emailState.useCodeTemplate]);

  useEffect(() => {
    flyerUsesCodeRef.current = flyerState.useCodeTemplate;
  }, [flyerState.useCodeTemplate]);

  useEffect(() => {
    if (!activeBorderId) return;
    const row = avatarBorders.find((border) => String(border.id ?? "") === activeBorderId);
    if (row) {
      setBorderDraft({
        key: row.key ?? "",
        name: row.name ?? "",
        image_url: row.image_url ?? "",
        render_mode: row.render_mode ?? "image",
        offset_x: Number(row.offset_x ?? 0),
        offset_y: Number(row.offset_y ?? 0),
        offsets_by_context: row.offsets_by_context ?? {},
        html: row.html ?? "",
        css: row.css ?? "",
        js: row.js ?? "",
        unlock_level: row.unlock_level ?? 1,
        unlock_points: row.unlock_points ?? 0,
        enabled: row.enabled !== false,
        id: row.id,
      });
    }
  }, [activeBorderId, avatarBorders]);

  useEffect(() => {
    if (!activeEffectId) return;
    const row = avatarEffects.find((effect) => String(effect.id ?? "") === activeEffectId);
    if (row) {
      setEffectDraft({
        key: row.key ?? "",
        name: row.name ?? "",
        render_mode: row.render_mode ?? "particles",
        config: row.config ?? { density: 40, size: 6, speed: 6, opacity: 70 },
        html: row.html ?? "",
        css: row.css ?? "",
        js: row.js ?? "",
        unlock_level: row.unlock_level ?? 1,
        unlock_points: row.unlock_points ?? 0,
        enabled: row.enabled !== false,
        id: row.id,
      });
    }
  }, [activeEffectId, avatarEffects]);

  useEffect(() => {
    if (!activeBattleEffectId) return;
    const row = battlePulseEffects.find((effect) => String(effect.id ?? "") === activeBattleEffectId);
    if (row) {
      setBattleEffectDraft({
        key: row.key ?? "",
        name: row.name ?? "",
        effect_type: row.effect_type ?? "attack",
        effect_types: row.effect_types ?? row.effect_type ?? "attack",
        offset_x: row.offset_x ?? 0,
        offset_y: row.offset_y ?? 0,
        html: row.html ?? "",
        css: row.css ?? "",
        js: row.js ?? "",
        enabled: row.enabled !== false,
        id: row.id,
      });
    }
  }, [activeBattleEffectId, battlePulseEffects]);

  const focusInline = (scope: "email" | "flyer" | "code", field: string) => {
    setActiveField(`${scope}:${field}`);
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll(".inline-active").forEach((el) => el.classList.remove("inline-active"));
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(field) : field.replace(/["\\]/g, "\\$&");
    const target = root.querySelector(
      `[data-scope="${scope}"][data-field="${escaped}"]`,
    ) as HTMLElement | null;
    if (target) target.classList.add("inline-active");
    requestAnimationFrame(() => {
      const panelTarget = document.querySelector(
        `[data-field-control="${scope}:${escaped}"]`,
      ) as HTMLElement | null;
      panelTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      const logoUrl = String(sj.json?.logo_url ?? "");
      setNavLogoUrl(logoUrl);
      setEmailState((prev) => ({ ...prev, logoUrl: prev.logoUrl || logoUrl }));
      setFlyerState((prev) => ({ ...prev, logoUrl: prev.logoUrl || logoUrl }));
    })();
  }, []);

  useEffect(() => {
    setProjectUsage(defaultUsage(builderTab));
  }, [builderTab]);

  useEffect(() => {
    const tab = String(searchParams.get("tab") ?? "").trim();
    if (!tab) return;
    if (tab === "email" || tab === "flyer" || tab === "code" || tab === "avatar-border" || tab === "avatar-effect" || tab === "battle-pulse-effect") {
      setBuilderTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const borderId = String(searchParams.get("border") ?? "").trim();
    if (borderId) setActiveBorderId(borderId);
    const effectId = String(searchParams.get("effect") ?? "").trim();
    if (effectId) setActiveEffectId(effectId);
    const battleEffectId = String(searchParams.get("battleEffect") ?? "").trim();
    if (battleEffectId) setActiveBattleEffectId(battleEffectId);
  }, [searchParams]);

  const emailPreviewHtml = useMemo(() => buildEmailHtml(emailState), [emailState]);
  const flyerPreviewHtml = useMemo(() => buildFlyerHtml(flyerState), [flyerState]);
  const codeTextCandidates = useMemo(() => extractTextCandidates(codeState.html), [codeState.html]);
  const codeImageCandidates = useMemo(() => extractImageCandidates(codeState.html), [codeState.html]);
  const codeFontCandidates = useMemo(() => extractFontCandidates(codeState.css), [codeState.css]);
  const codePreviewHtml = useMemo(() => buildCodePreviewHtml(codeState, { editable: true }), [codeState]);
  const codePreviewDoc = useMemo(() => buildCodePreviewDocument(codeState), [codeState]);
  const resolvedEmailTemplate = useMemo(
    () => resolveCodeTemplate(emailState.codeTemplateKey, codeProjects, codeThemes),
    [emailState.codeTemplateKey, codeProjects, codeThemes],
  );
  const resolvedFlyerTemplate = useMemo(
    () => resolveCodeTemplate(flyerState.codeTemplateKey, codeProjects, codeThemes),
    [flyerState.codeTemplateKey, codeProjects, codeThemes],
  );
  const emailCodeState = useMemo(
    () =>
      resolvedEmailTemplate
        ? mergeCodeTemplate(resolvedEmailTemplate, emailState.codeOverrides, "email")
        : null,
    [resolvedEmailTemplate, emailState.codeOverrides],
  );
  const flyerCodeState = useMemo(
    () =>
      resolvedFlyerTemplate
        ? mergeCodeTemplate(resolvedFlyerTemplate, flyerState.codeOverrides, "email")
        : null,
    [resolvedFlyerTemplate, flyerState.codeOverrides],
  );
  const emailCodeTextCandidates = useMemo(
    () => extractTextCandidates(emailCodeState?.html ?? ""),
    [emailCodeState?.html],
  );
  const emailCodeImageCandidates = useMemo(
    () => extractImageCandidates(emailCodeState?.html ?? ""),
    [emailCodeState?.html],
  );
  const emailCodeFontCandidates = useMemo(
    () => extractFontCandidates(emailCodeState?.css ?? ""),
    [emailCodeState?.css],
  );
  const flyerCodeTextCandidates = useMemo(
    () => extractTextCandidates(flyerCodeState?.html ?? ""),
    [flyerCodeState?.html],
  );
  const flyerCodeImageCandidates = useMemo(
    () => extractImageCandidates(flyerCodeState?.html ?? ""),
    [flyerCodeState?.html],
  );
  const flyerCodeFontCandidates = useMemo(
    () => extractFontCandidates(flyerCodeState?.css ?? ""),
    [flyerCodeState?.css],
  );
  const emailTemplateHtml = useMemo(
    () => (emailCodeState ? buildCodePreviewHtml(emailCodeState, { editable: true }) : ""),
    [emailCodeState],
  );
  const flyerTemplateHtml = useMemo(
    () => (flyerCodeState ? buildCodePreviewHtml(flyerCodeState, { editable: true }) : ""),
    [flyerCodeState],
  );
  const emailOutputHtml =
    emailState.useCodeTemplate && emailCodeState
      ? buildCodePreviewHtml(emailCodeState)
      : emailPreviewHtml;
  const flyerOutputHtml =
    flyerState.useCodeTemplate && flyerCodeState
      ? buildCodePreviewHtml(flyerCodeState)
      : flyerPreviewHtml;
  const state = emailState;
  const isEmail = builderTab === "email";
  useEffect(() => {
    const target = borderPreviewRef.current;
    if (!target) return;
    if (borderDraft.render_mode !== "code") {
      target.innerHTML = "";
      return;
    }
    target.innerHTML = `<style>${borderDraft.css ?? ""}</style>${borderDraft.html ?? ""}`;
    if (borderDraft.js?.trim()) {
      const script = document.createElement("script");
      script.text = `try{\n${borderDraft.js}\n}catch(e){console.error("Avatar border code error", e);}`;
      target.appendChild(script);
    }
    return () => {
      target.innerHTML = "";
    };
  }, [borderDraft.render_mode, borderDraft.html, borderDraft.css, borderDraft.js]);

  useEffect(() => {
    const target = effectPreviewRef.current;
    if (!target) return;
    if (effectDraft.render_mode !== "code") {
      target.innerHTML = "";
      return;
    }
    target.innerHTML = `<style>${effectDraft.css ?? ""}</style>${effectDraft.html ?? ""}`;
    if (effectDraft.js?.trim()) {
      const script = document.createElement("script");
      script.text = `try{\n${effectDraft.js}\n}catch(e){console.error("Avatar background code error", e);}`;
      target.appendChild(script);
    }
    return () => {
      target.innerHTML = "";
    };
  }, [effectDraft.render_mode, effectDraft.html, effectDraft.css, effectDraft.js]);

  useEffect(() => {
    const target = battleEffectPreviewRef.current;
    if (!target) return;
    target.innerHTML = `<style>${battleEffectDraft.css ?? ""}</style>${battleEffectDraft.html ?? ""}`;
    if (battleEffectDraft.js?.trim()) {
      const script = document.createElement("script");
      script.text = `try{\n${battleEffectDraft.js}\n}catch(e){console.error("Battle pulse effect error", e);}`;
      target.appendChild(script);
    }
    return () => {
      target.innerHTML = "";
    };
  }, [battleEffectDraft.html, battleEffectDraft.css, battleEffectDraft.js]);

  useEffect(() => {
    if (!borderDragging) return;
    const handleMove = (event: MouseEvent) => {
      if (!borderDragRef.current) return;
      const dx = event.clientX - borderDragRef.current.startX;
      const dy = event.clientY - borderDragRef.current.startY;
      const contextKey = borderDragContextRef.current;
      setBorderDraft((prev) => ({
        ...prev,
        offset_x: contextKey === "builder"
          ? Math.round((borderDragRef.current?.offsetX ?? 0) + dx)
          : prev.offset_x,
        offset_y: contextKey === "builder"
          ? Math.round((borderDragRef.current?.offsetY ?? 0) + dy)
          : prev.offset_y,
        offsets_by_context: {
          ...(prev.offsets_by_context ?? {}),
          [contextKey]: {
            x: Math.round((borderDragRef.current?.offsetX ?? 0) + dx),
            y: Math.round((borderDragRef.current?.offsetY ?? 0) + dy),
            scale: prev.offsets_by_context?.[contextKey]?.scale ?? 1,
          },
        },
      }));
    };
    const handleUp = () => {
      borderDragRef.current = null;
      setBorderDragging(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [borderDragging]);

  useEffect(() => {
    if (!battleEffectDragging) return;
    const handleMove = (event: MouseEvent) => {
      if (!battleEffectDragRef.current) return;
      const dx = event.clientX - battleEffectDragRef.current.startX;
      const dy = event.clientY - battleEffectDragRef.current.startY;
      setBattleEffectDraft((prev) => ({
        ...prev,
        offset_x: Math.round((battleEffectDragRef.current?.offsetX ?? 0) + dx),
        offset_y: Math.round((battleEffectDragRef.current?.offsetY ?? 0) + dy),
      }));
    };
    const handleUp = () => {
      setBattleEffectDragging(false);
      battleEffectDragRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [battleEffectDragging]);

  const getBorderOffset = (contextKey: string) => {
    const ctx = borderDraft.offsets_by_context?.[contextKey];
    return {
      x: Number(ctx?.x ?? borderDraft.offset_x ?? 0),
      y: Number(ctx?.y ?? borderDraft.offset_y ?? 0),
    };
  };

  const getBorderScale = (contextKey: string) => {
    const ctx = borderDraft.offsets_by_context?.[contextKey];
    return Number(ctx?.scale ?? 1);
  };

  const setBorderScale = (contextKey: string, scale: number) => {
    setBorderDraft((prev) => ({
      ...prev,
      offsets_by_context: {
        ...(prev.offsets_by_context ?? {}),
        [contextKey]: {
          ...(prev.offsets_by_context?.[contextKey] ?? {}),
          scale,
        },
      },
    }));
  };

  const startBorderDrag = (event: React.MouseEvent, contextKey: string) => {
    event.preventDefault();
    const current = getBorderOffset(contextKey);
    borderDragContextRef.current = contextKey;
    borderDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: current.x,
      offsetY: current.y,
    };
    setBorderDragging(true);
  };

  const getEffectScale = (contextKey: string) => {
    const ctx = effectDraft.config?.scale_by_context?.[contextKey];
    return Number(ctx?.scale ?? effectDraft.config?.scale ?? 1);
  };

  const setEffectScale = (contextKey: string, scale: number) => {
    setEffectDraft((prev) => ({
      ...prev,
      config: {
        ...(prev.config ?? {}),
        scale_by_context: {
          ...(prev.config?.scale_by_context ?? {}),
          [contextKey]: { scale },
        },
      },
    }));
  };
  const filteredProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    return projects
      .filter((p) => p.kind === builderTab)
      .filter((p) => {
        if (!term) return true;
        const tokens = projectKeywords(p, themes, codeThemes);
        return tokens.some((token) => token.toLowerCase().includes(term));
      });
  }, [projects, builderTab, projectSearch, themes, codeThemes]);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  useEffect(() => {
    refreshProjects(builderTab);
    refreshThemes(builderTab);
    refreshCodeProjects();
    refreshCodeThemes();
    if (builderTab === "avatar-border") refreshAvatarBorders();
    if (builderTab === "avatar-effect") refreshAvatarEffects();
    if (builderTab === "battle-pulse-effect") refreshBattlePulseEffects();
  }, [builderTab, showArchived]);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    const onClick = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest("[data-field]") as HTMLElement | null;
      if (!target) return;
      const field = target.dataset.field;
      const scope = target.dataset.scope;
      if (!field || !scope) return;
      setActiveField(`${scope}:${field}`);
      root.querySelectorAll(".inline-active").forEach((el) => el.classList.remove("inline-active"));
      target.classList.add("inline-active");
    };
    const onInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const field = target.dataset.field;
      const scope = target.dataset.scope;
      if (!field || !scope) return;
      if (scope === "code") return;
      const scopeRoot = root.querySelector(`[data-scope-root="${scope}"]`) as HTMLElement | null;
      if (!scopeRoot && scope !== "code") return;
      const rootScope = scopeRoot ?? root;
      const textValue = (target.innerText || "").replace(/\u00a0/g, " ").trim();

    if (scope === "email") {
        const chips = Array.from(rootScope.querySelectorAll('[data-field="chips"]')).map((el) =>
          (el as HTMLElement).innerText.trim()
        );
        const details = Array.from(rootScope.querySelectorAll('[data-field="details"]')).map((el) =>
          (el as HTMLElement).innerText.trim()
        );
        const learn = Array.from(rootScope.querySelectorAll('[data-field="learn"]')).map((el) =>
          (el as HTMLElement).innerText.trim()
        );
        const tags = Array.from(rootScope.querySelectorAll('[data-field="footerTags"]')).map((el) =>
          (el as HTMLElement).innerText.trim()
        );

        setEmailState((prev) => {
          switch (field) {
            case "dojoName":
              return { ...prev, dojoName: textValue };
            case "dojoTag":
              return { ...prev, dojoTag: textValue };
            case "logoFallbackText":
              return { ...prev, logoFallbackText: textValue };
            case "promoTopLabel":
              return { ...prev, promoTopLabel: textValue };
            case "promoAmount":
              return { ...prev, promoAmount: textValue };
            case "promoUnit":
              return { ...prev, promoUnit: textValue };
            case "promoEndsLabel":
              return { ...prev, promoEndsLabel: textValue };
            case "endDate": {
              const match = textValue.match(/\d{4}-\d{2}-\d{2}/);
              return match ? { ...prev, endDate: match[0] } : prev;
            }
            case "eyebrow":
              return { ...prev, eyebrow: textValue };
            case "titleMain":
              return { ...prev, titleMain: textValue };
            case "titleAccent":
              return { ...prev, titleAccent: textValue };
            case "subtitle":
              return { ...prev, subtitle: textValue };
            case "chips":
              return { ...prev, chips: chips.filter(Boolean).join(", ") };
            case "pointsLabel":
              return { ...prev, pointsLabel: textValue };
            case "pointsValue":
              return { ...prev, pointsValue: textValue };
            case "pointsSuffix":
              return { ...prev, pointsSuffix: textValue };
            case "ctaText":
              return { ...prev, ctaText: textValue };
            case "discountPrefix":
              return { ...prev, discountPrefix: textValue };
            case "discountCode":
              return { ...prev, discountCode: textValue };
            case "discountNote":
              return { ...prev, discountNote: textValue };
            case "detailsTitle":
              return { ...prev, detailsTitle: textValue };
            case "details":
              return { ...prev, details: details.filter(Boolean).join("\n") };
            case "learnTitle":
              return { ...prev, learnTitle: textValue };
            case "learn":
              return { ...prev, learn: learn.filter(Boolean).join("\n") };
            case "contactLabelPhone":
              return { ...prev, contactLabelPhone: textValue };
            case "contactPhone":
              return { ...prev, contact: { ...prev.contact, phone: textValue } };
            case "contactLabelLocation":
              return { ...prev, contactLabelLocation: textValue };
            case "contactLocation":
              return { ...prev, contact: { ...prev.contact, location: textValue } };
            case "contactLabelWebsite":
              return { ...prev, contactLabelWebsite: textValue };
            case "contactWebsite":
              return { ...prev, contact: { ...prev.contact, website: textValue } };
            case "footerLeft":
              return { ...prev, footerLeft: textValue };
            case "footerTags":
              return { ...prev, footerTags: tags.filter(Boolean).join(", ") };
            default:
              return prev;
          }
        });
    }

      if (scope === "flyer") {
        setFlyerState((prev) => {
          switch (field) {
            case "title":
              return { ...prev, title: textValue };
            case "subtitle":
              return { ...prev, subtitle: textValue };
            case "discountText":
              return { ...prev, discountText: textValue };
            case "ctaText":
              return { ...prev, ctaText: textValue };
            case "pointsLabel":
              return { ...prev, pointsLabel: textValue };
            case "pointsValue":
              return { ...prev, pointsValue: textValue };
            case "pointsSuffix":
              return { ...prev, pointsSuffix: textValue };
            case "logoFallbackText":
              return { ...prev, logoFallbackText: textValue };
            default:
              return prev;
          }
        });
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    const onBlur = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const field = target.dataset.field;
      const scope = target.dataset.scope;
      if (!field || scope !== "code") return;
      const value = (target.innerText || "").replace(/\u00a0/g, " ").trim();
      const currentTab = builderTabRef.current;
      if (currentTab === "email" && emailUsesCodeRef.current) {
        setEmailState((prev) => {
          const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
          return {
            ...prev,
            codeOverrides: {
              ...nextOverrides,
              textOverrides: {
                ...nextOverrides.textOverrides,
                [field]: { value, enabled: true },
              },
            },
          };
        });
        return;
      }
      if (currentTab === "flyer" && flyerUsesCodeRef.current) {
        setFlyerState((prev) => {
          const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
          return {
            ...prev,
            codeOverrides: {
              ...nextOverrides,
              textOverrides: {
                ...nextOverrides.textOverrides,
                [field]: { value, enabled: true },
              },
            },
          };
        });
        return;
      }
      setCodeState((prev) => ({
        ...prev,
        textOverrides: {
          ...(prev.textOverrides ?? {}),
          [field]: { value, enabled: true },
        },
      }));
    };
    root.addEventListener("focusout", onBlur);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      root.removeEventListener("focusout", onBlur);
    };
  }, []);

  async function copyHtml() {
    setMsg("");
    try {
      const output =
        builderTab === "email"
          ? emailOutputHtml
          : builderTab === "flyer"
            ? flyerOutputHtml
            : codeState.target === "digital"
              ? codePreviewDoc
              : codePreviewHtml;
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setMsg("Copy failed. You can select the HTML text and copy manually.");
    }
  }

  async function refreshProjects(kind: BuilderKind) {
    const archiveFlag = showArchived ? "&include_archived=1" : "";
    const res = await fetch(`/api/admin/marketing-builder/projects/list?kind=${kind}${archiveFlag}`, {
      cache: "no-store",
    });
    const sj = await safeJson(res);
    if (sj.ok) {
      setProjects((sj.json?.projects ?? []) as SavedProject[]);
    }
  }

  async function refreshThemes(kind: BuilderKind) {
    const res = await fetch(`/api/admin/marketing-builder/themes/list?kind=${kind}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) {
      setThemes((sj.json?.themes ?? []) as SavedTheme[]);
    }
  }

  async function refreshCodeProjects() {
    const res = await fetch("/api/admin/marketing-builder/projects/list?kind=code", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) {
      setCodeProjects((sj.json?.projects ?? []) as SavedProject[]);
    }
  }

  async function refreshCodeThemes() {
    const res = await fetch("/api/admin/marketing-builder/themes/list?kind=code", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) {
      setCodeThemes((sj.json?.themes ?? []) as SavedTheme[]);
    }
  }

  async function refreshAvatarBorders() {
    const res = await fetch("/api/admin/corner-borders", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setAvatarBorders((sj.json?.borders ?? []) as AvatarBorderRow[]);
  }

  async function refreshAvatarEffects() {
    const res = await fetch("/api/admin/avatar-effects", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setAvatarEffects((sj.json?.effects ?? []) as AvatarEffectRow[]);
  }

  async function refreshBattlePulseEffects() {
    const res = await fetch("/api/admin/battle-pulse-effects", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setBattlePulseEffects((sj.json?.effects ?? []) as BattlePulseEffectRow[]);
  }

  async function uploadFlyerBackground(file: File | null) {
    if (!file) return;
    setFlyerUploading(true);
    setMsg("");
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/admin/marketing/upload", { method: "POST", body: data });
    const sj = await safeJson(res);
    setFlyerUploading(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to upload image");
    const signedUrl = String(sj.json?.signed_url ?? "");
    if (!signedUrl) return setMsg("Missing uploaded image URL");
    setFlyerState((prev) => ({ ...prev, backgroundImage: signedUrl }));
  }

  async function uploadCodeImage(file: File | null, targetId: string, scope: "code" | "email" | "flyer" = "code") {
    if (!file) return;
    setCodeUploading(true);
    setMsg("");
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/admin/marketing/upload", { method: "POST", body: data });
    const sj = await safeJson(res);
    setCodeUploading(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to upload image");
    const signedUrl = String(sj.json?.signed_url ?? "");
    if (!signedUrl) return setMsg("Missing uploaded image URL");
    if (scope === "code") {
      setCodeState((prev) => ({
        ...prev,
        imageOverrides: {
          ...(prev.imageOverrides ?? {}),
          [targetId]: {
            ...(prev.imageOverrides?.[targetId] ?? {}),
            src: signedUrl,
          },
        },
      }));
      return;
    }
    if (scope === "email") {
      setEmailState((prev) => {
        const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
        return {
          ...prev,
          codeOverrides: {
            ...nextOverrides,
            imageOverrides: {
              ...(nextOverrides.imageOverrides ?? {}),
              [targetId]: {
                ...(nextOverrides.imageOverrides?.[targetId] ?? {}),
                src: signedUrl,
              },
            },
          },
        };
      });
      return;
    }
    setFlyerState((prev) => {
      const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
      return {
        ...prev,
        codeOverrides: {
          ...nextOverrides,
          imageOverrides: {
            ...(nextOverrides.imageOverrides ?? {}),
            [targetId]: {
              ...(nextOverrides.imageOverrides?.[targetId] ?? {}),
              src: signedUrl,
            },
          },
        },
      };
    });
  }

  function newProject() {
    setActiveProjectId("");
    setProjectName("New Project");
    setActiveThemeId("");
    setProjectUsage(defaultUsage(builderTab));
    if (builderTab === "email") {
      setEmailState(defaultValues);
    } else if (builderTab === "flyer") {
      setFlyerState(defaultFlyer);
    } else {
      setCodeState(defaultCode);
    }
  }

  async function saveProject() {
    setMsg("");
    setBusy(true);
    if (!projectName.trim()) {
      setBusy(false);
      setMsg("Please name your project before saving.");
      return;
    }
    const payload = builderTab === "email" ? emailState : builderTab === "flyer" ? flyerState : codeState;
    const res = await fetch("/api/admin/marketing-builder/projects/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: activeProjectId || null,
        name: projectName || "Untitled",
        kind: builderTab,
        data: { ...payload, projectUsage },
        theme_key: activeThemeId || null,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save project.");
      return;
    }
    setActiveProjectId(String(sj.json?.project?.id ?? activeProjectId));
    refreshProjects(builderTab);
    if (builderTab === "code") {
      await saveCodeTemplate(projectName || "Code Template", payload);
    }
  }

  async function saveTheme() {
    setMsg("");
    setBusy(true);
    if (!projectName.trim()) {
      setBusy(false);
      setMsg("Please name your theme before saving.");
      return;
    }
    const payload = builderTab === "email" ? emailState : builderTab === "flyer" ? flyerState : codeState;
    const res = await fetch("/api/admin/marketing-builder/themes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${projectName} Theme`,
        kind: builderTab,
        data: payload,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save theme.");
      return;
    }
    refreshThemes(builderTab);
  }

  async function archiveProject(archived: boolean) {
    if (!activeProjectId) return;
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/admin/marketing-builder/projects/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeProjectId, archived }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update archive status.");
    await refreshProjects(builderTab);
  }

  async function deleteProject() {
    if (!activeProjectId) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this project permanently?");
      if (!ok) return;
    }
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/admin/marketing-builder/projects/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeProjectId }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete project.");
    newProject();
    refreshProjects(builderTab);
  }

  async function saveAvatarBorder(row: AvatarBorderRow) {
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/admin/corner-borders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save avatar border.");
      return;
    }
    await refreshAvatarBorders();
  }

  async function saveAvatarEffect(row: AvatarEffectRow) {
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/admin/avatar-effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save avatar effect.");
      return;
    }
    await refreshAvatarEffects();
  }

  async function saveBattlePulseEffect(row: BattlePulseEffectRow) {
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/admin/battle-pulse-effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save battle pulse effect.");
      return;
    }
    await refreshBattlePulseEffects();
  }

  async function saveCodeTemplate(name: string, payload: typeof defaultCode) {
    const res = await fetch("/api/admin/marketing-builder/themes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${name} Template`,
        kind: "code",
        data: payload,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to auto-save code template.");
      return;
    }
    refreshCodeThemes();
  }

  function applyTheme(themeId: string) {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) return;
    const themeData = { ...(theme.data ?? {}) };
    if ("projectUsage" in themeData) delete themeData.projectUsage;
    if (builderTab === "email") {
      setEmailState((prev) => ({ ...prev, ...themeData }));
    } else if (builderTab === "flyer") {
      setFlyerState((prev) => ({ ...prev, ...themeData }));
    } else {
      setCodeState((prev) => ({ ...prev, ...themeData }));
    }
    setActiveThemeId(themeId);
  }

  function loadProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const rawData = { ...(proj.data ?? {}) };
    const incomingUsage =
      rawData.projectUsage ??
      (typeof rawData.overlayEnabled === "boolean"
        ? {
            useEmail: proj.kind === "email",
            useWebsite: false,
            useOverlay: rawData.overlayEnabled,
            overlayAudience: rawData.overlayAudience || "parents",
            overlayPlacement: rawData.overlayPlacement || "login",
          }
        : null);
    if (incomingUsage) {
      setProjectUsage({ ...defaultUsage(proj.kind), ...incomingUsage });
    } else {
      setProjectUsage(defaultUsage(proj.kind));
    }
    if ("projectUsage" in rawData) delete rawData.projectUsage;
    if ("overlayEnabled" in rawData) delete rawData.overlayEnabled;
    if ("overlayAudience" in rawData) delete rawData.overlayAudience;
    if ("overlayPlacement" in rawData) delete rawData.overlayPlacement;
    setProjectName(proj.name);
    setActiveProjectId(proj.id);
    setActiveThemeId(proj.theme_key ?? "");
    if (proj.kind === "email") {
      setEmailState({
        ...defaultValues,
        ...rawData,
        codeOverrides: normalizeCodeOverrides(rawData.codeOverrides),
      });
    } else if (proj.kind === "flyer") {
      setFlyerState({
        ...defaultFlyer,
        ...rawData,
        codeOverrides: normalizeCodeOverrides(rawData.codeOverrides),
      });
    } else {
      const incoming = { ...defaultCode, ...rawData };
      setCodeState({
        ...incoming,
        originalHtml: incoming.originalHtml || incoming.html,
        originalCss: incoming.originalCss || incoming.css,
        originalJs: incoming.originalJs || incoming.js,
      });
    }
  }

  async function exportImage() {
    const node = previewRef.current;
    if (!node) return;
    setMsg("");
    try {
      const { width, height } = node.getBoundingClientRect();
      const serialized = new XMLSerializer().serializeToString(node);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div>
          </foreignObject>
        </svg>
      `;
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const scale = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const data = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = data;
          a.download = `${projectName || "marketing"}.png`;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          setMsg("Export blocked by browser security (tainted canvas). Use same-origin images or data URLs.");
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        setMsg("Export failed. Some external images may block exporting.");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      setMsg("Export failed. Some external images may block exporting.");
    }
  }

  return (
    <main
      style={{
        display: "grid",
        gap: 16,
        padding: "16px 0",
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
      }}
    >
      <div>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Email + Marketing Builder</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Winter themed template with full customization and a live preview.
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={toolbar()}>
        <div style={tabRow()}>
          <button onClick={() => setBuilderTab("email")} style={tabChip(isEmail)}>
            Email Builder
          </button>
          <button onClick={() => setBuilderTab("flyer")} style={tabChip(builderTab === "flyer")}>
            Flyer Builder
          </button>
          <button onClick={() => setBuilderTab("code")} style={tabChip(builderTab === "code")}>
            Code Mode
          </button>
          <button onClick={() => setBuilderTab("avatar-border")} style={tabChip(builderTab === "avatar-border")}>
            Avatar Borders
          </button>
          <button onClick={() => setBuilderTab("avatar-effect")} style={tabChip(builderTab === "avatar-effect")}>
            Avatar Backgrounds
          </button>
          <button onClick={() => setBuilderTab("battle-pulse-effect")} style={tabChip(builderTab === "battle-pulse-effect")}>
            Battle Pulse FX
          </button>
          <div style={chipRow()}>
            {builderTab === "email" || builderTab === "flyer" || builderTab === "code"
              ? filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => loadProject(project.id)}
                    style={projectChip(project.id === activeProjectId, project.archived)}
                    title={project.name}
                  >
                    {project.name}
                  </button>
                ))
              : null}
          </div>
        </div>
        {(builderTab === "email" || builderTab === "flyer" || builderTab === "code") ? (
          <>
            <div style={projectRow()}>
          <select value={activeProjectId} onChange={(e) => loadProject(e.target.value)} style={input()}>
            <option value="">Select saved project...</option>
            {projects
              .filter((p) => p.kind === builderTab)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            style={input()}
          />
          <button onClick={newProject} style={ghost()}>
            New
          </button>
          <button onClick={saveProject} style={button()} disabled={busy}>
            {busy ? "Saving..." : "Save Project"}
          </button>
          <button
            onClick={() => archiveProject(!activeProject?.archived)}
            style={ghost()}
            disabled={!activeProjectId || busy}
          >
            {activeProject?.archived ? "Unarchive" : "Archive"}
          </button>
          <button onClick={deleteProject} style={ghost()} disabled={!activeProjectId || busy}>
            Delete
          </button>
          <button onClick={saveTheme} style={ghost()}>
            Save Theme
          </button>
          <button onClick={exportImage} style={ghost()}>
            Export PNG
          </button>
            </div>
            <div style={projectFilters()}>
          <input
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Search projects by name or content..."
            style={input()}
          />
          <label style={checkRow()}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Show archived</span>
          </label>
            </div>
          </>
        ) : null}
      </div>

      {(builderTab === "email" || builderTab === "flyer" || builderTab === "code") ? (
      <section style={projectGallery()}>
        <div style={panelTitle()}>Projects</div>
        <div style={cardGrid()}>
          {filteredProjects.length === 0 ? (
            <div style={helperText()}>No matching projects.</div>
          ) : null}
          {filteredProjects.map((project) => {
            const tags = projectKeywords(project, themes, codeThemes).slice(0, 4);
            const themeName =
              (project.theme_key &&
                (themes.find((t) => t.id === project.theme_key)?.name ||
                  codeThemes.find((t) => t.id === project.theme_key)?.name)) ||
              "";
            return (
              <button
                key={project.id}
                style={projectCard(project.id === activeProjectId, project.archived)}
                onClick={() => loadProject(project.id)}
              >
                <div style={cardHeader()}>
                  <div style={cardTitle()}>{project.name}</div>
                  <div style={cardMeta()}>
                    {project.kind} • {new Date(project.updated_at || "").toLocaleDateString()}
                  </div>
                </div>
                {themeName ? <div style={cardSub()}>Theme: {themeName}</div> : null}
                <div style={cardTags()}>
                  {tags.map((tag) => (
                    <span key={`${project.id}-${tag}`} style={tagPill()}>
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>
      ) : null}

      <div style={layout()}>
        {builderTab === "email" ? (
          <>
            <div style={column()}>
            <section style={{ ...sidePanel(), ...(isActivePanel(activeField, "email", "usage") ? activePanel() : {}) }}>
              <div style={panelTitle()}>Project Usage</div>
              <div style={grid()}>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useEmail}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useEmail: e.target.checked }))}
                  />
                  <span>Email delivery</span>
                </label>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useWebsite}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useWebsite: e.target.checked }))}
                  />
                  <span>Website / in-app widget</span>
                </label>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useOverlay}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useOverlay: e.target.checked }))}
                  />
                  <span>Overlay message</span>
                </label>
                <label style={label()}>Overlay audience</label>
                <select
                  value={projectUsage.overlayAudience}
                  onChange={(e) => setProjectUsage((prev) => ({ ...prev, overlayAudience: e.target.value }))}
                  style={input()}
                  disabled={!projectUsage.useOverlay}
                >
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                  <option value="both">Parents + Students</option>
                </select>
                <label style={label()}>Overlay placement</label>
                <select
                  value={projectUsage.overlayPlacement}
                  onChange={(e) => setProjectUsage((prev) => ({ ...prev, overlayPlacement: e.target.value }))}
                  style={input()}
                  disabled={!projectUsage.useOverlay}
                >
                  <option value="login">Login screen</option>
                  <option value="portal">Portal pages</option>
                  <option value="both">Login + Portal</option>
                </select>
              </div>
            </section>
            <section style={sidePanel()}>
              <div style={panelTitle()}>Theme + Template</div>
              <div style={grid()}>
                <label style={label()}>Preset theme</label>
                <select
                  value={state.theme}
                  onChange={(e) =>
                    setEmailState((prev) => ({
                      ...prev,
                      theme: e.target.value,
                      useCodeTemplate: false,
                      codeTemplateKey: "",
                      ...emailThemePresets[e.target.value],
                    }))
                  }
                  style={input()}
                >
                  <option value="winter">Winter</option>
                  <option value="spring">Spring Bloom</option>
                  <option value="summer">Summer Shine</option>
                  <option value="inferno">Inferno</option>
                  <option value="spotlight">Spotlight</option>
                </select>
                <label style={label()}>Saved presets / templates</label>
                <select
                  value={activeThemeId}
                  onChange={(e) => {
                    const themeId = e.target.value;
                    if (!themeId) return;
                    const theme = themes.find((t) => t.id === themeId) || codeThemes.find((t) => t.id === themeId);
                    if (theme?.kind === "code") {
                      setEmailState((prev) => ({
                        ...prev,
                        useCodeTemplate: true,
                        codeTemplateKey: `theme:${themeId}`,
                        codeOverrides: emptyCodeOverrides(),
                      }));
                      setActiveThemeId(themeId);
                      return;
                    }
                    applyTheme(themeId);
                    setEmailState((prev) => ({ ...prev, useCodeTemplate: false, codeTemplateKey: "" }));
                  }}
                  style={input()}
                >
                  <option value="">Pick a saved item...</option>
                  {themes
                    .filter((t) => t.kind === "email")
                    .map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        Preset: {theme.name}
                      </option>
                    ))}
                  {codeThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      Template: {theme.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
            {state.useCodeTemplate && emailCodeState ? (
              <section style={sidePanel()}>
                <div style={panelTitle()}>Template Text Overrides</div>
                <div style={grid()}>
                  <label style={label()}>Detected text</label>
                  {emailCodeTextCandidates.length === 0 ? (
                    <div style={helperText()}>Add text in the HTML to unlock editable fields.</div>
                  ) : null}
                  {emailCodeTextCandidates.map((item) => {
                    const raw = emailCodeState.textOverrides[item.id];
                    const enabled = typeof raw === "string" ? true : raw?.enabled !== false;
                    const value = typeof raw === "string" ? raw : raw?.value ?? "";
                    const isActive = activeField === `code:${item.id}`;
                    return (
                      <div
                        key={item.id}
                        style={{ ...stack(), ...fieldBox(isActive) }}
                        data-field-control={`code:${item.id}`}
                        onClick={() => focusInline("code", item.id)}
                      >
                        <div style={tinyLabel()}>Replace: “{item.text}”</div>
                        <label style={checkRow()}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              setEmailState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    textOverrides: {
                                      ...nextOverrides.textOverrides,
                                      [item.id]: { value, enabled: e.target.checked },
                                    },
                                  },
                                };
                              })
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <input
                          value={value}
                          onFocus={() => focusInline("code", item.id)}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  textOverrides: {
                                    ...nextOverrides.textOverrides,
                                    [item.id]: { value: e.target.value, enabled },
                                  },
                                },
                              };
                            })
                          }
                          placeholder={item.text}
                          style={input()}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section style={{ ...sidePanel(), ...(isActivePanel(activeField, "email", "brand") ? activePanel() : {}) }}>
                <div style={panelTitle()}>Branding + Promo</div>
                <div style={grid()}>
                  <label style={label()}>School name</label>
                  <input
                    value={state.dojoName}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, dojoName: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>School tagline</label>
                  <input
                    value={state.dojoTag}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, dojoTag: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Logo URL</label>
                  <input
                    value={state.logoUrl}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="Leave blank to use academy logo"
                    style={input()}
                  />
                  <label style={label()}>Logo fallback text</label>
                  <input
                    value={state.logoFallbackText}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoFallbackText: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Logo box width</label>
                  <input
                    type="range"
                    min="48"
                    max="180"
                    value={state.logoBoxWidth}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoBoxWidth: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Logo box height</label>
                  <input
                    type="range"
                    min="48"
                    max="180"
                    value={state.logoBoxHeight}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoBoxHeight: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Logo image scale</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={state.logoImageScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoImageScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Logo scale</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={state.logoScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Logo X</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.logoOffsetX}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoOffsetX: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Logo Y</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.logoOffsetY}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, logoOffsetY: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Logo invert</label>
                  <label style={checkRow()}>
                    <input
                      type="checkbox"
                      checked={state.logoInvert}
                      onChange={(e) => setEmailState((prev) => ({ ...prev, logoInvert: e.target.checked }))}
                    />
                    <span>Invert colors</span>
                  </label>
                  <label style={label()}>Promo scale</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={state.promoScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Promo X</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.promoOffsetX}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoOffsetX: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Promo Y</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.promoOffsetY}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoOffsetY: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Promo width</label>
                  <input
                    type="number"
                    value={state.promoWidth || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, promoWidth: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>Promo height</label>
                  <input
                    type="number"
                    value={state.promoHeight || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, promoHeight: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>Accent color hue</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={state.accentHue}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, accentHue: Number(e.target.value) }))}
                    style={range()}
                  />
                  <div style={colorPreview(state.accentHue)}>
                    <span>Accent preview</span>
                  </div>
                  <label style={label()}>Container color</label>
                  <input
                    type="color"
                    value={state.containerBgColor}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, containerBgColor: e.target.value }))}
                    style={colorInput()}
                  />
                  <label style={label()}>Container opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.containerBgOpacity}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, containerBgOpacity: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Container enabled</label>
                  <label style={checkRow()}>
                    <input
                      type="checkbox"
                      checked={state.containerEnabled}
                      onChange={(e) => setEmailState((prev) => ({ ...prev, containerEnabled: e.target.checked }))}
                    />
                    <span>Show container overlay</span>
                  </label>
                  <label style={label()}>Text color</label>
                  <input
                    type="color"
                    value={state.textColor}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, textColor: e.target.value }))}
                    style={colorInput()}
                  />

                  <label style={label()}>Promo top label</label>
                  <input
                    value={state.promoTopLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoTopLabel: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Discount amount</label>
                  <input
                    value={state.promoAmount}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoAmount: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Discount unit</label>
                  <input
                    value={state.promoUnit}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoUnit: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Ends label</label>
                  <input
                    value={state.promoEndsLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, promoEndsLabel: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Discount end date</label>
                  <input
                    value={state.endDate}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, endDate: e.target.value }))}
                    type="date"
                    style={input()}
                  />
                  <label style={label()}>Countdown image URL (recommended for email)</label>
                  <input
                    value={state.countdownImageUrl}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, countdownImageUrl: e.target.value }))}
                    placeholder="https://..."
                    style={input()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      const base = window.location.origin;
                      const endParam = encodeURIComponent(state.endDate || "");
                      setEmailState((prev) => ({
                        ...prev,
                        countdownImageUrl: `${base}/api/email/countdown?end=${endParam}`,
                      }));
                    }}
                    style={button()}
                  >
                    Use Live Countdown Image
                  </button>
                  <div style={helperText()}>
                    Best email compatibility is a hosted animated countdown image (GIF/PNG). Leave blank to show static boxes.
                  </div>
                  <label style={label()}>Countdown embed HTML (advanced)</label>
                  <textarea
                    value={state.countdownHtml}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, countdownHtml: e.target.value }))}
                    placeholder="<img src='https://...'>"
                    style={textarea()}
                  />
                  <label style={label()}>Countdown labels</label>
                  <input
                    value={state.countdownDaysLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, countdownDaysLabel: e.target.value }))}
                    placeholder="DAYS"
                    style={input()}
                  />
                  <input
                    value={state.countdownHoursLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, countdownHoursLabel: e.target.value }))}
                    placeholder="HRS"
                    style={input()}
                  />
                  <input
                    value={state.countdownMinsLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, countdownMinsLabel: e.target.value }))}
                    placeholder="MIN"
                    style={input()}
                  />
                  <input
                    value={state.countdownSecsLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, countdownSecsLabel: e.target.value }))}
                    placeholder="SEC"
                    style={input()}
                  />
                </div>
              </section>
            )}
            </div>

            <section style={previewPanel()}>
          <div style={panelTitle()}>Live Preview</div>
          <div style={previewWrap()} className="previewFrame" ref={previewRef}>
            {state.useCodeTemplate ? null : <style>{previewCss}</style>}
            <div
              className="flyer"
              data-theme={state.theme}
              data-scope-root={state.useCodeTemplate ? "code" : "email"}
              role="region"
              aria-label="Winter Camp Flyer"
              style={emailVars(state) as React.CSSProperties}
              dangerouslySetInnerHTML={{
                __html: state.useCodeTemplate && emailCodeState ? emailTemplateHtml : renderFlyerHtml(state),
              }}
            />
          </div>
          <textarea readOnly value={emailOutputHtml} style={htmlBox()} />
        </section>

            <div style={column()}>
            {state.useCodeTemplate && emailCodeState ? (
              <section style={sidePanel()}>
                <div style={panelTitle()}>Template Assets</div>
                <div style={grid()}>
                  <label style={label()}>Detected fonts</label>
                  {emailCodeFontCandidates.length === 0 ? (
                    <div style={helperText()}>Add font-family declarations in CSS to create font overrides.</div>
                  ) : null}
                  {emailCodeFontCandidates.map((font) => (
                    <div key={font} style={stack()}>
                      <div style={tinyLabel()}>Override: {font}</div>
                      <input
                        value={emailCodeState.fontOverrides[font] ?? ""}
                        onChange={(e) =>
                          setEmailState((prev) => {
                            const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                            return {
                              ...prev,
                              codeOverrides: {
                                ...nextOverrides,
                                fontOverrides: {
                                  ...nextOverrides.fontOverrides,
                                  [font]: e.target.value,
                                },
                              },
                            };
                          })
                        }
                        placeholder={font}
                        style={input()}
                      />
                    </div>
                  ))}

                  <label style={label()}>Detected images</label>
                  {emailCodeImageCandidates.length === 0 ? (
                    <div style={helperText()}>Add an image tag in the HTML to control logo or visuals.</div>
                  ) : null}
                  {emailCodeImageCandidates.map((img) => {
                    const override = emailCodeState.imageOverrides?.[img.id] ?? {};
                    const enabled = override.enabled !== false;
                    return (
                      <div key={img.id} style={stack()}>
                        <div style={tinyLabel()}>
                          {img.isLogo ? "Logo image" : "Image"} • {img.alt || img.src || "unnamed"}
                        </div>
                        <label style={checkRow()}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              setEmailState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, enabled: e.target.checked },
                                    },
                                  },
                                };
                              })
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <input
                          value={override.src ?? img.src}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  imageOverrides: {
                                    ...nextOverrides.imageOverrides,
                                    [img.id]: { ...override, src: e.target.value },
                                  },
                                },
                              };
                            })
                          }
                          placeholder="https://..."
                          style={input()}
                        />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={ghost()}
                            onClick={() =>
                              setEmailState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, src: navLogoUrl || override.src },
                                    },
                                  },
                                };
                              })
                            }
                            disabled={!navLogoUrl}
                          >
                            Use nav logo
                          </button>
                          <label style={fileLabel()}>
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => uploadCodeImage(e.target.files?.[0] ?? null, img.id, "email")}
                              style={{ display: "none" }}
                            />
                          </label>
                          {codeUploading ? <span style={helperText()}>Uploading...</span> : null}
                        </div>
                        <label style={label()}>Width</label>
                        <input
                          type="number"
                          value={override.width ?? ""}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  imageOverrides: {
                                    ...nextOverrides.imageOverrides,
                                    [img.id]: { ...override, width: Number(e.target.value) || undefined },
                                  },
                                },
                              };
                            })
                          }
                          style={input()}
                        />
                        <label style={label()}>Height</label>
                        <input
                          type="number"
                          value={override.height ?? ""}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  imageOverrides: {
                                    ...nextOverrides.imageOverrides,
                                    [img.id]: { ...override, height: Number(e.target.value) || undefined },
                                  },
                                },
                              };
                            })
                          }
                          style={input()}
                        />
                        <label style={label()}>X</label>
                        <input
                          type="number"
                          value={override.x ?? 0}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  imageOverrides: {
                                    ...nextOverrides.imageOverrides,
                                    [img.id]: { ...override, x: Number(e.target.value) || 0 },
                                  },
                                },
                              };
                            })
                          }
                          style={input()}
                        />
                        <label style={label()}>Y</label>
                        <input
                          type="number"
                          value={override.y ?? 0}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  imageOverrides: {
                                    ...nextOverrides.imageOverrides,
                                    [img.id]: { ...override, y: Number(e.target.value) || 0 },
                                  },
                                },
                              };
                            })
                          }
                          style={input()}
                        />
                        <label style={label()}>Scale</label>
                        <input
                          type="number"
                          step="0.05"
                          value={override.scale ?? 1}
                          onChange={(e) =>
                            setEmailState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  imageOverrides: {
                                    ...nextOverrides.imageOverrides,
                                    [img.id]: { ...override, scale: Number(e.target.value) || 1 },
                                  },
                                },
                              };
                            })
                          }
                          style={input()}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={copyHtml} style={button()}>
                    {copied ? "Copied!" : "Copy HTML"}
                  </button>
                  <button
                    onClick={() =>
                      setEmailState((prev) => ({
                        ...prev,
                        codeOverrides: emptyCodeOverrides(),
                      }))
                    }
                    style={ghost()}
                  >
                    Reset Overrides
                  </button>
                </div>
              </section>
            ) : (
              <section style={{ ...sidePanel(), ...(isActivePanel(activeField, "email", "content") ? activePanel() : {}) }}>
                <div style={panelTitle()}>Content + Details</div>
                <div style={grid()}>
                  <label style={label()}>Eyebrow text</label>
                  <input
                    value={state.eyebrow}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, eyebrow: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Main title</label>
                  <input
                    value={state.titleMain}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, titleMain: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Title accent</label>
                  <input
                    value={state.titleAccent}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, titleAccent: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Subtitle</label>
                  <textarea
                    value={state.subtitle}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, subtitle: e.target.value }))}
                    style={textarea()}
                  />

                  <label style={label()}>Highlight chips (comma separated)</label>
                  <input
                    value={state.chips}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, chips: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Points bonus pill</label>
                  <label style={checkRow()}>
                    <input
                      type="checkbox"
                      checked={state.pointsEnabled}
                      onChange={(e) => setEmailState((prev) => ({ ...prev, pointsEnabled: e.target.checked }))}
                    />
                    <span>Show points bonus</span>
                  </label>
                  <label style={label()}>Points label</label>
                  <input
                    value={state.pointsLabel}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsLabel: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Points value</label>
                  <input
                    value={state.pointsValue}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsValue: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Points suffix</label>
                  <input
                    value={state.pointsSuffix}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsSuffix: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Points scale</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={state.pointsScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Points pill size</label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.6"
                    step="0.05"
                    value={state.pointsSize}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsSize: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Points width</label>
                  <input
                    type="number"
                    value={state.pointsWidth || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, pointsWidth: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>Points height</label>
                  <input
                    type="number"
                    value={state.pointsHeight || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, pointsHeight: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>Points border color</label>
                  <input
                    type="color"
                    value={state.pointsBorderColor}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsBorderColor: e.target.value }))}
                    style={colorInput()}
                  />
                  <label style={label()}>Points X</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.pointsOffsetX}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsOffsetX: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Points Y</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.pointsOffsetY}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, pointsOffsetY: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>CTA text</label>
                  <input
                    value={state.ctaText}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, ctaText: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>CTA link</label>
                  <input
                    value={state.ctaUrl}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>CTA scale</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={state.ctaScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, ctaScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>CTA width</label>
                  <input
                    type="number"
                    value={state.ctaWidth || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, ctaWidth: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>CTA height</label>
                  <input
                    type="number"
                    value={state.ctaHeight || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, ctaHeight: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>CTA X</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.ctaOffsetX}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, ctaOffsetX: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>CTA Y</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.ctaOffsetY}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, ctaOffsetY: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Discount prefix</label>
                  <input
                    value={state.discountPrefix}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, discountPrefix: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Discount code</label>
                  <input
                    value={state.discountCode}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, discountCode: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Discount note</label>
                  <input
                    value={state.discountNote}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, discountNote: e.target.value }))}
                    style={input()}
                  />

                  <label style={label()}>Details title</label>
                  <input
                    value={state.detailsTitle}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, detailsTitle: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Hero scale</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={state.heroScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, heroScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Hero X</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.heroOffsetX}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, heroOffsetX: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Hero Y</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.heroOffsetY}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, heroOffsetY: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Details list (one per line)</label>
                  <textarea
                    value={state.details}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, details: e.target.value }))}
                    style={textarea()}
                  />
                  <label style={label()}>Learning title</label>
                  <input
                    value={state.learnTitle}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, learnTitle: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Learning list (one per line)</label>
                  <textarea
                    value={state.learn}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, learn: e.target.value }))}
                    style={textarea()}
                  />
                  <label style={label()}>Details scale</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={state.detailsScale}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, detailsScale: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Details card width</label>
                  <input
                    type="number"
                    value={state.detailsWidth || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, detailsWidth: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>Details card height</label>
                  <input
                    type="number"
                    value={state.detailsHeight || ""}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, detailsHeight: Number(e.target.value) || 0 }))
                    }
                    placeholder="auto"
                    style={input()}
                  />
                  <label style={label()}>Details X</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.detailsOffsetX}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, detailsOffsetX: Number(e.target.value) }))}
                    style={range()}
                  />
                  <label style={label()}>Details Y</label>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={state.detailsOffsetY}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, detailsOffsetY: Number(e.target.value) }))}
                    style={range()}
                  />

                  <label style={label()}>Phone label</label>
                  <input
                    value={state.contactLabelPhone}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, contactLabelPhone: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Phone</label>
                  <input
                    value={state.contact.phone}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, contact: { ...prev.contact, phone: e.target.value } }))
                    }
                    style={input()}
                  />
                  <label style={label()}>Location label</label>
                  <input
                    value={state.contactLabelLocation}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, contactLabelLocation: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Location</label>
                  <input
                    value={state.contact.location}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, contact: { ...prev.contact, location: e.target.value } }))
                    }
                    style={input()}
                  />
                  <label style={label()}>Website label</label>
                  <input
                    value={state.contactLabelWebsite}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, contactLabelWebsite: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Website</label>
                  <input
                    value={state.contact.website}
                    onChange={(e) =>
                      setEmailState((prev) => ({ ...prev, contact: { ...prev.contact, website: e.target.value } }))
                    }
                    style={input()}
                  />

                  <label style={label()}>Footer message</label>
                  <input
                    value={state.footerLeft}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, footerLeft: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Footer tags (comma separated)</label>
                  <input
                    value={state.footerTags}
                    onChange={(e) => setEmailState((prev) => ({ ...prev, footerTags: e.target.value }))}
                    style={input()}
                  />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={copyHtml} style={button()}>
                    {copied ? "Copied!" : "Copy HTML"}
                  </button>
                  <button onClick={() => setEmailState(defaultValues)} style={ghost()}>
                    Reset
                  </button>
                </div>
              </section>
            )}
            </div>
          </>
        ) : null}
        {builderTab === "flyer" ? (
          <>
            <div style={column()}>
              <section style={{ ...sidePanel(), ...(isActivePanel(activeField, "flyer", "usage") ? activePanel() : {}) }}>
                <div style={panelTitle()}>Project Usage</div>
                <div style={grid()}>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useEmail}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useEmail: e.target.checked }))}
                  />
                  <span>Email delivery</span>
                </label>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useWebsite}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useWebsite: e.target.checked }))}
                  />
                  <span>Website / in-app widget</span>
                </label>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useOverlay}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useOverlay: e.target.checked }))}
                  />
                  <span>Overlay message</span>
                </label>
                <label style={label()}>Overlay audience</label>
                <select
                  value={projectUsage.overlayAudience}
                  onChange={(e) => setProjectUsage((prev) => ({ ...prev, overlayAudience: e.target.value }))}
                  style={input()}
                  disabled={!projectUsage.useOverlay}
                >
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                  <option value="both">Parents + Students</option>
                </select>
                <label style={label()}>Overlay placement</label>
                <select
                  value={projectUsage.overlayPlacement}
                  onChange={(e) => setProjectUsage((prev) => ({ ...prev, overlayPlacement: e.target.value }))}
                  style={input()}
                  disabled={!projectUsage.useOverlay}
                >
                  <option value="login">Login screen</option>
                  <option value="portal">Portal pages</option>
                  <option value="both">Login + Portal</option>
                </select>
              </div>
              </section>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Theme + Template</div>
                <div style={grid()}>
                  <label style={label()}>Preset theme</label>
                  <select
                    value=""
                    onChange={(e) => {
                      const preset = flyerThemePresets[e.target.value];
                      if (!preset) return;
                      setFlyerState((prev) => ({
                        ...prev,
                        ...preset,
                        useCodeTemplate: false,
                        codeTemplateKey: "",
                      }));
                    }}
                    style={input()}
                  >
                    <option value="">Select a preset...</option>
                    <option value="spring">Spring Bloom</option>
                    <option value="summer">Summer Shine</option>
                    <option value="inferno">Inferno</option>
                    <option value="spotlight">Spotlight</option>
                  </select>
                  <label style={label()}>Saved presets / templates</label>
                  <select
                    value={activeThemeId}
                    onChange={(e) => {
                      const themeId = e.target.value;
                      if (!themeId) return;
                      const theme = themes.find((t) => t.id === themeId) || codeThemes.find((t) => t.id === themeId);
                      if (theme?.kind === "code") {
                        setFlyerState((prev) => ({
                          ...prev,
                          useCodeTemplate: true,
                          codeTemplateKey: `theme:${themeId}`,
                          codeOverrides: emptyCodeOverrides(),
                        }));
                        setActiveThemeId(themeId);
                        return;
                      }
                      applyTheme(themeId);
                      setFlyerState((prev) => ({ ...prev, useCodeTemplate: false, codeTemplateKey: "" }));
                    }}
                    style={input()}
                  >
                    <option value="">Pick a saved item...</option>
                    {themes
                      .filter((t) => t.kind === "flyer")
                      .map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          Preset: {theme.name}
                        </option>
                      ))}
                    {codeThemes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        Template: {theme.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
              {flyerState.useCodeTemplate && flyerCodeState ? (
                <section style={sidePanel()}>
                  <div style={panelTitle()}>Template Text Overrides</div>
                  <div style={grid()}>
                    <label style={label()}>Detected text</label>
                    {flyerCodeTextCandidates.length === 0 ? (
                      <div style={helperText()}>Add text in the HTML to unlock editable fields.</div>
                    ) : null}
                    {flyerCodeTextCandidates.map((item) => {
                      const raw = flyerCodeState.textOverrides[item.id];
                      const enabled = typeof raw === "string" ? true : raw?.enabled !== false;
                      const value = typeof raw === "string" ? raw : raw?.value ?? "";
                      const isActive = activeField === `code:${item.id}`;
                      return (
                        <div
                          key={item.id}
                          style={{ ...stack(), ...fieldBox(isActive) }}
                          data-field-control={`code:${item.id}`}
                          onClick={() => focusInline("code", item.id)}
                        >
                          <div style={tinyLabel()}>Replace: “{item.text}”</div>
                          <label style={checkRow()}>
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) =>
                                setFlyerState((prev) => {
                                  const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                  return {
                                    ...prev,
                                    codeOverrides: {
                                      ...nextOverrides,
                                      textOverrides: {
                                        ...nextOverrides.textOverrides,
                                        [item.id]: { value, enabled: e.target.checked },
                                      },
                                    },
                                  };
                              })
                            }
                          />
                          <span>Enabled</span>
                        </label>
                          <input
                            value={value}
                            onFocus={() => focusInline("code", item.id)}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    textOverrides: {
                                      ...nextOverrides.textOverrides,
                                      [item.id]: { value: e.target.value, enabled },
                                    },
                                  },
                                };
                              })
                            }
                            placeholder={item.text}
                            style={input()}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section style={{ ...sidePanel(), ...(isActivePanel(activeField, "flyer", "style") ? activePanel() : {}) }}>
                  <div style={panelTitle()}>Flyer Styling</div>
                  <div style={grid()}>
                    <label style={label()}>Flyer size</label>
                    <select
                      value={flyerState.size}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, size: e.target.value }))}
                      style={input()}
                    >
                      <option value="portrait">8.5x11</option>
                      <option value="square">Square</option>
                    </select>
                    <label style={label()}>Background image URL</label>
                    <input
                      value={flyerState.backgroundImage}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, backgroundImage: e.target.value }))}
                      placeholder="https://..."
                      style={input()}
                    />
                    <label style={label()}>Upload background image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadFlyerBackground(e.target.files?.[0] ?? null)}
                      style={fileInput()}
                    />
                    {flyerUploading ? <div style={helperText()}>Uploading...</div> : null}
                    <label style={label()}>Background position X</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={flyerState.bgPosX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, bgPosX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Background position Y</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={flyerState.bgPosY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, bgPosY: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Background width</label>
                    <input
                      type="range"
                      min="80"
                      max="180"
                      value={flyerState.bgSizeX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, bgSizeX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Background height</label>
                    <input
                      type="range"
                      min="80"
                      max="180"
                      value={flyerState.bgSizeY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, bgSizeY: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Background color</label>
                    <input
                      type="color"
                      value={flyerState.backgroundColor}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                      style={colorInput()}
                    />
                    <label style={label()}>Container color</label>
                    <input
                      type="color"
                      value={flyerState.containerBgColor}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, containerBgColor: e.target.value }))}
                      style={colorInput()}
                    />
                    <label style={label()}>Container opacity</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={flyerState.containerBgOpacity}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, containerBgOpacity: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Container enabled</label>
                    <label style={checkRow()}>
                      <input
                        type="checkbox"
                        checked={flyerState.containerEnabled}
                        onChange={(e) => setFlyerState((prev) => ({ ...prev, containerEnabled: e.target.checked }))}
                      />
                      <span>Show container overlay</span>
                    </label>
                    <label style={label()}>Text color</label>
                    <input
                      type="color"
                      value={flyerState.textColor}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, textColor: e.target.value }))}
                      style={colorInput()}
                    />
                    <label style={label()}>Texture</label>
                    <select
                      value={flyerState.texture}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, texture: e.target.value }))}
                      style={input()}
                    >
                      <option value="none">None</option>
                      <option value="snow">Snow</option>
                      <option value="noise">Noise</option>
                      <option value="rays">Rays</option>
                    </select>
                    <label style={label()}>Texture animation</label>
                    <label style={checkRow()}>
                      <input
                        type="checkbox"
                        checked={flyerState.textureAnimated}
                        onChange={(e) => setFlyerState((prev) => ({ ...prev, textureAnimated: e.target.checked }))}
                      />
                      <span>Animate in preview (static on export)</span>
                    </label>
                    <label style={label()}>Edge softness</label>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={flyerState.edgeSoftness}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, edgeSoftness: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Mask shape</label>
                    <select
                      value={flyerState.maskShape}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, maskShape: e.target.value }))}
                      style={input()}
                    >
                      <option value="soft-rect">Soft rectangle</option>
                      <option value="oval">Oval</option>
                      <option value="none">None</option>
                    </select>
                    <label style={label()}>Mask feather</label>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={flyerState.maskFeather}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, maskFeather: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Border color</label>
                    <input
                      type="color"
                      value={flyerState.borderColor}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, borderColor: e.target.value }))}
                      style={colorInput()}
                    />
                  </div>
                </section>
              )}
            </div>

            <section style={previewPanel()}>
              <div style={panelTitle()}>Flyer Preview</div>
              <div style={previewWrap()} className="previewFrame" ref={previewRef}>
                {flyerState.useCodeTemplate ? null : <style>{flyerCss}</style>}
                <div
                  className="flyer"
                  data-theme="flyer"
                  data-scope-root={flyerState.useCodeTemplate ? "code" : "flyer"}
                  role="region"
                  aria-label="Flyer Preview"
                  dangerouslySetInnerHTML={{
                    __html:
                      flyerState.useCodeTemplate && flyerCodeState
                        ? flyerTemplateHtml
                        : renderFlyerCard(flyerState),
                  }}
                />
              </div>
              <textarea readOnly value={flyerOutputHtml} style={htmlBox()} />
            </section>

            <div style={column()}>
              {flyerState.useCodeTemplate && flyerCodeState ? (
                <section style={sidePanel()}>
                  <div style={panelTitle()}>Template Assets</div>
                  <div style={grid()}>
                    <label style={label()}>Detected fonts</label>
                    {flyerCodeFontCandidates.length === 0 ? (
                      <div style={helperText()}>Add font-family declarations in CSS to create font overrides.</div>
                    ) : null}
                    {flyerCodeFontCandidates.map((font) => (
                      <div key={font} style={stack()}>
                        <div style={tinyLabel()}>Override: {font}</div>
                        <input
                          value={flyerCodeState.fontOverrides[font] ?? ""}
                          onChange={(e) =>
                            setFlyerState((prev) => {
                              const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                              return {
                                ...prev,
                                codeOverrides: {
                                  ...nextOverrides,
                                  fontOverrides: {
                                    ...nextOverrides.fontOverrides,
                                    [font]: e.target.value,
                                  },
                                },
                              };
                            })
                          }
                          placeholder={font}
                          style={input()}
                        />
                      </div>
                    ))}

                    <label style={label()}>Detected images</label>
                    {flyerCodeImageCandidates.length === 0 ? (
                      <div style={helperText()}>Add an image tag in the HTML to control logo or visuals.</div>
                    ) : null}
                    {flyerCodeImageCandidates.map((img) => {
                      const override = flyerCodeState.imageOverrides?.[img.id] ?? {};
                      const enabled = override.enabled !== false;
                      return (
                        <div key={img.id} style={stack()}>
                          <div style={tinyLabel()}>
                            {img.isLogo ? "Logo image" : "Image"} • {img.alt || img.src || "unnamed"}
                          </div>
                          <label style={checkRow()}>
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) =>
                                setFlyerState((prev) => {
                                  const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                  return {
                                    ...prev,
                                    codeOverrides: {
                                      ...nextOverrides,
                                      imageOverrides: {
                                        ...nextOverrides.imageOverrides,
                                        [img.id]: { ...override, enabled: e.target.checked },
                                      },
                                    },
                                  };
                                })
                              }
                            />
                            <span>Enabled</span>
                          </label>
                          <input
                            value={override.src ?? img.src}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, src: e.target.value },
                                    },
                                  },
                                };
                              })
                            }
                            placeholder="https://..."
                            style={input()}
                          />
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              style={ghost()}
                              onClick={() =>
                                setFlyerState((prev) => {
                                  const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                  return {
                                    ...prev,
                                    codeOverrides: {
                                      ...nextOverrides,
                                      imageOverrides: {
                                        ...nextOverrides.imageOverrides,
                                        [img.id]: { ...override, src: navLogoUrl || override.src },
                                      },
                                    },
                                  };
                                })
                              }
                              disabled={!navLogoUrl}
                            >
                              Use nav logo
                            </button>
                            <label style={fileLabel()}>
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => uploadCodeImage(e.target.files?.[0] ?? null, img.id, "flyer")}
                                style={{ display: "none" }}
                              />
                            </label>
                            {codeUploading ? <span style={helperText()}>Uploading...</span> : null}
                          </div>
                          <label style={label()}>Width</label>
                          <input
                            type="number"
                            value={override.width ?? ""}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, width: Number(e.target.value) || undefined },
                                    },
                                  },
                                };
                              })
                            }
                            style={input()}
                          />
                          <label style={label()}>Height</label>
                          <input
                            type="number"
                            value={override.height ?? ""}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, height: Number(e.target.value) || undefined },
                                    },
                                  },
                                };
                              })
                            }
                            style={input()}
                          />
                          <label style={label()}>X</label>
                          <input
                            type="number"
                            value={override.x ?? 0}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, x: Number(e.target.value) || 0 },
                                    },
                                  },
                                };
                              })
                            }
                            style={input()}
                          />
                          <label style={label()}>Y</label>
                          <input
                            type="number"
                            value={override.y ?? 0}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, y: Number(e.target.value) || 0 },
                                    },
                                  },
                                };
                              })
                            }
                            style={input()}
                          />
                          <label style={label()}>Scale</label>
                          <input
                            type="number"
                            step="0.05"
                            value={override.scale ?? 1}
                            onChange={(e) =>
                              setFlyerState((prev) => {
                                const nextOverrides = normalizeCodeOverrides(prev.codeOverrides);
                                return {
                                  ...prev,
                                  codeOverrides: {
                                    ...nextOverrides,
                                    imageOverrides: {
                                      ...nextOverrides.imageOverrides,
                                      [img.id]: { ...override, scale: Number(e.target.value) || 1 },
                                    },
                                  },
                                };
                              })
                            }
                            style={input()}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <button onClick={copyHtml} style={button()}>
                      {copied ? "Copied!" : "Copy HTML"}
                    </button>
                    <button
                      onClick={() =>
                        setFlyerState((prev) => ({
                          ...prev,
                          codeOverrides: emptyCodeOverrides(),
                        }))
                      }
                      style={ghost()}
                    >
                      Reset Overrides
                    </button>
                  </div>
                </section>
              ) : (
                <section
                  style={{ ...sidePanel(), ...(isActivePanel(activeField, "flyer", "content") ? activePanel() : {}) }}
                >
                  <div style={panelTitle()}>Flyer Content</div>
                  <div style={grid()}>
                    <label style={label()}>Title</label>
                    <input
                      value={flyerState.title}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, title: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Subtitle</label>
                    <textarea
                      value={flyerState.subtitle}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, subtitle: e.target.value }))}
                      style={textarea()}
                    />
                    <label style={label()}>Logo URL</label>
                    <input
                      value={flyerState.logoUrl}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoUrl: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Logo fallback text</label>
                    <input
                      value={flyerState.logoFallbackText}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoFallbackText: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Logo scale</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={flyerState.logoScale}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoScale: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Logo box size</label>
                    <input
                      type="range"
                      min="64"
                      max="200"
                      value={flyerState.logoBoxSize}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoBoxSize: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Logo box width</label>
                    <input
                      type="number"
                      value={flyerState.logoBoxWidth || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, logoBoxWidth: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>Logo box height</label>
                    <input
                      type="number"
                      value={flyerState.logoBoxHeight || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, logoBoxHeight: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>Logo image scale</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={flyerState.logoImageScale}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoImageScale: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Logo invert</label>
                    <label style={checkRow()}>
                      <input
                        type="checkbox"
                        checked={flyerState.logoInvert}
                        onChange={(e) => setFlyerState((prev) => ({ ...prev, logoInvert: e.target.checked }))}
                      />
                      <span>Invert logo colors</span>
                    </label>
                    <label style={label()}>Logo X</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.logoOffsetX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoOffsetX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Logo Y</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.logoOffsetY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, logoOffsetY: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Discount toggle</label>
                    <label style={checkRow()}>
                      <input
                        type="checkbox"
                        checked={flyerState.discountEnabled}
                        onChange={(e) => setFlyerState((prev) => ({ ...prev, discountEnabled: e.target.checked }))}
                      />
                      <span>Show discount badge</span>
                    </label>
                    <label style={label()}>Discount text</label>
                    <input
                      value={flyerState.discountText}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, discountText: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Discount scale</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={flyerState.discountScale}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, discountScale: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Discount width</label>
                    <input
                      type="number"
                      value={flyerState.discountWidth || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, discountWidth: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>Discount height</label>
                    <input
                      type="number"
                      value={flyerState.discountHeight || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, discountHeight: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>Discount X</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.discountOffsetX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, discountOffsetX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Discount Y</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.discountOffsetY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, discountOffsetY: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>CTA text</label>
                    <input
                      value={flyerState.ctaText}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, ctaText: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>CTA link</label>
                    <input
                      value={flyerState.ctaUrl}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>CTA scale</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={flyerState.ctaScale}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, ctaScale: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>CTA width</label>
                    <input
                      type="number"
                      value={flyerState.ctaWidth || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, ctaWidth: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>CTA height</label>
                    <input
                      type="number"
                      value={flyerState.ctaHeight || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, ctaHeight: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>CTA X</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.ctaOffsetX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, ctaOffsetX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>CTA Y</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.ctaOffsetY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, ctaOffsetY: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Points bonus pill</label>
                    <label style={checkRow()}>
                      <input
                        type="checkbox"
                        checked={flyerState.pointsEnabled}
                        onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsEnabled: e.target.checked }))}
                      />
                      <span>Show points bonus</span>
                    </label>
                    <label style={label()}>Points label</label>
                    <input
                      value={flyerState.pointsLabel}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsLabel: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Points value</label>
                    <input
                      value={flyerState.pointsValue}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsValue: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Points suffix</label>
                    <input
                      value={flyerState.pointsSuffix}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsSuffix: e.target.value }))}
                      style={input()}
                    />
                    <label style={label()}>Points scale</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={flyerState.pointsScale}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsScale: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Points pill size</label>
                    <input
                      type="range"
                      min="0.7"
                      max="1.6"
                      step="0.05"
                      value={flyerState.pointsSize}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsSize: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Points width</label>
                    <input
                      type="number"
                      value={flyerState.pointsWidth || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, pointsWidth: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>Points height</label>
                    <input
                      type="number"
                      value={flyerState.pointsHeight || ""}
                      onChange={(e) =>
                        setFlyerState((prev) => ({ ...prev, pointsHeight: Number(e.target.value) || 0 }))
                      }
                      placeholder="auto"
                      style={input()}
                    />
                    <label style={label()}>Points border color</label>
                    <input
                      type="color"
                      value={flyerState.pointsBorderColor}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsBorderColor: e.target.value }))}
                      style={colorInput()}
                    />
                    <label style={label()}>Points X</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.pointsOffsetX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsOffsetX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Points Y</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.pointsOffsetY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, pointsOffsetY: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Content scale</label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.4"
                      step="0.05"
                      value={flyerState.contentScale}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, contentScale: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Content X</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.contentOffsetX}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, contentOffsetX: Number(e.target.value) }))}
                      style={range()}
                    />
                    <label style={label()}>Content Y</label>
                    <input
                      type="range"
                      min="-160"
                      max="160"
                      value={flyerState.contentOffsetY}
                      onChange={(e) => setFlyerState((prev) => ({ ...prev, contentOffsetY: Number(e.target.value) }))}
                      style={range()}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <button onClick={copyHtml} style={button()}>
                      {copied ? "Copied!" : "Copy HTML"}
                    </button>
                    <button onClick={() => setFlyerState(defaultFlyer)} style={ghost()}>
                      Reset
                    </button>
                  </div>
                </section>
              )}
            </div>
          </>
        ) : null}
        {builderTab === "code" ? (
          <>
            <div style={column()}>
              <section
                style={{ ...sidePanel(), ...(isActivePanel(activeField, "code", "usage") ? activePanel() : {}) }}
              >
                <div style={panelTitle()}>Project Usage</div>
                <div style={grid()}>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useEmail}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useEmail: e.target.checked }))}
                  />
                  <span>Email delivery</span>
                </label>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useWebsite}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useWebsite: e.target.checked }))}
                  />
                  <span>Website / in-app widget</span>
                </label>
                <label style={checkRow()}>
                  <input
                    type="checkbox"
                    checked={projectUsage.useOverlay}
                    onChange={(e) => setProjectUsage((prev) => ({ ...prev, useOverlay: e.target.checked }))}
                  />
                  <span>Overlay message</span>
                </label>
                <label style={label()}>Overlay audience</label>
                <select
                  value={projectUsage.overlayAudience}
                  onChange={(e) => setProjectUsage((prev) => ({ ...prev, overlayAudience: e.target.value }))}
                  style={input()}
                  disabled={!projectUsage.useOverlay}
                >
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                  <option value="both">Parents + Students</option>
                </select>
                <label style={label()}>Overlay placement</label>
                <select
                  value={projectUsage.overlayPlacement}
                  onChange={(e) => setProjectUsage((prev) => ({ ...prev, overlayPlacement: e.target.value }))}
                  style={input()}
                  disabled={!projectUsage.useOverlay}
                >
                  <option value="login">Login screen</option>
                  <option value="portal">Portal pages</option>
                  <option value="both">Login + Portal</option>
                </select>
              </div>
              </section>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Code Inputs</div>
                <div style={grid()}>
                <label style={label()}>Target output</label>
                <select
                  value={codeState.target}
                  onChange={(e) => setCodeState((prev) => ({ ...prev, target: e.target.value }))}
                  style={input()}
                >
                  <option value="email">Email (HTML + CSS only)</option>
                  <option value="digital">Digital (HTML + CSS + JS)</option>
                </select>
                <label style={label()}>Saved templates</label>
                <select value={activeThemeId} onChange={(e) => applyTheme(e.target.value)} style={input()}>
                  <option value="">Pick a template...</option>
                  {themes
                    .filter((t) => t.kind === "code")
                    .map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        Template: {theme.name}
                      </option>
                    ))}
                </select>
                <label style={label()}>HTML</label>
                <textarea
                  value={codeState.html}
                  onChange={(e) =>
                    setCodeState((prev) => ({
                      ...prev,
                      originalHtml: prev.originalHtml || prev.html,
                      html: e.target.value,
                    }))
                  }
                  style={textarea()}
                />
                <label style={label()}>CSS</label>
                <textarea
                  value={codeState.css}
                  onChange={(e) =>
                    setCodeState((prev) => ({
                      ...prev,
                      originalCss: prev.originalCss || prev.css,
                      css: e.target.value,
                    }))
                  }
                  style={textarea()}
                />
                <label style={label()}>JS (digital only)</label>
                <textarea
                  value={codeState.js}
                  onChange={(e) =>
                    setCodeState((prev) => ({
                      ...prev,
                      originalJs: prev.originalJs || prev.js,
                      js: e.target.value,
                    }))
                  }
                  style={textarea()}
                />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button onClick={copyHtml} style={button()}>
                  {copied ? "Copied!" : "Copy HTML"}
                </button>
                <button onClick={() => setCodeState(defaultCode)} style={ghost()}>
                  Reset
                </button>
                <button
                  onClick={() =>
                    setCodeState((prev) => ({
                      ...prev,
                      html: prev.originalHtml || prev.html,
                      css: prev.originalCss || prev.css,
                      js: prev.originalJs || prev.js,
                    }))
                  }
                  style={ghost()}
                >
                  Reset to Original
                </button>
              </div>
              <div style={helperText()}>
                Code mode auto-saves a template whenever you save the project.
              </div>
              </section>
            </div>

            <section style={previewPanel()}>
              <div style={panelTitle()}>Code Preview</div>
              <div style={previewWrap()} className="previewFrame" ref={previewRef}>
                <div
                  className="codePreview"
                  data-scope-root="code"
                  dangerouslySetInnerHTML={{ __html: codePreviewHtml }}
                />
              </div>
              {codeState.target === "digital" ? (
                <button
                  type="button"
                  style={ghost()}
                  onClick={() => {
                    const win = window.open("", "_blank");
                    if (!win) return;
                    win.document.open();
                    win.document.write(codePreviewDoc);
                    win.document.close();
                  }}
                >
                  Open Live JS Preview
                </button>
              ) : null}
              <textarea readOnly value={codePreviewHtml} style={htmlBox()} />
            </section>

            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Customize Fields</div>
                <div style={grid()}>
                <label style={label()}>Detected text</label>
                {codeTextCandidates.length === 0 ? (
                  <div style={helperText()}>Add text in the HTML to unlock editable fields.</div>
                ) : null}
                {codeTextCandidates.map((item) => {
                  const raw = codeState.textOverrides[item.id];
                  const enabled = typeof raw === "string" ? true : raw?.enabled !== false;
                  const value = typeof raw === "string" ? raw : raw?.value ?? "";
                  const isActive = activeField === `code:${item.id}`;
                  return (
                    <div
                      key={item.id}
                      style={{ ...stack(), ...fieldBox(isActive) }}
                      data-field-control={`code:${item.id}`}
                      onClick={() => focusInline("code", item.id)}
                    >
                      <div style={tinyLabel()}>Replace: “{item.text}”</div>
                      <label style={checkRow()}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            setCodeState((prev) => ({
                              ...prev,
                              textOverrides: {
                                ...(prev.textOverrides ?? {}),
                                [item.id]: { value, enabled: e.target.checked },
                              },
                            }))
                          }
                        />
                        <span>Enabled</span>
                      </label>
                      <input
                        value={value}
                        onFocus={() => focusInline("code", item.id)}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            textOverrides: {
                              ...(prev.textOverrides ?? {}),
                              [item.id]: { value: e.target.value, enabled },
                            },
                          }))
                        }
                        placeholder={item.text}
                        style={input()}
                      />
                    </div>
                  );
                })}

                <label style={label()}>Detected fonts</label>
                {codeFontCandidates.length === 0 ? (
                  <div style={helperText()}>Add font-family declarations in CSS to create font overrides.</div>
                ) : null}
                {codeFontCandidates.map((font) => (
                  <div key={font} style={stack()}>
                    <div style={tinyLabel()}>Override: {font}</div>
                    <input
                      value={codeState.fontOverrides[font] ?? ""}
                      onChange={(e) =>
                        setCodeState((prev) => ({
                          ...prev,
                          fontOverrides: { ...prev.fontOverrides, [font]: e.target.value },
                        }))
                      }
                      placeholder={font}
                      style={input()}
                    />
                  </div>
                ))}

                <label style={label()}>Detected images</label>
                {codeImageCandidates.length === 0 ? (
                  <div style={helperText()}>Add an image tag in the HTML to control logo or visuals.</div>
                ) : null}
                {codeImageCandidates.map((img) => {
                  const override = codeState.imageOverrides?.[img.id] ?? {};
                  const enabled = override.enabled !== false;
                  return (
                    <div key={img.id} style={stack()}>
                      <div style={tinyLabel()}>
                        {img.isLogo ? "Logo image" : "Image"} • {img.alt || img.src || "unnamed"}
                      </div>
                      <label style={checkRow()}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            setCodeState((prev) => ({
                              ...prev,
                              imageOverrides: {
                                ...(prev.imageOverrides ?? {}),
                                [img.id]: { ...override, enabled: e.target.checked },
                              },
                            }))
                          }
                        />
                        <span>Enabled</span>
                      </label>
                      <input
                        value={override.src ?? img.src}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            imageOverrides: {
                              ...(prev.imageOverrides ?? {}),
                              [img.id]: { ...override, src: e.target.value },
                            },
                          }))
                        }
                        placeholder="https://..."
                        style={input()}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={ghost()}
                          onClick={() =>
                            setCodeState((prev) => ({
                              ...prev,
                              imageOverrides: {
                                ...(prev.imageOverrides ?? {}),
                                [img.id]: { ...override, src: navLogoUrl || override.src },
                              },
                            }))
                          }
                          disabled={!navLogoUrl}
                        >
                          Use nav logo
                        </button>
                        <label style={fileLabel()}>
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadCodeImage(e.target.files?.[0] ?? null, img.id)}
                            style={{ display: "none" }}
                          />
                        </label>
                        {codeUploading ? <span style={helperText()}>Uploading...</span> : null}
                      </div>
                      <label style={label()}>Width</label>
                      <input
                        type="number"
                        value={override.width ?? ""}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            imageOverrides: {
                              ...(prev.imageOverrides ?? {}),
                              [img.id]: { ...override, width: Number(e.target.value) || undefined },
                            },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>Height</label>
                      <input
                        type="number"
                        value={override.height ?? ""}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            imageOverrides: {
                              ...(prev.imageOverrides ?? {}),
                              [img.id]: { ...override, height: Number(e.target.value) || undefined },
                            },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>X</label>
                      <input
                        type="number"
                        value={override.x ?? 0}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            imageOverrides: {
                              ...(prev.imageOverrides ?? {}),
                              [img.id]: { ...override, x: Number(e.target.value) || 0 },
                            },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>Y</label>
                      <input
                        type="number"
                        value={override.y ?? 0}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            imageOverrides: {
                              ...(prev.imageOverrides ?? {}),
                              [img.id]: { ...override, y: Number(e.target.value) || 0 },
                            },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>Scale</label>
                      <input
                        type="number"
                        step="0.05"
                        value={override.scale ?? 1}
                        onChange={(e) =>
                          setCodeState((prev) => ({
                            ...prev,
                            imageOverrides: {
                              ...(prev.imageOverrides ?? {}),
                              [img.id]: { ...override, scale: Number(e.target.value) || 1 },
                            },
                          }))
                        }
                        style={input()}
                      />
                    </div>
                  );
                })}
                </div>
              </section>
            </div>
          </>
        ) : null}
        {builderTab === "avatar-border" ? (
          <>
            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Avatar Border Builder</div>
                <div style={grid()}>
                  <div style={helperText()}>
                    Use HTML/CSS/JS for borders, or upload an image border. The preview is a square avatar frame.
                  </div>
                  <a href="/admin/custom/media" style={linkBtn()} target="_blank" rel="noreferrer">
                    Open Media Vault
                  </a>
                  <label style={label()}>Saved borders</label>
                  <select
                    value={activeBorderId}
                    onChange={(e) => setActiveBorderId(e.target.value)}
                    style={input()}
                  >
                    <option value="">New border...</option>
                    {avatarBorders.map((border) => (
                      <option key={border.id ?? border.key} value={String(border.id ?? "")}>
                        {border.name}
                      </option>
                    ))}
                  </select>
                  <label style={label()}>Key</label>
                  <input
                    value={borderDraft.key ?? ""}
                    onChange={(e) => setBorderDraft((prev) => ({ ...prev, key: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Name</label>
                  <input
                    value={borderDraft.name ?? ""}
                    onChange={(e) => setBorderDraft((prev) => ({ ...prev, name: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Render mode</label>
                  <select
                    value={borderDraft.render_mode ?? "image"}
                    onChange={(e) => setBorderDraft((prev) => ({ ...prev, render_mode: e.target.value }))}
                    style={input()}
                  >
                    <option value="image">Image</option>
                    <option value="code">HTML/CSS/JS</option>
                  </select>
                  {borderDraft.render_mode === "image" ? (
                    <>
                      <label style={label()}>Image URL</label>
                      <input
                        value={borderDraft.image_url ?? ""}
                        onChange={(e) => setBorderDraft((prev) => ({ ...prev, image_url: e.target.value }))}
                        style={input()}
                      />
                    </>
                  ) : (
                    <>
                      <label style={label()}>HTML</label>
                      <textarea
                        value={borderDraft.html ?? ""}
                        onChange={(e) => setBorderDraft((prev) => ({ ...prev, html: e.target.value }))}
                        style={textarea()}
                      />
                      <label style={label()}>CSS</label>
                      <textarea
                        value={borderDraft.css ?? ""}
                        onChange={(e) => setBorderDraft((prev) => ({ ...prev, css: e.target.value }))}
                        style={textarea()}
                      />
                      <label style={label()}>JS</label>
                      <textarea
                        value={borderDraft.js ?? ""}
                        onChange={(e) => setBorderDraft((prev) => ({ ...prev, js: e.target.value }))}
                        style={textarea()}
                      />
                      <label style={label()}>Offset X (builder, px)</label>
                      <input
                        type="number"
                        value={getBorderOffset("builder").x}
                        onChange={(e) => {
                          const next = Number(e.target.value) || 0;
                          setBorderDraft((prev) => ({
                            ...prev,
                            offset_x: next,
                            offsets_by_context: {
                              ...(prev.offsets_by_context ?? {}),
                              builder: { x: next, y: getBorderOffset("builder").y, scale: getBorderScale("builder") },
                            },
                          }));
                        }}
                        style={input()}
                      />
                      <label style={label()}>Offset Y (builder, px)</label>
                      <input
                        type="number"
                        value={getBorderOffset("builder").y}
                        onChange={(e) => {
                          const next = Number(e.target.value) || 0;
                          setBorderDraft((prev) => ({
                            ...prev,
                            offset_y: next,
                            offsets_by_context: {
                              ...(prev.offsets_by_context ?? {}),
                              builder: { x: getBorderOffset("builder").x, y: next, scale: getBorderScale("builder") },
                            },
                          }));
                        }}
                        style={input()}
                      />
                      <label style={label()}>Scale (builder)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={getBorderScale("builder")}
                        onChange={(e) => {
                          const next = Number(e.target.value) || 1;
                          setBorderScale("builder", next);
                        }}
                        style={input()}
                      />
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        Drag the preview to fine-tune position.
                      </div>
                      <button
                        onClick={() =>
                          setBorderDraft((prev) => ({
                            ...prev,
                            offset_x: 0,
                            offset_y: 0,
                            offsets_by_context: { ...(prev.offsets_by_context ?? {}), builder: { x: 0, y: 0, scale: 1 } },
                          }))
                        }
                        style={ghost()}
                        type="button"
                      >
                        Reset offsets
                      </button>
                      <button
                        onClick={() => {
                          const fitted = autoFitBuilderCode(borderDraft.html ?? "", borderDraft.css ?? "");
                          setBorderDraft((prev) => ({ ...prev, html: fitted.html, css: fitted.css }));
                        }}
                        style={ghost()}
                        type="button"
                      >
                        Auto-fit code
                      </button>
                    </>
                  )}
                  <label style={label()}>Unlock level</label>
                  <input
                    type="number"
                    value={borderDraft.unlock_level ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      setBorderDraft((prev) => ({ ...prev, unlock_level: next === "" ? null : Number(next) }));
                    }}
                    style={input()}
                  />
                  <label style={label()}>Unlock points</label>
                  <input
                    type="number"
                    value={borderDraft.unlock_points ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      setBorderDraft((prev) => ({ ...prev, unlock_points: next === "" ? null : Number(next) }));
                    }}
                    style={input()}
                  />
                  <label style={checkRow()}>
                    <input
                      type="checkbox"
                      checked={borderDraft.enabled !== false}
                      onChange={(e) => setBorderDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => saveAvatarBorder(borderDraft)} style={button()} disabled={busy}>
                    {busy ? "Saving..." : "Save Border"}
                  </button>
                  <button
                    onClick={() =>
                      setBorderDraft({
                        key: "",
                        name: "",
                        render_mode: "code",
                        offset_x: 0,
                        offset_y: 0,
                        offsets_by_context: { builder: { x: 0, y: 0, scale: 1 } },
                        html: "<div class=\"avatar-border\">Border</div>",
                        css: ".avatar-border{width:100%;height:100%;border:3px solid #7cf7d4;border-radius:18px;box-shadow:0 0 24px rgba(124,247,212,0.35);}",
                        js: "",
                        unlock_level: 1,
                        unlock_points: 0,
                        enabled: true,
                      })
                    }
                    style={ghost()}
                  >
                    New Border
                  </button>
                </div>
              </section>
            </div>

            <section style={previewPanel()}>
              <div style={panelTitle()}>Border Preview</div>
              <div style={avatarPreviewWrap()}>
                <div style={avatarPreviewFrame()}>
                  {borderDraft.render_mode === "image" && borderDraft.image_url ? (
                    <img
                      src={borderDraft.image_url}
                      alt="Border"
                      style={{
                        ...avatarPreviewBorder(),
                        transform: `translate(${getBorderOffset("builder").x}px, ${getBorderOffset("builder").y}px) scale(${getBorderScale("builder")})`,
                        cursor: "grab",
                      }}
                      onMouseDown={(event) => startBorderDrag(event, "builder")}
                    />
                  ) : (
                    <div
                      style={{
                        ...avatarPreviewBorder(),
                        transform: `translate(${getBorderOffset("builder").x}px, ${getBorderOffset("builder").y}px) scale(${getBorderScale("builder")})`,
                        cursor: "grab",
                      }}
                      ref={borderPreviewRef}
                      onMouseDown={(event) => startBorderDrag(event, "builder")}
                    />
                  )}
                  <div style={avatarPreviewAvatar()} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.75 }}>Placement previews</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 10 }}>
                  {AVATAR_CONTEXT_PREVIEWS.map((item) => (
                    <div
                      key={item.label}
                      style={{ display: "grid", gap: 6, justifyItems: "center", cursor: "grab" }}
                      onMouseDown={(event) => startBorderDrag(event, item.key)}
                    >
                      <AvatarRender
                        size={item.size}
                        bg="rgba(0,0,0,0.35)"
                        style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)" }}
                        border={borderDraft}
                        effect={{ key: "none" }}
                        cornerOffsets={{ x: -8, y: -8, size: 64 }}
                        bleed={24}
                        contextKey={item.key}
                        fallback={<div style={{ width: "70%", height: "70%", borderRadius: 14, background: "rgba(255,255,255,0.08)" }} />}
                      />
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{item.label}</div>
                      <input
                        type="number"
                        step="0.05"
                        value={getBorderScale(item.key)}
                        onChange={(e) => setBorderScale(item.key, Number(e.target.value) || 1)}
                        style={{ ...input(), width: "100%", fontSize: 11, padding: "6px 8px" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Border Library</div>
                <div style={grid()}>
                  {avatarBorders.map((border) => (
                    <button
                      key={border.id ?? border.key}
                      style={projectCard(String(border.id ?? "") === activeBorderId, false)}
                      onClick={() => setActiveBorderId(String(border.id ?? ""))}
                    >
                      <div style={cardTitle()}>{border.name}</div>
                      <div style={cardMeta()}>{border.key}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}

        {builderTab === "avatar-effect" ? (
          <>
            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Avatar Background Builder</div>
                <div style={grid()}>
                  <div style={helperText()}>
                    Build background effects with particles or custom HTML/CSS/JS.
                  </div>
                  <a href="/admin/custom/media" style={linkBtn()} target="_blank" rel="noreferrer">
                    Open Media Vault
                  </a>
                  <label style={label()}>Saved backgrounds</label>
                  <select
                    value={activeEffectId}
                    onChange={(e) => setActiveEffectId(e.target.value)}
                    style={input()}
                  >
                    <option value="">New background...</option>
                    {avatarEffects.map((effect) => (
                      <option key={effect.id ?? effect.key} value={String(effect.id ?? "")}>
                        {effect.name}
                      </option>
                    ))}
                  </select>
                  <label style={label()}>Key</label>
                  <input
                    value={effectDraft.key ?? ""}
                    onChange={(e) => setEffectDraft((prev) => ({ ...prev, key: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Name</label>
                  <input
                    value={effectDraft.name ?? ""}
                    onChange={(e) => setEffectDraft((prev) => ({ ...prev, name: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Render mode</label>
                  <select
                    value={effectDraft.render_mode ?? "particles"}
                    onChange={(e) => setEffectDraft((prev) => ({ ...prev, render_mode: e.target.value }))}
                    style={input()}
                  >
                    <option value="particles">Particles</option>
                    <option value="code">HTML/CSS/JS</option>
                  </select>
                  {effectDraft.render_mode === "particles" ? (
                    <>
                      <label style={label()}>Density</label>
                      <input
                        type="number"
                        value={effectDraft.config?.density ?? 40}
                        onChange={(e) =>
                          setEffectDraft((prev) => ({
                            ...prev,
                            config: { ...(prev.config ?? {}), density: Number(e.target.value) || 0 },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>Size</label>
                      <input
                        type="number"
                        value={effectDraft.config?.size ?? 6}
                        onChange={(e) =>
                          setEffectDraft((prev) => ({
                            ...prev,
                            config: { ...(prev.config ?? {}), size: Number(e.target.value) || 0 },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>Speed</label>
                      <input
                        type="number"
                        value={effectDraft.config?.speed ?? 6}
                        onChange={(e) =>
                          setEffectDraft((prev) => ({
                            ...prev,
                            config: { ...(prev.config ?? {}), speed: Number(e.target.value) || 0 },
                          }))
                        }
                        style={input()}
                      />
                      <label style={label()}>Opacity</label>
                      <input
                        type="number"
                        value={effectDraft.config?.opacity ?? 70}
                        onChange={(e) =>
                          setEffectDraft((prev) => ({
                            ...prev,
                            config: { ...(prev.config ?? {}), opacity: Number(e.target.value) || 0 },
                          }))
                        }
                        style={input()}
                      />
                    </>
                  ) : (
                    <>
                      <label style={label()}>HTML</label>
                      <textarea
                        value={effectDraft.html ?? ""}
                        onChange={(e) => setEffectDraft((prev) => ({ ...prev, html: e.target.value }))}
                        style={textarea()}
                      />
                      <label style={label()}>CSS</label>
                      <textarea
                        value={effectDraft.css ?? ""}
                        onChange={(e) => setEffectDraft((prev) => ({ ...prev, css: e.target.value }))}
                        style={textarea()}
                      />
                      <label style={label()}>JS</label>
                      <textarea
                        value={effectDraft.js ?? ""}
                        onChange={(e) => setEffectDraft((prev) => ({ ...prev, js: e.target.value }))}
                        style={textarea()}
                      />
                      <button
                        onClick={() => {
                          const fitted = autoFitBuilderCode(effectDraft.html ?? "", effectDraft.css ?? "");
                          setEffectDraft((prev) => ({ ...prev, html: fitted.html, css: fitted.css }));
                        }}
                        style={ghost()}
                        type="button"
                      >
                        Auto-fit code
                      </button>
                    </>
                  )}
                  <label style={label()}>Scale (builder)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={getEffectScale("builder")}
                    onChange={(e) => setEffectScale("builder", Number(e.target.value) || 1)}
                    style={input()}
                  />
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Context scale</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {AVATAR_CONTEXT_PREVIEWS.map((item) => (
                      <label key={item.key} style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>{item.label}</span>
                        <input
                          type="number"
                          step="0.05"
                          value={getEffectScale(item.key)}
                          onChange={(e) => setEffectScale(item.key, Number(e.target.value) || 1)}
                          style={input()}
                        />
                      </label>
                    ))}
                  </div>
                  <label style={label()}>Unlock level</label>
                  <input
                    type="number"
                    value={effectDraft.unlock_level ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEffectDraft((prev) => ({ ...prev, unlock_level: next === "" ? null : Number(next) }));
                    }}
                    style={input()}
                  />
                  <label style={label()}>Unlock points</label>
                  <input
                    type="number"
                    value={effectDraft.unlock_points ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEffectDraft((prev) => ({ ...prev, unlock_points: next === "" ? null : Number(next) }));
                    }}
                    style={input()}
                  />
                  <label style={checkRow()}>
                    <input
                      type="checkbox"
                      checked={effectDraft.enabled !== false}
                      onChange={(e) => setEffectDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => saveAvatarEffect(effectDraft)} style={button()} disabled={busy}>
                    {busy ? "Saving..." : "Save Background"}
                  </button>
                  <button
                    onClick={() =>
                      setEffectDraft({
                        key: "",
                        name: "",
                        render_mode: "particles",
                        config: { density: 40, size: 6, speed: 6, opacity: 70, scale: 1, scale_by_context: { builder: { scale: 1 } } },
                        html: "<div class=\"avatar-bg\"></div>",
                        css: ".avatar-bg{width:100%;height:100%;background:radial-gradient(circle at 20% 20%, rgba(59,130,246,0.4), transparent 60%), radial-gradient(circle at 80% 70%, rgba(34,197,94,0.35), transparent 55%);}",
                        js: "",
                        unlock_level: 1,
                        unlock_points: 0,
                        enabled: true,
                      })
                    }
                    style={ghost()}
                  >
                    New Background
                  </button>
                </div>
              </section>
            </div>

            <section style={previewPanel()}>
              <div style={panelTitle()}>Background Preview</div>
              <div style={avatarPreviewWrap()}>
                <div style={avatarPreviewFrame()}>
                  {effectDraft.render_mode === "particles" ? (
                    <div style={{ ...avatarPreviewBorder(), transform: `scale(${getEffectScale("builder")})`, transformOrigin: "center" }}>
                      <AvatarEffectParticles effectKey={effectDraft.key || "custom"} config={effectDraft.config ?? undefined} />
                    </div>
                  ) : (
                    <div style={{ ...avatarPreviewBorder(), transform: `scale(${getEffectScale("builder")})`, transformOrigin: "center" }} ref={effectPreviewRef} />
                  )}
                  <div style={avatarPreviewAvatar()} />
                </div>
              </div>
            </section>

            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Background Library</div>
                <div style={grid()}>
                  {avatarEffects.map((effect) => (
                    <button
                      key={effect.id ?? effect.key}
                      style={projectCard(String(effect.id ?? "") === activeEffectId, false)}
                      onClick={() => setActiveEffectId(String(effect.id ?? ""))}
                    >
                      <div style={cardTitle()}>{effect.name}</div>
                      <div style={cardMeta()}>{effect.key}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}

        {builderTab === "battle-pulse-effect" ? (
          <>
            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Battle Pulse Effect Builder</div>
                <div style={grid()}>
                  <div style={helperText()}>
                    Build attack, block, counter, and drain effects with HTML/CSS/JS. These fire above the avatars during Battle Pulse.
                  </div>
                  <label style={label()}>Saved effects</label>
                  <select
                    value={activeBattleEffectId}
                    onChange={(e) => setActiveBattleEffectId(e.target.value)}
                    style={input()}
                  >
                    <option value="">New effect...</option>
                    {battlePulseEffects.map((effect) => (
                      <option key={effect.id ?? effect.key} value={String(effect.id ?? "")}>
                        {effect.name}
                      </option>
                    ))}
                  </select>
                  <label style={label()}>Key</label>
                  <input
                    value={battleEffectDraft.key ?? ""}
                    onChange={(e) => setBattleEffectDraft((prev) => ({ ...prev, key: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Name</label>
                  <input
                    value={battleEffectDraft.name ?? ""}
                    onChange={(e) => setBattleEffectDraft((prev) => ({ ...prev, name: e.target.value }))}
                    style={input()}
                  />
                  <label style={label()}>Effect uses</label>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    {["attack", "block", "counter", "drain"].map((type) => {
                      const list = String(battleEffectDraft.effect_types ?? battleEffectDraft.effect_type ?? "attack")
                        .split(",")
                        .map((value) => value.trim().toLowerCase())
                        .filter(Boolean);
                      const checked = list.includes(type);
                      return (
                        <label key={type} style={checkRow()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(list);
                              if (e.target.checked) next.add(type);
                              else next.delete(type);
                              if (!next.size) next.add("attack");
                              const joined = Array.from(next).join(",");
                              setBattleEffectDraft((prev) => ({
                                ...prev,
                                effect_types: joined,
                                effect_type: Array.from(next)[0],
                              }));
                            }}
                          />
                          <span style={{ textTransform: "capitalize" }}>{type}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>Offset X</span>
                      <input
                        type="number"
                        value={battleEffectDraft.offset_x ?? 0}
                        onChange={(e) =>
                          setBattleEffectDraft((prev) => ({ ...prev, offset_x: Number(e.target.value) || 0 }))
                        }
                        style={input()}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>Offset Y</span>
                      <input
                        type="number"
                        value={battleEffectDraft.offset_y ?? 0}
                        onChange={(e) =>
                          setBattleEffectDraft((prev) => ({ ...prev, offset_y: Number(e.target.value) || 0 }))
                        }
                        style={input()}
                      />
                    </label>
                  </div>
                  <label style={label()}>HTML</label>
                  <textarea
                    value={battleEffectDraft.html ?? ""}
                    onChange={(e) => setBattleEffectDraft((prev) => ({ ...prev, html: e.target.value }))}
                    style={textarea()}
                  />
                  <label style={label()}>CSS</label>
                  <textarea
                    value={battleEffectDraft.css ?? ""}
                    onChange={(e) => setBattleEffectDraft((prev) => ({ ...prev, css: e.target.value }))}
                    style={textarea()}
                  />
                  <label style={label()}>JS</label>
                  <textarea
                    value={battleEffectDraft.js ?? ""}
                    onChange={(e) => setBattleEffectDraft((prev) => ({ ...prev, js: e.target.value }))}
                    style={textarea()}
                  />
                  <label style={checkRow()}>
                    <input
                      type="checkbox"
                      checked={battleEffectDraft.enabled !== false}
                      onChange={(e) => setBattleEffectDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => saveBattlePulseEffect(battleEffectDraft)} style={button()} disabled={busy}>
                    {busy ? "Saving..." : "Save Effect"}
                  </button>
                  <button
                    onClick={() =>
                      setBattleEffectDraft({
                        key: "",
                        name: "",
                        effect_type: "attack",
                        effect_types: "attack",
                        offset_x: 0,
                        offset_y: 0,
                        html: "<div class=\"bombardment\"><canvas class=\"fx\"></canvas></div>",
                        css: `.bombardment{position:absolute;inset:0;border-radius:18px;overflow:hidden;pointer-events:none;}
.bombardment canvas{position:absolute;inset:0;width:100%;height:100%;display:block;mix-blend-mode:screen;opacity:.9;}`,
                        js: `(() => {
  const wrap = document.querySelector(\".bombardment\");
  const canvas = wrap ? wrap.querySelector(\"canvas\") : null;
  if (!wrap || !canvas) return;
  const ctx = canvas.getContext(\"2d\", { alpha: true });
  if (!ctx) return;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const { width, height } = wrap.getBoundingClientRect();
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  let W = 0, H = 0;
  function onResize() {
    const r = resizeCanvas();
    W = r.width; H = r.height;
  }
  onResize();
  window.addEventListener(\"resize\", onResize);

  let running = false;
  let rafId = 0;
  let lastT = 0;
  let shake = 0;
  const fireballs = [];
  const particles = [];

  const CFG = {
    spawnRate: 3.0,
    maxFireballs: 18,
    gravity: 1300,
    wind: 80,
    trailParticles: 6,
    impactBurst: 42,
    smokeBurst: 14,
    sparkBurst: 22,
  };

  function spawnFireball(x = rand(0.15, 0.85) * W) {
    if (fireballs.length >= CFG.maxFireballs) return;
    const y = -rand(30, 120);
    const speedY = rand(520, 850);
    const speedX = rand(-CFG.wind, CFG.wind);
    fireballs.push({
      x, y,
      vx: speedX,
      vy: speedY,
      r: rand(7, 12),
      heat: rand(0.7, 1.0),
      rot: rand(0, Math.PI * 2),
      spin: rand(-3, 3),
    });
  }

  function addParticle(p) {
    particles.push(p);
  }

  function explosion(x, y, power = 1) {
    const n = Math.floor(CFG.impactBurst * power);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(220, 820) * power;
      addParticle({
        type: \"ember\",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(2.0, 4.5) * power,
        life: rand(0.35, 0.75),
        t: 0,
        heat: rand(0.8, 1.2),
      });
    }

    const s = Math.floor(CFG.sparkBurst * power);
    for (let i = 0; i < s; i++) {
      const a = rand(-Math.PI, 0);
      const sp = rand(500, 1400) * power;
      addParticle({
        type: \"spark\",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(1.0, 2.0),
        life: rand(0.15, 0.35),
        t: 0,
      });
    }

    const m = Math.floor(CFG.smokeBurst * power);
    for (let i = 0; i < m; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 220) * power;
      addParticle({
        type: \"smoke\",
        x: x + rand(-8, 8),
        y: y + rand(-8, 8),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(80, 160),
        r: rand(10, 22) * power,
        life: rand(0.7, 1.4),
        t: 0,
      });
    }

    shake = Math.max(shake, 10 * power);
  }

  function drawGlowCircle(x, y, r, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, \`rgba(255,240,200,\${alpha})\`);
    g.addColorStop(0.35, \`rgba(255,160,60,\${alpha * 0.9})\`);
    g.addColorStop(0.75, \`rgba(255,60,0,\${alpha * 0.35})\`);
    g.addColorStop(1, \`rgba(255,60,0,0)\`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function clear(dt) {
    ctx.globalCompositeOperation = \"destination-out\";
    ctx.fillStyle = \`rgba(0,0,0,\${clamp(0.18 + dt * 0.12, 0.12, 0.28)})\`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = \"source-over\";
  }

  let spawnAcc = 0;
  function step(t) {
    if (!running) return;
    const now = t * 0.001;
    const dt = Math.min(0.033, now - lastT || 0.016);
    lastT = now;

    spawnAcc += dt * CFG.spawnRate;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      spawnFireball();
    }

    shake = Math.max(0, shake - dt * 18);
    clear(dt);

    ctx.save();
    if (shake > 0.001) {
      const sx = rand(-shake, shake) * 0.3;
      const sy = rand(-shake, shake) * 0.3;
      ctx.translate(sx, sy);
    }

    for (let i = fireballs.length - 1; i >= 0; i--) {
      const b = fireballs[i];
      b.vy += CFG.gravity * dt;
      b.vx += rand(-20, 20) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;

      const trailCount = Math.floor(CFG.trailParticles * (dt / 0.016));
      for (let k = 0; k < trailCount; k++) {
        addParticle({
          type: \"trail\",
          x: b.x + rand(-b.r * 0.2, b.r * 0.2),
          y: b.y + rand(-b.r * 0.2, b.r * 0.2),
          vx: -b.vx * rand(0.05, 0.12),
          vy: -b.vy * rand(0.05, 0.12),
          r: rand(2.5, 5.0) * b.heat,
          life: rand(0.12, 0.22),
          t: 0,
          heat: b.heat
        });
      }

      if (b.y + b.r >= H - 2) {
        explosion(clamp(b.x, 8, W - 8), H - 4, rand(0.85, 1.25));
        fireballs.splice(i, 1);
        continue;
      }

      ctx.globalCompositeOperation = \"lighter\";
      drawGlowCircle(b.x, b.y, b.r * 3.2, 0.35 * b.heat);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = \"rgba(255,220,160,0.95)\";
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = \"rgba(255,110,30,0.75)\";
      ctx.beginPath();
      ctx.arc(-b.r * 0.2, -b.r * 0.2, b.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = \"source-over\";
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      const life = p.life;
      const u = p.t / life;
      if (u >= 1) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === \"smoke\") {
        p.vx *= (1 - dt * 0.7);
        p.vy *= (1 - dt * 0.6);
        p.vy -= 40 * dt;
        p.r *= (1 + dt * 0.35);
      } else if (p.type === \"spark\") {
        p.vy += CFG.gravity * 0.35 * dt;
        p.vx *= (1 - dt * 2.8);
        p.vy *= (1 - dt * 2.2);
      } else {
        p.vy += CFG.gravity * 0.2 * dt;
        p.vx *= (1 - dt * 1.6);
        p.vy *= (1 - dt * 1.3);
      }

      if (p.x < -200 || p.x > W + 200 || p.y < -250 || p.y > H + 250) {
        particles.splice(i, 1);
        continue;
      }

      const fade = 1 - u;
      if (p.type === \"trail\") {
        ctx.globalCompositeOperation = \"lighter\";
        drawGlowCircle(p.x, p.y, p.r * 2.0, 0.18 * fade * (p.heat || 1));
        ctx.globalCompositeOperation = \"source-over\";
      } else if (p.type === \"ember\") {
        ctx.globalCompositeOperation = \"lighter\";
        drawGlowCircle(p.x, p.y, p.r * 3.0, 0.22 * fade);
        ctx.fillStyle = \`rgba(255,210,140,\${0.8 * fade})\`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.55 + 0.25 * (1 - u)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = \"source-over\";
      } else if (p.type === \"spark\") {
        ctx.globalCompositeOperation = \"lighter\";
        ctx.strokeStyle = \`rgba(255,255,240,\${0.85 * fade})\`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
        ctx.stroke();
        ctx.globalCompositeOperation = \"source-over\";
      } else if (p.type === \"smoke\") {
        ctx.globalCompositeOperation = \"source-over\";
        const a = 0.22 * fade;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, \`rgba(80,80,90,\${a})\`);
        g.addColorStop(0.6, \`rgba(50,50,60,\${a * 0.7})\`);
        g.addColorStop(1, \"rgba(20,20,30,0)\");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = 0;
    for (let i = 0; i < 3; i++) spawnFireball(rand(0.15, 0.85) * W);
    rafId = requestAnimationFrame(step);
  }

  start();
})();`,
                        enabled: true,
                      })
                    }
                    style={ghost()}
                  >
                    New Effect
                  </button>
                </div>
              </section>
            </div>

            <section style={previewPanel()}>
              <div style={panelTitle()}>Effect Preview</div>
              <div style={avatarPreviewWrap()}>
                <div
                  style={{
                    width: 560,
                    height: 220,
                    borderRadius: 16,
                    position: "relative",
                    overflow: "hidden",
                    background: "linear-gradient(120deg, rgba(15,23,42,0.7), rgba(2,6,23,0.9))",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "grid",
                    alignItems: "end",
                    padding: 16,
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      transform: `translate(${battleEffectDraft.offset_x ?? 0}px, ${battleEffectDraft.offset_y ?? 0}px)`,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                    ref={battleEffectPreviewRef}
                  />
                  <div
                    onMouseDown={(event) => {
                      event.preventDefault();
                      battleEffectDragRef.current = {
                        startX: event.clientX,
                        startY: event.clientY,
                        offsetX: battleEffectDraft.offset_x ?? 0,
                        offsetY: battleEffectDraft.offset_y ?? 0,
                      };
                      setBattleEffectDragging(true);
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      cursor: battleEffectDragging ? "grabbing" : "grab",
                      zIndex: 3,
                    }}
                    title="Drag to reposition effect"
                  />
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", width: "100%", position: "relative", zIndex: 1 }}>
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 14,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  Drag the preview to set offset. Effects are rendered wide above avatars in battle.
                </div>
              </div>
            </section>

            <div style={column()}>
              <section style={sidePanel()}>
                <div style={panelTitle()}>Effect Library</div>
                <div style={grid()}>
                  {battlePulseEffects.map((effect) => (
                    <button
                      key={effect.id ?? effect.key}
                      style={projectCard(String(effect.id ?? "") === activeBattleEffectId, false)}
                      onClick={() => setActiveBattleEffectId(String(effect.id ?? ""))}
                    >
                      <div style={cardTitle()}>{effect.name}</div>
                      <div style={cardMeta()}>{effect.key}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeBuilderHtml(html: string) {
  const cleaned = String(html || "")
    .replace(/<\s*\/?\s*html[^>]*>/gi, "")
    .replace(/<\s*\/?\s*head[^>]*>/gi, "")
    .replace(/<\s*\/?\s*body[^>]*>/gi, "")
    .trim();
  if (!cleaned) return `<div class="builder-root"></div>`;
  if (cleaned.includes("builder-root")) return cleaned;
  return `<div class="builder-root">${cleaned}</div>`;
}

function stripGlobalCss(css: string) {
  return String(css || "").replace(/(^|})\s*(html|body)(\s*,\s*(html|body))*\s*\{[^}]*\}/gi, "$1");
}

function autoFitBuilderCode(html: string, css: string) {
  const rootCss = `
.builder-root{
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
  background: transparent !important;
  background-image: none !important;
}
.builder-root *{ box-sizing: border-box; }
.builder-root img,
.builder-root video{
  max-width: 100%;
  max-height: 100%;
}
`.trim();
  return {
    html: normalizeBuilderHtml(html),
    css: `${rootCss}\n${stripGlobalCss(css)}`.trim(),
  };
}

function splitComma(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderFlyerHtml(state: typeof defaultValues) {
  const endDate = state.endDate ? new Date(state.endDate) : new Date();
  const endText = endDate.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const chips = splitComma(state.chips);
  const details = splitLines(state.details);
  const learn = splitLines(state.learn);
  const tags = splitComma(state.footerTags);
  const accent = `hsl(${state.accentHue}, 78%, 62%)`;
  const accentSoft = `hsl(${state.accentHue + 12}, 90%, 76%)`;
  const logoFilter = state.logoInvert ? "filter: invert(1) hue-rotate(180deg) brightness(1.05);" : "";
  const logo = state.logoUrl
    ? `<img src="${state.logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:12px;transform:scale(${state.logoImageScale});${logoFilter}" />`
    : `<span class="logoMark">${state.logoFallbackText}</span>`;
  const countdownEmbed = state.countdownHtml?.trim();
  const countdownImage = state.countdownImageUrl
    ? `<img src="${state.countdownImageUrl}" alt="Countdown" class="countdownImg" />`
    : "";
  const pointsBlock = state.pointsEnabled
    ? `<div class="pointsPill"><span>${state.pointsLabel}</span><strong>${state.pointsValue}</strong><em>${state.pointsSuffix}</em></div>`
    : "";
  const countdownBlock = countdownEmbed
    ? `<div class="countdownEmbed">${countdownEmbed}</div>`
    : countdownImage ||
      `
        <div class="countdown" aria-label="Discount countdown">
          <div class="timeBox"><span>00</span><small>${state.countdownDaysLabel}</small></div>
          <div class="timeBox"><span>00</span><small>${state.countdownHoursLabel}</small></div>
          <div class="timeBox"><span>00</span><small>${state.countdownMinsLabel}</small></div>
          <div class="timeBox"><span>00</span><small>${state.countdownSecsLabel}</small></div>
        </div>
      `;

  return `
    <style>
      :root{
        --accent:${accent};
        --accent2:${accentSoft};
      }
    </style>
    <div class="snow" aria-hidden="true"></div>
    <header class="header">
    <div class="brand">
      <div class="logo" aria-hidden="true" style="width:${state.logoBoxWidth}px;height:${state.logoBoxHeight}px;">
        ${logo}
      </div>
      <div class="brandText">
        <div class="dojoName inline-edit" data-scope="email" data-field="dojoName" contenteditable="true">${state.dojoName}</div>
        <div class="dojoTag inline-edit" data-scope="email" data-field="dojoTag" contenteditable="true">${state.dojoTag}</div>
      </div>
    </div>
      <div class="promo">
      <div class="promoBadge">
        <div class="promoTop inline-edit" data-scope="email" data-field="promoTopLabel" contenteditable="true">${state.promoTopLabel}</div>
        <div class="promoBig inline-edit" data-scope="email" data-field="promoAmount" contenteditable="true">${state.promoAmount}</div>
        <div class="promoBottom inline-edit" data-scope="email" data-field="promoUnit" contenteditable="true">${state.promoUnit}</div>
      </div>
      <div class="promoInfo">
        <div class="promoLine"><span class="inline-edit" data-scope="email" data-field="promoEndsLabel" contenteditable="true">${state.promoEndsLabel}</span> <span class="inline-edit" data-scope="email" data-field="endDate" contenteditable="true">${endText}</span></div>
        ${countdownBlock}
      </div>
    </div>
    </header>
    <main class="content">
      <div class="hero">
      <div class="eyebrow inline-edit" data-scope="email" data-field="eyebrow" contenteditable="true">
        <span class="flake" aria-hidden="true">❄</span>
        ${state.eyebrow}
      </div>
      <h1 class="title">
        <span class="inline-edit" data-scope="email" data-field="titleMain" contenteditable="true">${state.titleMain}</span>
        <span class="accent inline-edit" data-scope="email" data-field="titleAccent" contenteditable="true">${state.titleAccent}</span>
      </h1>
      <p class="subtitle inline-edit" data-scope="email" data-field="subtitle" contenteditable="true">${state.subtitle}</p>
      <div class="chips" aria-label="Highlights">
        ${chips
          .map(
            (chip) =>
              `<span class="chip inline-edit" data-scope="email" data-field="chips" contenteditable="true">${chip}</span>`
          )
          .join("")}
      </div>
      ${pointsBlock}
      <div class="ctaRow">
        <a class="ctaBtn" href="${state.ctaUrl}">
          <span class="inline-edit" data-scope="email" data-field="ctaText" contenteditable="true">${state.ctaText}</span>
          <span class="ctaArrow" aria-hidden="true">→</span>
        </a>
        <div class="ctaNote">
          <span class="inline-edit" data-scope="email" data-field="discountPrefix" contenteditable="true">${state.discountPrefix}</span>
          <strong class="inline-edit" data-scope="email" data-field="discountCode" contenteditable="true">${state.discountCode}</strong>
          <span class="dot" aria-hidden="true">•</span>
          <span class="finePrint inline-edit" data-scope="email" data-field="discountNote" contenteditable="true">${state.discountNote}</span>
        </div>
      </div>
    </div>
      <aside class="details">
        <div class="card">
        <div class="cardTitle inline-edit" data-scope="email" data-field="detailsTitle" contenteditable="true">${state.detailsTitle}</div>
        <ul class="list">
          ${details
              .map(
                (item) =>
                  `<li><span class="bullet" aria-hidden="true">✓</span> <span class="inline-edit" data-scope="email" data-field="details" contenteditable="true">${item}</span></li>`
              )
              .join("")}
        </ul>
      </div>
      <div class="card">
        <div class="cardTitle inline-edit" data-scope="email" data-field="learnTitle" contenteditable="true">${state.learnTitle}</div>
        <ul class="list">
          ${learn
              .map(
                (item) =>
                  `<li><span class="bullet" aria-hidden="true">⚡</span> <span class="inline-edit" data-scope="email" data-field="learn" contenteditable="true">${item}</span></li>`
              )
              .join("")}
        </ul>
      </div>
      <div class="contactStrip">
        <div class="contactItem">
          <div class="label inline-edit" data-scope="email" data-field="contactLabelPhone" contenteditable="true">${state.contactLabelPhone}</div>
          <div class="value inline-edit" data-scope="email" data-field="contactPhone" contenteditable="true">${state.contact.phone}</div>
        </div>
        <div class="contactItem">
          <div class="label inline-edit" data-scope="email" data-field="contactLabelLocation" contenteditable="true">${state.contactLabelLocation}</div>
          <div class="value inline-edit" data-scope="email" data-field="contactLocation" contenteditable="true">${state.contact.location}</div>
        </div>
        <div class="contactItem">
          <div class="label inline-edit" data-scope="email" data-field="contactLabelWebsite" contenteditable="true">${state.contactLabelWebsite}</div>
          <div class="value inline-edit" data-scope="email" data-field="contactWebsite" contenteditable="true">${state.contact.website}</div>
        </div>
      </div>
    </aside>
    </main>
    <footer class="footer">
      <div class="footerLeft">
        <span class="miniFlake" aria-hidden="true">❄</span>
        <span class="inline-edit" data-scope="email" data-field="footerLeft" contenteditable="true">${state.footerLeft}</span>
      </div>
      <div class="footerRight">
        ${tags
          .map(
            (tag) =>
              `<span class="tag inline-edit" data-scope="email" data-field="footerTags" contenteditable="true">${tag}</span>`
          )
          .join("")}
      </div>
    </footer>
  `;
}

function buildEmailHtml(state: typeof defaultValues) {
  const body = renderFlyerHtml(state);
  const styleVars = styleString(emailVars(state));
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${state.titleMain}</title>
    <style>${previewCss}</style>
  </head>
  <body>
    <div class="flyer" data-theme="${state.theme}" style="${styleVars}" role="region" aria-label="Winter Camp Flyer">
      ${body}
    </div>
  </body>
</html>`;
}

function renderFlyerCard(state: typeof defaultFlyer) {
  const sizeClass = state.size === "square" ? "flyerSquare" : "flyerPortrait";
  const maskClass = `mask-${state.maskShape || "soft-rect"}`;
  const bgImage = state.backgroundImage ? `url('${state.backgroundImage}')` : "none";
  const textureClass = `texture-${state.texture}${state.textureAnimated ? " is-animated" : ""}`;
  const sizeOrAuto = (value: number) => (value ? `${value}px` : "auto");
  const logoWidth = state.logoBoxWidth || state.logoBoxSize;
  const logoHeight = state.logoBoxHeight || state.logoBoxSize;
  const discount = state.discountEnabled ? `<div class="flyerDiscount">${state.discountText}</div>` : "";
  const points = state.pointsEnabled
    ? `<div class="flyerPoints"><span>${state.pointsLabel}</span><strong>${state.pointsValue}</strong><em>${state.pointsSuffix}</em></div>`
    : "";
  const logo = state.logoUrl
    ? `<img src="${state.logoUrl}" alt="Logo" class="flyerLogo" />`
    : `<div class="flyerLogoText inline-edit" data-scope="flyer" data-field="logoFallbackText" contenteditable="true">${state.logoFallbackText}</div>`;

  return `
    <div class="flyerCanvas ${sizeClass} ${maskClass}" style="--bg-color:${state.backgroundColor};--bg-image:${bgImage};--edge:${state.edgeSoftness}px;--border-color:${state.borderColor};--mask-feather:${state.maskFeather}px;--container-bg:${state.containerBgColor};--container-opacity:${state.containerEnabled ? state.containerBgOpacity : 0};--bg-pos-x:${state.bgPosX}%;--bg-pos-y:${state.bgPosY}%;--bg-size-x:${state.bgSizeX}%;--bg-size-y:${state.bgSizeY}%;--text-color:${state.textColor};--logo-x:${state.logoOffsetX}px;--logo-y:${state.logoOffsetY}px;--logo-scale:${state.logoScale * state.logoImageScale};--logo-size:${state.logoBoxSize}px;--logo-w:${logoWidth}px;--logo-h:${logoHeight}px;--logo-filter:${state.logoInvert ? "invert(1) hue-rotate(180deg) brightness(1.1)" : "none"};--discount-x:${state.discountOffsetX}px;--discount-y:${state.discountOffsetY}px;--discount-scale:${state.discountScale};--discount-w:${sizeOrAuto(state.discountWidth)};--discount-h:${sizeOrAuto(state.discountHeight)};--cta-x:${state.ctaOffsetX}px;--cta-y:${state.ctaOffsetY}px;--cta-scale:${state.ctaScale};--cta-w:${sizeOrAuto(state.ctaWidth)};--cta-h:${sizeOrAuto(state.ctaHeight)};--points-x:${state.pointsOffsetX}px;--points-y:${state.pointsOffsetY}px;--points-scale:${state.pointsScale};--points-border:${state.pointsBorderColor};--points-size:${state.pointsSize};--points-w:${sizeOrAuto(state.pointsWidth)};--points-h:${sizeOrAuto(state.pointsHeight)};--content-x:${state.contentOffsetX}px;--content-y:${state.contentOffsetY}px;--content-scale:${state.contentScale};">
      <div class="flyerBg"></div>
      <div class="flyerTexture ${textureClass}"></div>
      <div class="flyerEdge"></div>
      <div class="flyerContent">
        ${logo}
        ${state.discountEnabled ? `<div class="flyerDiscount inline-edit" data-scope="flyer" data-field="discountText" contenteditable="true">${state.discountText}</div>` : ""}
        <div class="flyerTitle inline-edit" data-scope="flyer" data-field="title" contenteditable="true">${state.title}</div>
        <div class="flyerSubtitle inline-edit" data-scope="flyer" data-field="subtitle" contenteditable="true">${state.subtitle}</div>
        ${
          state.pointsEnabled
            ? `<div class="flyerPoints"><span class="inline-edit" data-scope="flyer" data-field="pointsLabel" contenteditable="true">${state.pointsLabel}</span><strong class="inline-edit" data-scope="flyer" data-field="pointsValue" contenteditable="true">${state.pointsValue}</strong><em class="inline-edit" data-scope="flyer" data-field="pointsSuffix" contenteditable="true">${state.pointsSuffix}</em></div>`
            : ""
        }
        <a class="flyerCta" href="${state.ctaUrl}"><span class="inline-edit" data-scope="flyer" data-field="ctaText" contenteditable="true">${state.ctaText}</span></a>
      </div>
    </div>
  `;
}

function buildFlyerHtml(state: typeof defaultFlyer) {
  const body = renderFlyerCard(state);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${state.title}</title>
    <style>${flyerCss}</style>
  </head>
  <body>
    <div class="flyer" data-theme="flyer">
      ${body}
    </div>
  </body>
</html>`;
}

const previewCss = `
  :root{
    --bg1:#070a12;
    --bg2:#0b1630;
    --ice:#bfe7ff;
    --mint:#7cf7d4;
    --text:#eaf2ff;
    --muted: rgba(234,242,255,.75);
    --glass: rgba(255,255,255,.08);
    --glass2: rgba(255,255,255,.12);
    --stroke: rgba(255,255,255,.18);
    --shadow: 0 24px 60px rgba(0,0,0,.55);
  }
  *{box-sizing:border-box}
  .previewFrame .flyer{
    width: 100%;
    max-width: none;
  }
  .flyer{
    width:min(980px, 100%);
    border-radius:24px;
    overflow:hidden;
    position:relative;
    box-shadow: var(--shadow);
    border:1px solid rgba(255,255,255,.16);
    background:
      radial-gradient(650px 380px at 10% 20%, rgba(191,231,255,.16), transparent 60%),
      radial-gradient(680px 420px at 100% 10%, rgba(124,247,212,.12), transparent 55%),
      linear-gradient(140deg, var(--bg1), var(--bg2));
    backdrop-filter: blur(10px);
    color: var(--text-color, var(--text));
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif;
  }
  .flyer::before{
    content:"";
    position:absolute;
    inset:0;
    background: var(--container-bg);
    opacity: var(--container-opacity);
    z-index:0;
  }
  .inline-edit{
    outline: 1px dashed rgba(255,255,255,0.22);
    outline-offset: 2px;
    border-radius: 8px;
    padding: 2px 6px;
    background: rgba(255,255,255,0.04);
  }
  .inline-active{
    outline: 6px solid var(--accent2);
  }
  .flyer > *{
    position:relative;
    z-index:1;
  }
  .snow{
    position:absolute; inset:0;
    pointer-events:none;
    opacity:var(--snow-opacity, .55);
    filter: blur(.1px);
    background-image:
      radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1.5px),
      radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 2px),
      radial-gradient(circle, rgba(255,255,255,0.25) 2px, transparent 3px);
    background-size: 18px 18px, 32px 32px, 70px 70px;
    background-position: 0 0, 10px 12px, -10px -20px;
  }
  .header{
    display:flex;
    justify-content:space-between;
    gap:18px;
    padding:22px 26px;
    border-bottom: 1px solid rgba(255,255,255,.10);
    background: linear-gradient(90deg, rgba(255,255,255,.06), transparent 65%);
  }
  .brand{ display:flex; align-items:center; gap:14px; }
  .logo{
    border-radius:16px;
    display:grid; place-items:center;
    background:
      radial-gradient(circle at 30% 30%, rgba(191,231,255,.55), rgba(255,255,255,.06)),
      linear-gradient(180deg, var(--accent), rgba(255,255,255,.06));
    border:1px solid rgba(255,255,255,.18);
    box-shadow: 0 10px 25px rgba(0,0,0,.25);
    overflow: hidden;
    width: var(--logo-box-w, 72px);
    height: var(--logo-box-h, 72px);
    transform: translate(var(--logo-x, 0px), var(--logo-y, 0px)) scale(var(--logo-scale, 1));
    transform-origin: top left;
  }
  .logoMark{ font-weight:900; font-size:24px; letter-spacing:.5px; }
  .dojoName{ font-weight:800; letter-spacing:.3px; font-size:16px; }
  .dojoTag{ font-size:12px; color:var(--muted); margin-top:2px; }
  .promo{
    display:flex;
    align-items:center;
    gap:14px;
    transform: translate(var(--promo-x, 0px), var(--promo-y, 0px)) scale(var(--promo-scale, 1));
    transform-origin: top right;
  }
  .promoBadge{
    width: var(--promo-w, 92px);
    height: var(--promo-h, auto);
    border-radius:18px;
    padding:10px 10px 12px;
    text-align:center;
    background:
      radial-gradient(circle at 20% 10%, var(--accent), rgba(255,255,255,.08)),
      linear-gradient(180deg, var(--accent2), rgba(255,255,255,.06));
    border:1px solid rgba(255,255,255,.20);
    box-shadow: 0 18px 35px rgba(0,0,0,.35);
    position:relative;
  }
  .promoTop{ font-size:11px; letter-spacing:.16em; opacity:.85; }
  .promoBig{ font-size:30px; font-weight:900; line-height:1.0; margin:2px 0; }
  .promoBottom{ font-size:12px; font-weight:800; letter-spacing:.14em; opacity:.9; }
  .promoInfo{ min-width: 260px; }
  .promoLine{ font-size:12px; color:var(--muted); margin-bottom:8px; }
  .countdownImg{
    width: 100%;
    max-width: 280px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.14);
    display: block;
  }
  .countdownEmbed{
    width: 100%;
    max-width: 320px;
  }
  .countdownEmbed img{
    max-width: 100%;
    height: auto;
    display: block;
  }
  .flyer[data-theme="spring"]{
    --bg1:#0b2b1d;
    --bg2:#1d5c3b;
    --snow-opacity:.25;
  }
  .flyer[data-theme="summer"]{
    --bg1:#0c1b3a;
    --bg2:#0f5d7a;
    --snow-opacity:.15;
  }
  .flyer[data-theme="inferno"]{
    --bg1:#2a0b0b;
    --bg2:#7b1d0f;
    --snow-opacity:.12;
  }
  .flyer[data-theme="spotlight"]{
    --bg1:#0b0f1d;
    --bg2:#2b0f3b;
    --snow-opacity:.35;
  }
  .countdown{ display:flex; gap:8px; align-items:stretch; }
  .timeBox{
    width:64px;
    border-radius:14px;
    padding:10px 8px;
    background: rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.14);
    text-align:center;
  }
  .timeBox span{ display:block; font-weight:900; font-size:18px; }
  .timeBox small{ display:block; margin-top:2px; font-size:10px; letter-spacing:.14em; opacity:.75; }
  .content{
    display:grid;
    grid-template-columns: 1.25fr .95fr;
    gap:18px;
    padding:22px 26px 24px;
  }
  .hero{
    padding:20px 18px;
    border-radius:20px;
    border:1px solid rgba(255,255,255,.12);
    background:
      radial-gradient(520px 340px at 0% 0%, rgba(191,231,255,.16), transparent 60%),
      linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
    transform: translate(var(--hero-x, 0px), var(--hero-y, 0px)) scale(var(--hero-scale, 1));
    transform-origin: top left;
  }
  .eyebrow{
    display:inline-flex;
    align-items:center;
    gap:10px;
    padding:8px 12px;
    border-radius:999px;
    border:1px solid var(--accent2);
    background: rgba(255,255,255,.06);
    font-size:12px;
    letter-spacing:.08em;
    text-transform:uppercase;
    color: rgba(234,242,255,.86);
  }
  .title{
    margin:14px 0 10px;
    font-size:44px;
    line-height:1.02;
    letter-spacing:-.02em;
  }
  .title .accent{
    display:block;
    font-size:22px;
    margin-top:10px;
    font-weight:800;
    color: var(--accent2);
  }
  .subtitle{
    margin:0;
    color:var(--muted);
    font-size:14px;
    line-height:1.6;
    max-width: 56ch;
  }
  .chips{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin:16px 0 18px;
  }
  .chip{
    padding:10px 12px;
    border-radius:999px;
    font-size:12px;
    border:1px solid var(--accent2);
    background: rgba(255,255,255,.05);
    color: rgba(234,242,255,.88);
  }
  .pointsPill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    margin:0 0 12px;
    padding: calc(8px * var(--points-size, 1)) calc(12px * var(--points-size, 1));
    border-radius:999px;
    border:1px solid var(--points-border, var(--accent2));
    background: rgba(255,255,255,.08);
    font-size: calc(12px * var(--points-size, 1));
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.06em;
    transform: translate(var(--points-x, 0px), var(--points-y, 0px)) scale(var(--points-scale, 1));
    transform-origin: top left;
    width: var(--points-w, auto);
    height: var(--points-h, auto);
  }
  .pointsPill strong{
    font-size: calc(14px * var(--points-size, 1));
    color: #0b1220;
    background: var(--accent);
    padding: calc(4px * var(--points-size, 1)) calc(8px * var(--points-size, 1));
    border-radius:999px;
  }
  .pointsPill em{
    font-style:normal;
    opacity:.85;
  }
  .ctaRow{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    gap:12px 14px;
    width: var(--cta-w, auto);
    height: var(--cta-h, auto);
  }
  .ctaBtn{
    display:inline-flex;
    align-items:center;
    gap:10px;
    padding:12px 14px;
    border-radius:16px;
    font-weight:900;
    text-decoration:none;
    color: #071019;
    background:
      radial-gradient(circle at 30% 20%, rgba(255,255,255,.55), rgba(255,255,255,.15)),
      linear-gradient(90deg, var(--accent), var(--accent2));
    box-shadow: 0 18px 35px rgba(0,0,0,.32);
    border: 1px solid rgba(255,255,255,.18);
    transform: translate(var(--cta-x, 0px), var(--cta-y, 0px)) scale(var(--cta-scale, 1));
    transform-origin: top left;
  }
  .ctaArrow{ font-size:18px; }
  .ctaNote{ font-size:12px; color: rgba(234,242,255,.82); }
  .ctaNote strong{ color: rgba(234,242,255,.98); }
  .dot{ margin: 0 8px; opacity:.6; }
  .finePrint{ opacity:.8; }
  .details{
    display:flex;
    flex-direction:column;
    gap:12px;
    transform: translate(var(--details-x, 0px), var(--details-y, 0px)) scale(var(--details-scale, 1));
    transform-origin: top left;
  }
  .details .card{
    width: var(--details-w, auto);
    height: var(--details-h, auto);
  }
  .card{
    padding:16px 16px;
    border-radius:18px;
    border:1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.05);
  }
  .cardTitle{
    font-weight:900;
    letter-spacing:.02em;
    margin-bottom:10px;
    display:flex;
    align-items:center;
    gap:10px;
  }
  .list{
    list-style:none;
    padding:0;
    margin:0;
    display:grid;
    gap:10px;
    color: rgba(234,242,255,.86);
    font-size:13px;
  }
  .bullet{
    display:inline-grid;
    width:18px;
    place-items:center;
    margin-right:8px;
    opacity:.9;
  }
  .contactStrip{
    display:grid;
    grid-template-columns: 1fr;
    gap:10px;
    padding:14px 16px;
    border-radius:18px;
    border:1px solid rgba(255,255,255,.12);
    background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  }
  .contactItem{
    display:flex;
    justify-content:space-between;
    gap:14px;
    padding:10px 12px;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.10);
    background: rgba(0,0,0,.12);
  }
  .label{ font-size:11px; letter-spacing:.12em; opacity:.70; text-transform:uppercase; }
  .value{ font-weight:800; }
  .footer{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:12px;
    padding:16px 26px;
    border-top: 1px solid rgba(255,255,255,.10);
    background: linear-gradient(90deg, rgba(255,255,255,.04), transparent 60%);
  }
  .footerLeft{ display:flex; align-items:center; gap:10px; color: rgba(234,242,255,.78); font-size:12px; }
  .footerRight{ display:flex; gap:8px; flex-wrap:wrap; }
  .tag{
    padding:8px 10px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.05);
    font-size:11px;
    letter-spacing:.10em;
    opacity:.9;
  }
  @media (max-width: 920px){
    .header{ flex-direction:column; align-items:flex-start; }
    .promoInfo{ min-width: unset; }
    .content{ grid-template-columns:1fr; }
    .title{ font-size:38px; }
  }
`;

const flyerCss = `
  *{box-sizing:border-box}
  .flyer{
    display:grid;
    place-items:center;
    width:100%;
  }
  .inline-edit{
    outline: 1px dashed rgba(255,255,255,0.28);
    outline-offset: 2px;
    border-radius: 8px;
    padding: 2px 6px;
    background: rgba(255,255,255,0.04);
  }
  .inline-active{
    outline: 6px solid rgba(124,247,212,0.8);
  }
  .flyerCanvas{
    position:relative;
    width:var(--flyer-width);
    height:var(--flyer-height);
    border-radius:24px;
    border:4px solid var(--border-color);
    overflow:hidden;
    background: var(--bg-color);
    box-shadow: 0 30px 60px rgba(0,0,0,.35);
  }
  .flyerCanvas::after{
    content:"";
    position:absolute;
    inset:0;
    background: var(--container-bg);
    opacity: var(--container-opacity);
    pointer-events:none;
    z-index:1;
  }
  .mask-soft-rect{
    -webkit-mask-image: linear-gradient(#000, #000);
    mask-image: linear-gradient(#000, #000);
    -webkit-mask-size: calc(100% - var(--mask-feather) * 2) calc(100% - var(--mask-feather) * 2);
    mask-size: calc(100% - var(--mask-feather) * 2) calc(100% - var(--mask-feather) * 2);
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
  }
  .mask-oval{
    -webkit-mask-image: radial-gradient(ellipse at center, #000 calc(100% - var(--mask-feather)), transparent 100%);
    mask-image: radial-gradient(ellipse at center, #000 calc(100% - var(--mask-feather)), transparent 100%);
  }
  .mask-none{
    -webkit-mask-image: none;
    mask-image: none;
  }
  .flyerPortrait{
    --flyer-width: 820px;
    --flyer-height: 1060px;
  }
  .flyerSquare{
    --flyer-width: 860px;
    --flyer-height: 860px;
  }
  .flyerBg{
    position:absolute;
    inset:0;
    background-image: var(--bg-image);
    background-size: var(--bg-size-x) var(--bg-size-y);
    background-position: var(--bg-pos-x) var(--bg-pos-y);
    filter: saturate(1.05);
  }
  .flyerTexture{
    position:absolute;
    inset:-20%;
    pointer-events:none;
    opacity:0.35;
  }
  .texture-none{ display:none; }
  .texture-snow{
    background-image:
      radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1.5px),
      radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 2px),
      radial-gradient(circle, rgba(255,255,255,0.25) 2px, transparent 3px);
    background-size: 18px 18px, 32px 32px, 70px 70px;
    background-position: 0 0, 10px 12px, -10px -20px;
  }
  .texture-noise{
    background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 1px, transparent 1px, transparent 2px);
  }
  .texture-rays{
    background-image: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.12) 0deg 8deg, transparent 8deg 16deg);
  }
  .flyerTexture.is-animated{
    animation: drift 12s linear infinite;
  }
  @keyframes drift{
    0%{ transform: translate3d(0,0,0); }
    100%{ transform: translate3d(-5%, -8%, 0); }
  }
  .flyerEdge{
    position:absolute;
    inset:0;
    box-shadow: inset 0 0 var(--edge) rgba(0,0,0,0.45);
    border-radius:24px;
    pointer-events:none;
    z-index:2;
  }
  .flyerContent{
    position:relative;
    z-index:3;
    display:grid;
    gap:14px;
    padding:36px;
    color: var(--text-color, white);
    text-align:left;
    transform: translate(var(--content-x, 0px), var(--content-y, 0px)) scale(var(--content-scale, 1));
    transform-origin: top left;
  }
  .flyerLogo{
    width: var(--logo-w, var(--logo-size, 120px));
    height: var(--logo-h, var(--logo-size, 120px));
    object-fit:contain;
    background: rgba(0,0,0,0.25);
    border-radius:18px;
    padding:10px;
    transform: translate(var(--logo-x, 0px), var(--logo-y, 0px)) scale(var(--logo-scale, 1));
    transform-origin: top left;
    filter: var(--logo-filter, none);
  }
  .flyerLogoText{
    width: var(--logo-w, var(--logo-size, 120px));
    height: var(--logo-h, var(--logo-size, 120px));
    border-radius:18px;
    border:1px dashed rgba(255,255,255,0.4);
    display:grid;
    place-items:center;
    font-weight:800;
    letter-spacing:.1em;
    font-size:14px;
    transform: translate(var(--logo-x, 0px), var(--logo-y, 0px)) scale(var(--logo-scale, 1));
    transform-origin: top left;
  }
  .flyerDiscount{
    align-self:flex-start;
    padding:10px 14px;
    border-radius:999px;
    background: rgba(255,255,255,0.85);
    color:#0b1020;
    font-weight:900;
    letter-spacing:.08em;
    transform: translate(var(--discount-x, 0px), var(--discount-y, 0px)) scale(var(--discount-scale, 1));
    transform-origin: top left;
    width: var(--discount-w, auto);
    height: var(--discount-h, auto);
  }
  .flyerTitle{
    font-size:48px;
    font-weight:900;
    letter-spacing:-.02em;
    text-transform:uppercase;
  }
  .flyerSubtitle{
    max-width: 40ch;
    font-size:16px;
    opacity:.85;
  }
  .flyerPoints{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding: calc(8px * var(--points-size, 1)) calc(12px * var(--points-size, 1));
    border-radius:999px;
    background: rgba(255,255,255,0.2);
    border:1px solid var(--points-border, rgba(255,255,255,0.35));
    font-size: calc(12px * var(--points-size, 1));
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.06em;
    transform: translate(var(--points-x, 0px), var(--points-y, 0px)) scale(var(--points-scale, 1));
    transform-origin: top left;
    width: var(--points-w, auto);
    height: var(--points-h, auto);
  }
  .flyerPoints strong{
    font-size: calc(14px * var(--points-size, 1));
    background:#fff;
    color:#0b1020;
    padding: calc(4px * var(--points-size, 1)) calc(8px * var(--points-size, 1));
    border-radius:999px;
  }
  .flyerPoints em{
    font-style:normal;
    opacity:.85;
  }
  .flyerCta{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    padding:12px 18px;
    border-radius:14px;
    background: rgba(124,247,212,0.95);
    color:#041018;
    font-weight:900;
    text-decoration:none;
    max-width: var(--cta-w, 220px);
    transform: translate(var(--cta-x, 0px), var(--cta-y, 0px)) scale(var(--cta-scale, 1));
    transform-origin: top left;
    width: var(--cta-w, auto);
    height: var(--cta-h, auto);
  }
`;

function layout(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 0.9fr) minmax(780px, 2.4fr) minmax(260px, 0.9fr)",
    gap: 16,
    alignItems: "start",
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
  };
}

function column(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    alignContent: "start",
  };
}

function sidePanel(): React.CSSProperties {
  return {
    ...panel(),
    maxHeight: "calc(100vh - 210px)",
    overflowY: "auto",
  };
}

function previewPanel(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 12,
    position: "sticky",
    top: 12,
  };
}

function panelTitle(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 14,
  };
}

function activePanel(): React.CSSProperties {
  return {
    border: "1px solid rgba(56,189,248,0.8)",
    boxShadow: "0 0 0 2px rgba(56,189,248,0.25)",
  };
}

function stack(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  };
}

function fieldBox(active: boolean): React.CSSProperties {
  if (!active) return {};
  return {
    borderColor: "rgba(124,247,212,0.55)",
    boxShadow: "0 0 0 2px rgba(124,247,212,0.25)",
  };
}

function tinyLabel(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.7,
  };
}

function isActivePanel(activeField: string, scope: "email" | "flyer", section: "brand" | "content" | "style") {
  if (!activeField) return false;
  const key = activeField.startsWith(`${scope}:`) ? activeField.slice(scope.length + 1) : "";
  const groups: Record<string, string[]> = {
    emailBrand: [
      "dojoName",
      "dojoTag",
      "logoFallbackText",
      "promoTopLabel",
      "promoAmount",
      "promoUnit",
      "promoEndsLabel",
      "endDate",
    ],
    emailContent: [
      "eyebrow",
      "titleMain",
      "titleAccent",
      "subtitle",
      "chips",
      "pointsLabel",
      "pointsValue",
      "pointsSuffix",
      "ctaText",
      "discountPrefix",
      "discountCode",
      "discountNote",
      "detailsTitle",
      "details",
      "learnTitle",
      "learn",
      "contactLabelPhone",
      "contactPhone",
      "contactLabelLocation",
      "contactLocation",
      "contactLabelWebsite",
      "contactWebsite",
      "footerLeft",
      "footerTags",
    ],
    flyerStyle: [],
    flyerContent: ["title", "subtitle", "discountText", "ctaText", "pointsLabel", "pointsValue", "pointsSuffix", "logoFallbackText"],
  };
  if (scope === "email" && section === "brand") return groups.emailBrand.includes(key);
  if (scope === "email" && section === "content") return groups.emailContent.includes(key);
  if (scope === "flyer" && section === "content") return groups.flyerContent.includes(key);
  if (scope === "flyer" && section === "style") return groups.flyerStyle.includes(key);
  return false;
}

function toolbar(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    padding: 0,
  };
}

function tabRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };
}

function chipRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "nowrap",
    overflowX: "auto",
    paddingBottom: 4,
  };
}

function projectChip(active: boolean, archived?: boolean | null): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(124,247,212,0.7)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(124,247,212,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 11,
    opacity: archived ? 0.5 : 1,
    whiteSpace: "nowrap",
  };
}

function tabChip(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function projectRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "minmax(220px, 1.2fr) minmax(180px, 0.8fr) repeat(6, minmax(110px, 0.5fr))",
    alignItems: "center",
  };
}

function projectFilters(): React.CSSProperties {
  return {
    display: "flex",
    gap: 12,
    alignItems: "center",
  };
}

function linkBtn(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 12,
  };
}

function projectGallery(): React.CSSProperties {
  return {
    ...panel(),
  };
}

function cardGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  };
}

function projectCard(active: boolean, archived?: boolean | null): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 16,
    border: active ? "1px solid rgba(124,247,212,0.7)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(124,247,212,0.12)" : "rgba(255,255,255,0.04)",
    padding: 14,
    cursor: "pointer",
    color: "white",
    opacity: archived ? 0.6 : 1,
  };
}

function cardHeader(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
  };
}

function cardTitle(): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 900,
  };
}

function cardMeta(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.7,
  };
}

function cardSub(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.85,
    marginTop: 8,
  };
}

function cardTags(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 10,
  };
}

function tagPill(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 10,
  };
}

function avatarPreviewWrap(): React.CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    padding: 18,
  };
}

function avatarPreviewFrame(): React.CSSProperties {
  return {
    position: "relative",
    width: 240,
    height: 240,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    overflow: "visible",
    display: "grid",
    placeItems: "center",
  };
}

function avatarPreviewBorder(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };
}

function avatarPreviewAvatar(): React.CSSProperties {
  return {
    width: 140,
    height: 140,
    borderRadius: 18,
    background:
      "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), rgba(255,255,255,0.2)), linear-gradient(140deg, #1f2937, #0b1020)",
    border: "2px solid rgba(255,255,255,0.2)",
    zIndex: 2,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    marginTop: 12,
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 800,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 700,
  };
}

function range(): React.CSSProperties {
  return {
    width: "100%",
    accentColor: "rgba(59,130,246,0.9)",
  };
}

function fileInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 700,
  };
}

function fileLabel(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
  };
}

function colorInput(): React.CSSProperties {
  return {
    width: "100%",
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    padding: 4,
    cursor: "pointer",
  };
}

function checkRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
  };
}

function textarea(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    minHeight: 70,
    resize: "vertical",
  };
}

function button(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(14,116,144,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function ghost(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function previewWrap(): React.CSSProperties {
  return {
    padding: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "radial-gradient(100% 100% at 0% 0%, rgba(56,189,248,0.12), transparent 60%), rgba(2,6,23,0.8)",
    display: "grid",
    placeItems: "stretch",
    width: "100%",
  };
}

function htmlBox(): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 180,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    padding: 12,
    fontSize: 12,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(248,113,113,0.12)",
    color: "white",
    fontWeight: 900,
  };
}

function helperText(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.7,
    marginTop: -4,
  };
}

function colorPreview(hue: number): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: `linear-gradient(90deg, hsl(${hue}, 78%, 62%), hsl(${hue + 12}, 90%, 76%))`,
    color: "#071019",
    fontWeight: 900,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    textAlign: "center",
  };
}
