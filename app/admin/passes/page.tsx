"use client";

import { useEffect, useMemo, useState } from "react";

type PassType = {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  price_usd?: number | string | null;
  discount_price_usd?: number | string | null;
  discount_start?: string | null;
  discount_end?: string | null;
  access_scope?: string | null;
  default_valid_days?: number | string | null;
  image_url?: string | null;
  image_text?: string | null;
  use_text?: boolean | null;
};
type ClassRow = { id: string; name: string };

export default function AdminPassesPage() {
  const [role, setRole] = useState("student");
  const [passes, setPasses] = useState<PassType[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [msg, setMsg] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newPass, setNewPass] = useState({
    name: "",
    description: "",
    price_usd: "",
    discount_price_usd: "",
    discount_start: "",
    discount_end: "",
    access_scope: "class",
    default_valid_days: "",
    image_url: "",
    image_text: "",
    use_text: false,
  });

  const [accessByClass, setAccessByClass] = useState<Record<string, string[]>>({});
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([]);
  const [newPassClassIds, setNewPassClassIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setRole(String(data?.role ?? "student"));
      } catch {}
    })();
  }, []);

  async function load() {
    setMsg("");
    try {
      const [passRes, classRes, accessRes] = await Promise.all([
        fetch("/api/passes/list", { cache: "no-store" }),
        fetch("/api/classes/list", { cache: "no-store" }),
        fetch("/api/classes/pass-access/admin", { cache: "no-store" }),
      ]);
      const passJson = await passRes.json().catch(() => ({}));
      const classJson = await classRes.json().catch(() => ({}));
      const accessJson = await accessRes.json().catch(() => ({}));
      if (passRes.ok) setPasses((passJson.passes ?? []) as PassType[]);
      if (classRes.ok) setClasses((classJson.classes ?? []) as ClassRow[]);
      if (accessRes.ok) {
        const mapped: Record<string, string[]> = {};
        Object.entries(accessJson.access ?? {}).forEach(([classId, rows]: any) => {
          mapped[classId] = (rows ?? []).map((r: any) => String(r.id));
        });
        setAccessByClass(mapped);
      }
      if (!passRes.ok) setMsg(passJson?.error || "Failed to load passes");
      if (!classRes.ok) setMsg(classJson?.error || "Failed to load classes");
      if (!accessRes.ok) setMsg(accessJson?.error || "Failed to load pass access");
    } catch (e: any) {
      setMsg(e?.message || "Failed to load pass data");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedClassId && classes[0]?.id) setSelectedClassId(classes[0].id);
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) return;
    setSelectedPassIds(accessByClass[selectedClassId] ?? []);
  }, [accessByClass, selectedClassId]);

  function parseNumber(value: any) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const num = Number(raw);
    if (Number.isNaN(num)) return null;
    return num;
  }

  function serializePass(pass: PassType) {
    const price = parseNumber(pass.price_usd);
    return {
      id: pass.id,
      name: pass.name,
      description: pass.description ?? null,
      enabled: pass.enabled,
      price_usd: price,
      discount_price_usd: parseNumber(pass.discount_price_usd),
      discount_start: pass.discount_start || null,
      discount_end: pass.discount_end || null,
      access_scope: pass.access_scope || null,
      default_valid_days: parseNumber(pass.default_valid_days),
      image_url: pass.image_url || null,
      image_text: pass.image_text || (pass.use_text ? pass.name : null),
      use_text: pass.use_text === true,
    };
  }

  async function savePass(pass: PassType) {
    setSavingId(pass.id);
    setMsg("");
    const payload = serializePass(pass);
    if (payload.price_usd === null) {
      setSavingId(null);
      return setMsg("Price is required for each pass.");
    }
    const res = await fetch("/api/passes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data?.error || "Failed to save pass");
    setSavingId(null);
  }

  async function createPass() {
    if (!newPass.name.trim()) return;
    setMsg("");
    const price = parseNumber(newPass.price_usd);
    if (price === null) return setMsg("Price is required for each pass.");
    const res = await fetch("/api/passes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPass.name.trim(),
        description: newPass.description.trim() || null,
        price_usd: price,
        discount_price_usd: parseNumber(newPass.discount_price_usd),
        discount_start: newPass.discount_start || null,
        discount_end: newPass.discount_end || null,
        access_scope: newPass.access_scope || null,
        default_valid_days: parseNumber(newPass.default_valid_days),
        image_url: newPass.image_url || null,
        image_text: newPass.image_text || (newPass.use_text ? newPass.name.trim() : null),
        use_text: newPass.use_text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to create pass");
    if (newPassClassIds.length) {
      await Promise.all(
        newPassClassIds.map(async (classId) => {
          const existing = accessByClass[classId] ?? [];
          const merged = Array.from(new Set([...existing, data.id]));
          await fetch("/api/classes/pass-access/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ class_id: classId, pass_type_ids: merged }),
          });
        })
      );
    }
    setNewPass({
      name: "",
      description: "",
      price_usd: "",
      discount_price_usd: "",
      discount_start: "",
      discount_end: "",
      access_scope: "class",
      default_valid_days: "",
      image_url: "",
      image_text: "",
      use_text: false,
    });
    setNewPassClassIds([]);
    await load();
  }

  async function uploadImage(file: File, passId?: string) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/passes/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Image upload failed");
    if (passId) {
      setPasses((prev) => prev.map((p) => (p.id === passId ? { ...p, image_url: data.public_url } : p)));
    } else {
      setNewPass((p) => ({ ...p, image_url: data.public_url }));
    }
  }

  async function saveAccess() {
    if (!selectedClassId) return;
    const res = await fetch("/api/classes/pass-access/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClassId, pass_type_ids: selectedPassIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to update access");
    setAccessByClass((prev) => ({ ...prev, [selectedClassId]: selectedPassIds }));
  }

  const passById = useMemo(() => new Map(passes.map((p) => [p.id, p])), [passes]);

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Admin access required.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Pass Management</div>
        <button onClick={load} style={btn()}>
          Refresh
        </button>
      </div>
      {msg ? <div style={{ marginTop: 8, color: "crimson", fontWeight: 700 }}>{msg}</div> : null}

      <section style={card()}>
        <div style={cardTitle()}>Create Pass</div>
        <div style={grid()}>
          <label style={label()}>
            Name
            <input value={newPass.name} onChange={(e) => setNewPass((p) => ({ ...p, name: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            Description
            <input value={newPass.description} onChange={(e) => setNewPass((p) => ({ ...p, description: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            Price (USD)
            <input value={newPass.price_usd} onChange={(e) => setNewPass((p) => ({ ...p, price_usd: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            Discount price (USD)
            <input
              value={newPass.discount_price_usd}
              onChange={(e) => setNewPass((p) => ({ ...p, discount_price_usd: e.target.value }))}
              style={input()}
            />
          </label>
          <label style={label()}>
            Discount start
            <input type="date" value={newPass.discount_start} onChange={(e) => setNewPass((p) => ({ ...p, discount_start: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            Discount end
            <input type="date" value={newPass.discount_end} onChange={(e) => setNewPass((p) => ({ ...p, discount_end: e.target.value }))} style={input()} />
          </label>
          <label style={label()}>
            Access scope
            <select value={newPass.access_scope} onChange={(e) => setNewPass((p) => ({ ...p, access_scope: e.target.value }))} style={input()}>
              <option value="class">Class</option>
              <option value="event">Event</option>
              <option value="testing">Testing</option>
              <option value="any">Any</option>
            </select>
          </label>
          <label style={label()}>
            Default valid days
            <input
              value={newPass.default_valid_days}
              onChange={(e) => setNewPass((p) => ({ ...p, default_valid_days: e.target.value }))}
              style={input()}
            />
          </label>
          <label style={label()}>
            Display text
            <input
              value={newPass.image_text}
              onChange={(e) => setNewPass((p) => ({ ...p, image_text: e.target.value }))}
              placeholder="Defaults to pass name"
              style={input()}
            />
          </label>
          <label style={label()}>
            Use text instead of image
            <input
              type="checkbox"
              checked={newPass.use_text}
              onChange={(e) =>
                setNewPass((p) => ({
                  ...p,
                  use_text: e.target.checked,
                  image_text: e.target.checked ? p.image_text || p.name : p.image_text,
                }))
              }
            />
          </label>
          <label style={label()}>
            Upload image
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file);
              }}
              style={input()}
            />
          </label>
          <label style={label()}>
            Image URL
            <input
              value={newPass.image_url}
              onChange={(e) => setNewPass((p) => ({ ...p, image_url: e.target.value }))}
              placeholder="Optional image URL"
              style={input()}
            />
          </label>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Access classes</div>
          <div style={{ display: "grid", gap: 6 }}>
            {classes.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={newPassClassIds.includes(c.id)}
                  onChange={(e) =>
                    setNewPassClassIds((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                    )
                  }
                />
                {c.name}
              </label>
            ))}
            {!classes.length ? <div style={{ opacity: 0.7 }}>No classes yet.</div> : null}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Preview</div>
          <div style={previewBox()}>
            {newPass.use_text || !newPass.image_url ? (
              <div style={{ fontWeight: 900, textAlign: "center", fontSize: 14 }}>
                {newPass.image_text || newPass.name || "Pass"}
              </div>
            ) : (
              <img src={newPass.image_url} alt="Pass" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
          </div>
        </div>
        <button onClick={createPass} style={btnPrimary()}>
          Create pass
        </button>
      </section>

      <section style={card()}>
        <div style={cardTitle()}>Edit Passes</div>
        <div style={{ display: "grid", gap: 12 }}>
          {passes.map((p) => (
            <div key={p.id} style={miniCard()}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 900 }}>{p.name}</div>
                <div style={grid()}>
                  <label style={label()}>
                    Name
                    <input
                      value={p.name}
                      onChange={(e) => setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, name: e.target.value } : row)))}
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Description
                    <input
                      value={p.description ?? ""}
                      onChange={(e) => setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, description: e.target.value } : row)))}
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Price (USD)
                    <input
                      value={p.price_usd ?? ""}
                      onChange={(e) =>
                        setPasses((prev) =>
                          prev.map((row) => (row.id === p.id ? { ...row, price_usd: e.target.value } : row))
                        )
                      }
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Discount price (USD)
                    <input
                      value={p.discount_price_usd ?? ""}
                      onChange={(e) =>
                        setPasses((prev) =>
                          prev.map((row) => (row.id === p.id ? { ...row, discount_price_usd: e.target.value } : row))
                        )
                      }
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Discount start
                    <input
                      type="date"
                      value={p.discount_start ?? ""}
                      onChange={(e) =>
                        setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, discount_start: e.target.value } : row)))
                      }
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Discount end
                    <input
                      type="date"
                      value={p.discount_end ?? ""}
                      onChange={(e) =>
                        setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, discount_end: e.target.value } : row)))
                      }
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Access scope
                    <select
                      value={p.access_scope ?? "class"}
                      onChange={(e) => setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, access_scope: e.target.value } : row)))}
                      style={input()}
                    >
                      <option value="class">Class</option>
                      <option value="event">Event</option>
                      <option value="testing">Testing</option>
                      <option value="any">Any</option>
                    </select>
                  </label>
                  <label style={label()}>
                    Default valid days
                    <input
                      value={p.default_valid_days ?? ""}
                      onChange={(e) =>
                        setPasses((prev) =>
                          prev.map((row) => (row.id === p.id ? { ...row, default_valid_days: e.target.value } : row))
                        )
                      }
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Display text
                    <input
                      value={p.image_text ?? ""}
                      onChange={(e) =>
                        setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, image_text: e.target.value } : row)))
                      }
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Use text instead of image
                    <input
                      type="checkbox"
                      checked={p.use_text === true}
                      onChange={(e) =>
                        setPasses((prev) =>
                          prev.map((row) =>
                            row.id === p.id
                              ? { ...row, use_text: e.target.checked, image_text: e.target.checked ? row.image_text || row.name : row.image_text }
                              : row
                          )
                        )
                      }
                    />
                  </label>
                  <label style={label()}>
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(file, p.id);
                      }}
                      style={input()}
                    />
                  </label>
                  <label style={label()}>
                    Image URL
                    <input
                      value={p.image_url ?? ""}
                      onChange={(e) =>
                        setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, image_url: e.target.value } : row)))
                      }
                      style={input()}
                    />
                  </label>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => setPasses((prev) => prev.map((row) => (row.id === p.id ? { ...row, enabled: e.target.checked } : row)))}
                  />
                  Enabled
                </label>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={previewBox()}>
                  {p.use_text === true || !p.image_url ? (
                    <div style={{ fontWeight: 900, textAlign: "center", fontSize: 14 }}>
                      {p.image_text || p.name || "Pass"}
                    </div>
                  ) : (
                    <img src={p.image_url} alt="Pass" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>
                <button onClick={() => savePass(passById.get(p.id) as PassType)} style={btnPrimary()} disabled={savingId === p.id}>
                  {savingId === p.id ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ))}
          {!passes.length ? <div style={{ opacity: 0.7 }}>No passes yet.</div> : null}
        </div>
        {passes.length ? (
          <button
            onClick={async () => {
              for (const p of passes) {
                await savePass(p as PassType);
              }
            }}
            style={btn()}
          >
            Save all passes
          </button>
        ) : null}
      </section>

      <section style={card()}>
        <div style={cardTitle()}>Pass Access by Class</div>
        <div style={grid()}>
          <label style={label()}>
            Class
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} style={input()}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {passes.map((p) => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={selectedPassIds.includes(p.id)}
                onChange={(e) => {
                  setSelectedPassIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)));
                }}
              />
              {p.name}
            </label>
          ))}
          {!passes.length ? <div style={{ opacity: 0.7 }}>No passes yet.</div> : null}
        </div>
        <button onClick={saveAccess} style={btnPrimary()}>
          Save access
        </button>
      </section>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 14px 36px rgba(0,0,0,0.22)",
  };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 900, marginBottom: 12 };
}

function grid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 700,
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid rgba(14,116,144,0.6)",
    background: "linear-gradient(135deg, rgba(14,116,144,0.9), rgba(2,132,199,0.6))",
    color: "white",
    fontWeight: 800,
    marginTop: 12,
    width: "fit-content",
  };
}

function miniCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(10,12,18,0.7)",
    display: "grid",
    gap: 12,
    gridTemplateColumns: "1fr 160px",
  };
}

function previewBox(): React.CSSProperties {
  return {
    width: 140,
    height: 140,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.8)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}
