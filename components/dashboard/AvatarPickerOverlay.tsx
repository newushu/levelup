"use client";
import React from "react";
import Overlay from "./Overlay";
import type { AvatarChoice } from "./types";

export default function AvatarPickerOverlay({
  open,
  onClose,
  studentName,
  avatars,
  selectedAvatarId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  studentName: string;
  avatars: AvatarChoice[];
  selectedAvatarId: string;
  onPick: (avatarId: string) => void;
}) {
  if (!open) return null;

  return (
    <Overlay title="Choose Avatar" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ opacity: 0.75, fontSize: 12 }}>
          Click an avatar to select it for <b>{studentName}</b>.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {avatars
            .filter((a) => a.enabled)
            .map((a) => {
              const src = a.storage_path
                ? `/api/storage/signed-url?path=${encodeURIComponent(a.storage_path)}`
                : "";
              const isSelected = a.id === selectedAvatarId;

              return (
                <button
                  key={a.id}
                  onClick={() => onPick(a.id)}
                  style={{
                    borderRadius: 16,
                    border: isSelected ? "1px solid rgba(34,197,94,0.40)" : "1px solid rgba(255,255,255,0.12)",
                    background: isSelected ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.06)",
                    padding: 12,
                    cursor: "pointer",
                    color: "white",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      height: 110,
                      borderRadius: 14,
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={a.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>No image: {a.name}</div>
                    )}
                  </div>

                  <div style={{ marginTop: 10, fontWeight: 1000 }}>{a.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>id: {a.id}</div>
                </button>
              );
            })}
        </div>
      </div>
    </Overlay>
  );
}
