import {
  read as readWorkbook,
  utils as xlsxUtils,
  write as writeWorkbook,
} from "xlsx";

export function normalizeText(value: string): string {
  return value.trim().replace(/^\uFEFF/, "");
}

export function normalizeHeader(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[\s_\-/:：]/g, "")
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
}

export function getFileExtension(fileName?: string): string {
  if (!fileName) return "";
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx).toLowerCase();
}

export function isSupportedTabularFile(fileName?: string): boolean {
  const ext = getFileExtension(fileName);
  return ext === ".csv" || ext === ".xlsx" || ext === ".xls";
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(normalizeText(current));
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(normalizeText(current));
  return cells;
}

export function parseTabularBuffer(
  fileBuffer: Buffer,
  fileName?: string,
): string[][] {
  const ext = getFileExtension(fileName);
  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = readWorkbook(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsxUtils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    return rows
      .map((row) => row.map((cell) => normalizeText(String(cell ?? ""))))
      .filter((row) => row.some((cell) => cell !== ""));
  }

  const csvText = fileBuffer.toString("utf-8").replace(/\r\n/g, "\n");
  return csvText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => parseCsvLine(line));
}

export function resolveHeaderIndex(
  headerRow: string[],
  aliases: readonly string[],
): number | undefined {
  const aliasSet = new Set(aliases.map((item) => normalizeHeader(item)));
  for (let i = 0; i < headerRow.length; i += 1) {
    if (aliasSet.has(normalizeHeader(headerRow[i] || ""))) {
      return i;
    }
  }
  return undefined;
}

function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.map((item) => formatCsvCell(item)).join(",");
  const body = rows.map((row) =>
    row.map((item) => formatCsvCell(item)).join(","),
  );
  return [head, ...body].join("\n");
}

export function toXlsxBuffer(headers: string[], rows: unknown[][]): Buffer {
  const wb = xlsxUtils.book_new();
  const ws = xlsxUtils.aoa_to_sheet([headers, ...rows]);
  xlsxUtils.book_append_sheet(wb, ws, "Sheet1");
  return writeWorkbook(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
