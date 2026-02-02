import { NextResponse } from "next/server";

type Row = {
  id: string;
  level: string;
  week: string;
  title: string;
  category: string;
  description: string;
  choreography_id: string | null;
};

function csvSplitLine(line: string): string[] {
  // minimal CSV parser (handles quoted commas)
  const out: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(csv: string): Row[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = csvSplitLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (k: string) => headers.indexOf(k);

  const required = ["id", "level", "week", "title", "category", "description", "choreography_id"];
  for (const k of required) {
    if (idx(k) === -1) {
      throw new Error(`Curriculum CSV missing header: ${k}`);
    }
  }

  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = csvSplitLine(lines[i]);
    const get = (k: string) => cols[idx(k)] ?? "";
    rows.push({
      id: get("id"),
      level: get("level"),
      week: get("week"),
      title: get("title"),
      category: (get("category") || "").toLowerCase(),
      description: get("description"),
      choreography_id: get("choreography_id") || null,
    });
  }

  return rows.filter((r) => r.id && r.week && r.level);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const level = String(url.searchParams.get("level") ?? "").trim();
    const week = String(url.searchParams.get("week") ?? "").trim();

    const sheetCsvUrl = process.env.CURRICULUM_SHEET_CSV_URL;
    if (!sheetCsvUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing env CURRICULUM_SHEET_CSV_URL" },
        { status: 500 }
      );
    }

    const r = await fetch(sheetCsvUrl, { cache: "no-store" });
    const csv = await r.text();
    const rows = parseCsv(csv);

    const filtered = rows.filter((x) => {
      const okLevel = level ? String(x.level).toLowerCase() === level.toLowerCase() : true;
      const okWeek = week ? String(x.week) === week : true;
      return okLevel && okWeek;
    });

    // sort by week then category then title
    filtered.sort((a, b) => {
      const w = String(a.week).localeCompare(String(b.week));
      if (w) return w;
      const l = String(a.level).localeCompare(String(b.level));
      if (l) return l;
      const c = String(a.category).localeCompare(String(b.category));
      if (c) return c;
      return String(a.title).localeCompare(String(b.title));
    });

    return NextResponse.json({ ok: true, rows: filtered });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
