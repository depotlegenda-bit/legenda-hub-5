import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AttendanceThresholds, DEFAULT_THRESHOLDS } from '@/lib/attendanceStatus';

export interface AttendanceThresholdsRow extends AttendanceThresholds {
  id: string;
  outlet_id: string | null;
  updated_at: string;
}

/**
 * Hook untuk membaca semua pengaturan ambang waktu absensi.
 * - Mendukung pengaturan per cabang (outlet_id) + 1 baris global (outlet_id NULL) sebagai fallback.
 * - resolve(outletId): mengembalikan threshold yang berlaku untuk outlet tersebut
 *   (per-outlet jika ada, kalau tidak pakai global, kalau tidak pakai DEFAULT_THRESHOLDS).
 */
export function useAttendanceThresholds() {
  const [rows, setRows] = useState<AttendanceThresholdsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('attendance_thresholds')
      .select('*')
      .order('updated_at', { ascending: false });
    setRows((data as AttendanceThresholdsRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const globalRow = useMemo(() => rows.find((r) => r.outlet_id === null) || null, [rows]);

  const resolve = useCallback(
    (outletId?: string | null): AttendanceThresholds => {
      const found = outletId ? rows.find((r) => r.outlet_id === outletId) : null;
      const src = found || globalRow;
      if (!src) return DEFAULT_THRESHOLDS;
      return {
        check_in_start: src.check_in_start,
        check_in_late_after: src.check_in_late_after,
        check_out_earliest: src.check_out_earliest,
        check_out_latest: src.check_out_latest,
        early_checkin_minutes: src.early_checkin_minutes ?? 30,
      };
    },
    [rows, globalRow],
  );

  const getRow = useCallback(
    (outletId?: string | null): AttendanceThresholdsRow | null => {
      if (outletId) return rows.find((r) => r.outlet_id === outletId) || null;
      return globalRow;
    },
    [rows, globalRow],
  );

  // Backward-compatible: thresholds & row mengacu ke global default.
  const thresholds = resolve(null);

  return { rows, globalRow, thresholds, row: globalRow, loading, refetch: fetchData, resolve, getRow };
}
