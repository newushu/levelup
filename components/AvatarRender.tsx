"use client";

import { useMemo } from "react";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";

type CornerOffsets = { x: number; y: number; size: number };

type BorderAsset = {
  render_mode?: string | null;
  image_url?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
};

type EffectAsset = {
  key?: string | null;
  config?: {
    density?: number;
    size?: number;
    speed?: number;
    opacity?: number;
    scale?: number;
    scale_by_context?: Record<string, { scale?: number | null }> | null;
  } | null;
  render_mode?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
};

function buildCodeDoc(html?: string | null, css?: string | null, js?: string | null) {
  const safeHtml = html ?? "";
  const safeCss = css ?? "";
  const safeJs = js ?? "";
  return `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;width:100%;height:100%;overflow:visible;background:transparent;}*{box-sizing:border-box;}img,canvas,svg{max-width:100%;max-height:100%;}</style><style>${safeCss}</style></head><body>${safeHtml}${safeJs ? `<script>${safeJs}</script>` : ""}</body></html>`;
}

function CodePreviewFrame({
  html,
  css,
  js,
  bleed = 0,
  style,
}: {
  html?: string | null;
  css?: string | null;
  js?: string | null;
  bleed?: number;
  style?: React.CSSProperties;
}) {
  const srcDoc = useMemo(() => buildCodeDoc(html, css, js), [html, css, js]);
  const size = bleed * 2;
  return (
    <iframe
      title="code-preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{
        position: "absolute",
        inset: -bleed,
        width: `calc(100% + ${size}px)`,
        height: `calc(100% + ${size}px)`,
        border: "none",
        background: "transparent",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

export default function AvatarRender({
  size,
  bg,
  border,
  effect,
  avatarSrc,
  avatarZoomPct = 100,
  cornerOffsets,
  style,
  bleed = 24,
  showImageBorder = true,
  fallback,
  contextKey,
}: {
  size: number;
  bg: string;
  border?: BorderAsset | null;
  effect?: EffectAsset | null;
  avatarSrc?: string | null;
  avatarZoomPct?: number;
  cornerOffsets?: CornerOffsets | null;
  style?: React.CSSProperties;
  bleed?: number;
  showImageBorder?: boolean;
  fallback?: React.ReactNode;
  contextKey?: string;
}) {
  const effectIsCode = effect?.render_mode === "code";
  const borderIsCode = border?.render_mode === "code";
  const contextOffset = contextKey && border?.offsets_by_context ? border.offsets_by_context[contextKey] : null;
  const offsetX = Number(contextOffset?.x ?? border?.offset_x ?? 0);
  const offsetY = Number(contextOffset?.y ?? border?.offset_y ?? 0);
  const borderScale = Math.max(0.1, Number(contextOffset?.scale ?? 1));
  const effectConfig = typeof effect?.config === "object" && effect?.config ? effect.config : {};
  const effectContext = contextKey && effectConfig.scale_by_context ? effectConfig.scale_by_context[contextKey] : null;
  const effectScale = Math.max(0.1, Number(effectContext?.scale ?? effectConfig.scale ?? 1));
  const effectLayerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `scale(${effectScale})`,
    transformOrigin: "center",
    zIndex: 0,
    pointerEvents: "none",
  };
  const cornerSize = Math.max(0, Number(cornerOffsets?.size ?? 72));
  const cornerX = Number(cornerOffsets?.x ?? -8);
  const cornerY = Number(cornerOffsets?.y ?? -8);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        borderRadius: Math.round(size * 0.16),
        background: bg,
        overflow: "visible",
        display: "grid",
        placeItems: "center",
        ...style,
      }}
    >
      {borderIsCode ? (
        <CodePreviewFrame
          html={border?.html}
          css={border?.css}
          js={border?.js}
          bleed={bleed}
          style={{ zIndex: 2, transform: `translate(${offsetX}px, ${offsetY}px) scale(${borderScale})`, transformOrigin: "center" }}
        />
      ) : showImageBorder && border?.image_url ? (
        <>
          <img
            src={border.image_url}
            alt=""
            style={{
              position: "absolute",
              top: cornerY,
              left: cornerX,
              width: cornerSize,
              height: cornerSize,
              objectFit: "contain",
              transform: `scale(${borderScale})`,
              transformOrigin: "top left",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
          <img
            src={border.image_url}
            alt=""
            style={{
              position: "absolute",
              bottom: cornerY,
              right: cornerX,
              width: cornerSize,
              height: cornerSize,
              objectFit: "contain",
              transform: `scale(${borderScale}) rotate(180deg)`,
              transformOrigin: "bottom right",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </>
      ) : null}

      {effectIsCode ? (
        <div style={effectLayerStyle}>
          <CodePreviewFrame html={effect?.html} css={effect?.css} js={effect?.js} bleed={bleed} />
        </div>
      ) : (
        <div style={effectLayerStyle}>
          <AvatarEffectParticles effectKey={effect?.key ?? null} config={effect?.config ?? undefined} />
        </div>
      )}

      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
            transform: `scale(${Math.max(50, Math.min(200, Number(avatarZoomPct))) / 100})`,
            transformOrigin: "center",
          }}
        />
      ) : (
        fallback ?? null
      )}
    </div>
  );
}
