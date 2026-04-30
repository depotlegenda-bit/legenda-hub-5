import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AttendanceThresholds, DEFAULT_THRESHOLDS } from '@/lib/attendanceStatus';

export interface AttendanceThresholdsRow extends AttendanceThresholds {
  id: string;
  outlet_id: string | null;
  shift_name: string;
  updated_at: string;
}

/**
 * Hook untuk membaca semua pengaturan ambang waktu absensi.
 * - Mendukung pengaturan per cabang (outlet_id) + 1 baris global (outlet_id NULL) sebagai fallback.
 * - Mendukung banyak shift per cabang/global, dibedakan oleh shift_name.
 * - resolve(outletId, shiftName?): mengembalikan threshold yang berlaku.
 *   Prioritas: outlet+shift → outlet+Default → global+shift → global+Default → DEFAULT_THRESHOLDS.
 */
export function useAttendanceThresholds() {
  const [rows, setRows] = useState<AttendanceThresholdsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('attendance_thresholds')
      .select('*')
      .order('outlet_id', { ascending: true, nullsFirst: true })
      .order('shift_name', { ascending: true });
    setRows((data as AttendanceThresholdsRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const globalRows = useMemo(() => rows.filter((r) => r.outlet_id === null), [rows]);

  // Daftar nama shift unik (gabungan global + per-outlet) untuk dipakai di selector
  const shiftNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.shift_name || 'Default'));
    if (set.size === 0) set.add('Default');
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const shiftsForOutlet = useCallback(
    (outletId?: string | null): string[] => {
      const set = new Set<string>();
      // selalu sertakan shift dari pengaturan global (karena cabang akan fallback ke global)
      globalRows.forEach((r) => set.add(r.shift_name || 'Default'));
      if (outletId) {
        rows.filter((r) => r.outlet_id === outletId).forEach((r) => set.add(r.shift_name || 'Default'));
      }
      if (set.size === 0) set.add('Default');
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    [rows, globalRows],
  );

  const resolve = useCallback(
    (outletId?: string | null, shiftName: string = 'Default'): AttendanceThresholds => {
      const tryFind = (oid: string | null, shift: string) =>
        rows.find((r) => (r.outlet_id ?? null) === oid && (r.shift_name || 'Default') === shift) || null;

      const src =
        (outletId ? tryFind(outletId, shiftName) : null) ||
        (outletId ? tryFind(outletId, 'Default') : null) ||
        tryFind(null, shiftName) ||
        tryFind(null, 'Default') ||
        null;

      if (!src) return DEFAULT_THRESHOLDS;
      return {
        check_in_start: src.check_in_start,
        check_in_late_after: src.check_in_late_after,
        check_out_earliest: src.check_out_earliest,
        check_out_latest: src.check_out_latest,
        early_checkin_minutes: src.early_checkin_minutes ?? 30,
      };
    },
    [rows],
  );

  const getRow = useCallback(
    (outletId?: string | null, shiftName: string = 'Default'): AttendanceThresholdsRow | null => {
      return (
        rows.find(
          (r) => (r.outlet_id ?? null) === (outletId ?? null) && (r.shift_name || 'Default') === shiftName,
        ) || null
      );
    },
    [rows],
  );

  // Backward-compatible: thresholds & row mengacu ke global default (shift Default).
  const globalRow = getRow(null, 'Default');
  const thresholds = resolve(null, 'Default');

  return {
    rows,
    globalRow,
    globalRows,
    thresholds,
    row: globalRow,
    loading,
    refetch: fetchData,
    resolve,
    getRow,
    shiftNames,
    shiftsForOutlet,
  };
}
