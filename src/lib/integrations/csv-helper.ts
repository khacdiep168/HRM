/**
 * Helpers for Excel-compatible UTF-8 BOM CSV export and resilient CSV parsing
 * (supports comma or semicolon delimiters, quoted cells, and UTF-8 BOM).
 */

export function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvText(rawText: string): Array<Record<string, string>> {
  const clean = rawText.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const delimiter = semiCount > commaCount ? ";" : ",";

  const headers = parseCsvLine(headerLine, delimiter).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildUtf8BomCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const headerRow = headers.map(escapeCsvCell).join(",");
  const bodyRows = rows.map((r) => r.map(escapeCsvCell).join(","));
  return `\uFEFF${[headerRow, ...bodyRows].join("\r\n")}`;
}

