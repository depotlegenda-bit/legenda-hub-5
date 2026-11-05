import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface SelfieLogPdfRow {
  tanggal: string;
  waktu: string;
  karyawan: string;
  outlet: string;
  tipe: string;
  shift: string;
  status_jam: string;
  selisih: string;
  status_radius: string;
  catatan: string;
  foto_url: string;
}

/** Ambil foto lalu kecilkan ke JPEG data URL agar PDF tidak membengkak. */
async function loadThumb(url: string, maxSize = 240): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

/**
 * Ekspor log absen selfie ke PDF dengan foto selfie tersimpan di tiap baris.
 * Foto diunduh paralel per batch kecil supaya tidak membebani browser.
 */
export async function exportSelfieLogsPdf(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  rows: SelfieLogPdfRow[];
  onProgress?: (done: number, total: number) => void;
}) {
  const { filename, title, subtitle, rows, onProgress } = opts;

  // Unduh & kecilkan foto (batch 4 paralel)
  const thumbs: (string | null)[] = new Array(rows.length).fill(null);
  let done = 0;
  const queue = rows.map((r, i) => ({ url: r.foto_url, i })).filter((q) => !!q.url);
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      thumbs[item.i] = await loadThumb(item.url);
      done += 1;
      onProgress?.(done, rows.length);
    }
  });
  await Promise.all(workers);

  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  const meta = `Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  doc.text(subtitle ? `${subtitle}  ·  ${meta}` : meta, 14, 25);
  doc.setTextColor(0);

  const PHOTO_COL = 0;
  const ROW_H = 20; // mm — cukup untuk foto kecil

  autoTable(doc, {
    startY: 30,
    head: [[
      'Foto', 'Tanggal', 'Waktu', 'Karyawan', 'Outlet', 'Tipe', 'Shift',
      'Status Jam', 'Selisih', 'Radius', 'Catatan',
    ]],
    body: rows.map((r) => [
      '', r.tanggal, r.waktu, r.karyawan, r.outlet, r.tipe, r.shift,
      r.status_jam, r.selisih, r.status_radius, r.catatan,
    ]),
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      [PHOTO_COL]: { cellWidth: 22, minCellHeight: ROW_H },
      10: { cellWidth: 40 }, // catatan
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== PHOTO_COL) return;
      const img = thumbs[data.row.index];
      if (!img) return;
      const pad = 1.5;
      const maxW = data.cell.width - pad * 2;
      const maxH = data.cell.height - pad * 2;
      // Foto selfie umumnya portrait/persegi — muatkan proporsional dalam sel.
      const size = Math.min(maxW, maxH);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      try {
        doc.addImage(img, 'JPEG', x, y, size, size);
      } catch {
        // Abaikan foto yang gagal dirender — baris tetap tampil.
      }
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
