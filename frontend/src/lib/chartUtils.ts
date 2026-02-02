export type ChartType = "bar" | "line" | "pie" | "area";

export interface ChartableData {
  headers: string[];
  rows: Record<string, string | number>[];
  labelKey: string;
  valueKeys: string[];
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function getChartColors() {
  return CHART_COLORS;
}

/**
 * Parse tabular data from an LLM answer. Supports:
 * 1. Markdown pipe tables
 * 2. Pandas DataFrame string repr (space-aligned columns)
 * Returns null if no valid table is found.
 */
export function parseTableFromText(text: string): ChartableData | null {
  return parseMarkdownTable(text) ?? parsePandasTable(text);
}

function parseMarkdownTable(text: string): ChartableData | null {
  const lines = text.split("\n").map((l) => l.trim());

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("|") && lines[i].endsWith("|")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const sep = lines[headerIdx + 1];
  if (!sep || !/^\|[\s:-]+\|/.test(sep)) return null;

  const parseCells = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseCells(lines[headerIdx]);
  if (headers.length < 2) return null;

  const rows: Record<string, string | number>[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|") || !line.endsWith("|")) break;
    const cells = parseCells(line);
    if (cells.length !== headers.length) continue;
    rows.push(cellsToRow(headers, cells));
  }

  return finalize(headers, rows);
}

/**
 * Parse pandas DataFrame repr like:
 *   customer_id       name  ...     total_spent order_count
 * 0            1  customers  ...     78995.0           4
 *
 * Also handles the "... columns" truncation and "[N rows x M columns]" footer.
 */
function parsePandasTable(text: string): ChartableData | null {
  const lines = text.split("\n");

  // Find the header line: the first non-blank line that does NOT start with a digit index
  // and is followed by at least one line that starts with optional whitespace + digit.
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    // Header line should not start with a digit (that's a data row)
    if (/^\d+\s/.test(trimmed)) continue;
    // Next non-blank line should start with a digit (data row)
    const nextNonBlank = lines.slice(i + 1).find((l) => l.trim().length > 0);
    if (nextNonBlank && /^\s*\d+\s/.test(nextNonBlank)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const headerLine = lines[headerIdx];
  // Split header on 2+ spaces to get column names
  let rawHeaders = headerLine.trim().split(/\s{2,}/);
  // Remove "..." placeholder columns
  rawHeaders = rawHeaders.filter((h) => h !== "...");
  if (rawHeaders.length < 2) return null;

  // Now parse data rows — each starts with an integer index
  const rows: Record<string, string | number>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    // Stop at footer like "[10 rows x 7 columns]"
    if (trimmed.startsWith("[")) break;

    // Must start with row index (digit)
    if (!/^\d+\s/.test(trimmed)) continue;

    // Split on 2+ spaces, drop the first token (index)
    let cells = trimmed.split(/\s{2,}/);
    cells = cells.slice(1).filter((c) => c !== "...");

    if (cells.length !== rawHeaders.length) continue;
    rows.push(cellsToRow(rawHeaders, cells));
  }

  return finalize(rawHeaders, rows);
}

function cellsToRow(
  headers: string[],
  cells: string[]
): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  headers.forEach((h, idx) => {
    const raw = (cells[idx] ?? "").replace(/[$,%]/g, "").trim();
    const num = Number(raw);
    row[h] = isNaN(num) ? cells[idx] : num;
  });
  return row;
}

function finalize(
  headers: string[],
  rows: Record<string, string | number>[]
): ChartableData | null {
  if (rows.length === 0) return null;

  const labelKey =
    headers.find((h) => rows.some((r) => typeof r[h] === "string")) ??
    headers[0];
  const valueKeys = headers.filter(
    (h) => h !== labelKey && rows.some((r) => typeof r[h] === "number")
  );
  if (valueKeys.length === 0) return null;

  return { headers, rows, labelKey, valueKeys };
}

/** Auto-detect best chart type based on data shape */
export function detectChartType(data: ChartableData): ChartType {
  if (data.rows.length <= 6 && data.valueKeys.length === 1) return "pie";
  if (data.rows.length > 10) return "area";
  return "bar";
}
