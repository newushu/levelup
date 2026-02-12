"use client";

import { useEffect, useState } from "react";

type ParentRow = {
  id: string;
  name?: string | null;
  email?: string | null;
};

const STORAGE_KEY = "admin_parent_impersonate_id";
const EVENT_NAME = "admin-parent-impersonation-changed";

export default function ParentImpersonationBar({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange?: (parentId: string) => void;
}) {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) || "";
      } catch {
        return "";
      }
    })();
    setSelectedId(stored);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const res = await fetch("/api/admin/parents/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = (data.parents ?? []) as ParentRow[];
      setParents(list);
      if (!selectedId && list.length) {
        selectParent(list[0].id);
      }
    })();
  }, [enabled, selectedId]);

  function selectParent(nextId: string) {
    setSelectedId(nextId);
    try {
      localStorage.setItem(STORAGE_KEY, nextId);
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { parentId: nextId } }));
    onChange?.(nextId);
  }

  if (!enabled || !loaded) return null;

  return (
    <div
      style={{
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(148,163,184,0.4)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 0.4 }}>Admin: View As Parent</div>
      <select
        value={selectedId}
        onChange={(e) => selectParent(e.target.value)}
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.4)",
          color: "white",
          fontSize: 12,
          minWidth: 220,
        }}
      >
        {!parents.length ? <option value="">No parents found</option> : null}
        {parents.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || p.email || p.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export function useAdminParentImpersonation(enabled: boolean) {
  const [parentId, setParentId] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) || "";
      } catch {
        return "";
      }
    })();
    setParentId(stored);

    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent).detail as { parentId?: string } | undefined;
      setParentId(String(detail?.parentId ?? ""));
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [enabled]);

  return parentId;
}
