import { triggerDownload } from './exportUtils';

/**
 * Auto-detect the most likely delimiter from the header line.
 * Tries comma, semicolon, then tab. Picks the one that appears most
 * (outside quotes) on the first non-empty line.
 */
function detectDelimiter(text: string): string {
  // Sample first non-empty line outside quotes
  let line = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQ = !inQ;
      line += ch;
      continue;
    }
    if (!inQ && (ch === '\n' || ch === '\r')) {
      if (line.length > 0) break;
      continue;
    }
    line += ch;
  }
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    // Count occurrences outside quotes (line already contains quotes literally)
    let count = 0;
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (!q && c === d) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/**
 * Minimal RFC-4180-ish CSV parser that supports:
 * - quoted fields with escaped quotes ("")
 * - delimiters inside quoted fields
 * - CR/LF line endings
 * - auto-detection of `,`, `;` or tab as delimiter (Excel locale-friendly)
 */
export function parseCSV(text: string, delimiter?: string): string[][] {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = delimiter || detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // commit row only on LF (and skip following LF after CR)
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      // skip empty trailing rows
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

/**
 * Parse CSV text into an array of objects keyed by header.
 * Headers are normalized to lowercase + trimmed so that "Name" and " name "
 * both map to the `name` key consumers expect.
 */
export function parseCSVtoObjects<T extends Record<string, string>>(
  text: string,
): T[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ''));
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? '').trim();
    });
    return obj as T;
  });
}

/** Download a CSV template file (headers + optional sample row). */
export function downloadCSVTemplate(
  filename: string,
  headers: string[],
  sample?: (string | number)[][],
) {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(',')];
  (sample || []).forEach((row) => lines.push(row.map(escape).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/** Read a File as text using FileReader (browser). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file, 'utf-8');
  });
}
