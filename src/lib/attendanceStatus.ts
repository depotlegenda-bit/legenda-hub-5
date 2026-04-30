// Helper untuk mengklasifikasikan status absensi (terlambat / normal / duluan / lewat batas)
// berdasarkan ambang waktu yang disimpan di tabel attendance_thresholds.

export interface AttendanceThresholds {
  check_in_start: string;       // 'HH:MM' atau 'HH:MM:SS'
  check_in_late_after: string;
  check_out_earliest: string;
  check_out_latest: string;
  early_checkin_minutes: number;
}

export const DEFAULT_THRESHOLDS: AttendanceThresholds = {
  check_in_start: '07:00',
  check_in_late_after: '08:00',
  check_out_earliest: '17:00',
  check_out_latest: '22:00',
  early_checkin_minutes: 30,
};

export type AttendanceStatus =
  | 'on_time'      // tepat waktu
  | 'late'         // terlambat
  | 'early_in'     // datang lebih awal dari ambang toleransi
  | 'early_out'    // pulang lebih awal
  | 'overtime'     // pulang setelah batas wajar
  | 'unknown';

export interface StatusInfo {
  key: AttendanceStatus;
  label: string;
  // Tailwind class untuk badge
  className: string;
  // Selisih menit dari ambang ideal (positif = setelah ambang, negatif = sebelumnya)
  diffMinutes: number;
}

const STATUS_LABELS: Record<AttendanceStatus, { label: string; className: string }> = {
  on_time:  { label: 'Tepat Waktu',  className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  late:     { label: 'Terlambat',    className: 'bg-destructive/15 text-destructive' },
  early_in: { label: 'Datang Awal',  className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  early_out:{ label: 'Pulang Duluan',className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  overtime: { label: 'Lembur',       className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
  unknown:  { label: '-',            className: 'bg-muted text-muted-foreground' },
};

// Ubah 'HH:MM' atau 'HH:MM:SS' jadi total menit sejak 00:00
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Ekstrak menit-of-day dari Date (waktu lokal browser; user di WIB akan dapat WIB)
function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function getAttendanceStatus(
  createdAt: string | Date,
  logType: 'check_in' | 'check_out',
  thresholds: AttendanceThresholds = DEFAULT_THRESHOLDS,
): StatusInfo {
  if (!createdAt) {
    return { ...STATUS_LABELS.unknown, key: 'unknown', diffMinutes: 0 };
  }
  const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (isNaN(date.getTime())) {
    return { ...STATUS_LABELS.unknown, key: 'unknown', diffMinutes: 0 };
  }

  const minutes = minutesOfDay(date);

  if (logType === 'check_in') {
    const startMin = timeToMinutes(thresholds.check_in_start);
    const lateMin = timeToMinutes(thresholds.check_in_late_after);
    const tolerance = thresholds.early_checkin_minutes || 0;

    if (minutes < startMin - tolerance) {
      return { ...STATUS_LABELS.early_in, key: 'early_in', diffMinutes: minutes - startMin };
    }
    if (minutes > lateMin) {
      return { ...STATUS_LABELS.late, key: 'late', diffMinutes: minutes - lateMin };
    }
    return { ...STATUS_LABELS.on_time, key: 'on_time', diffMinutes: minutes - startMin };
  }

  // check_out
  const earliestMin = timeToMinutes(thresholds.check_out_earliest);
  const latestMin = timeToMinutes(thresholds.check_out_latest);

  if (minutes < earliestMin) {
    return { ...STATUS_LABELS.early_out, key: 'early_out', diffMinutes: minutes - earliestMin };
  }
  if (minutes > latestMin) {
    return { ...STATUS_LABELS.overtime, key: 'overtime', diffMinutes: minutes - latestMin };
  }
  return { ...STATUS_LABELS.on_time, key: 'on_time', diffMinutes: minutes - earliestMin };
}

export function formatDiffMinutes(diff: number): string {
  if (diff === 0) return '0 mnt';
  const sign = diff > 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h > 0) return `${sign}${h}j ${m}mnt`;
  return `${sign}${m}mnt`;
}
