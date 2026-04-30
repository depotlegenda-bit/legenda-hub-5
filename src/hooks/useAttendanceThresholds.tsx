import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AttendanceThresholds, DEFAULT_THRESHOLDS } from '@/lib/attendanceStatus';

export interface AttendanceThresholdsRow extends AttendanceThresholds {
  id: string;
  updated_at: string;
}

/**
 * Hook untuk membaca pengaturan ambang waktu absensi (singleton row).
 * Mengembalikan default jika belum ada baris di DB.
 */
export function useAttendanceThresholds() {
  const [thresholds, setThresholds] = useState<AttendanceThresholds>(DEFAULT_THRESHOLDS);
  const [row, setRow] = useState<AttendanceThresholdsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('attendance_thresholds')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setRow(data as AttendanceThresholdsRow);
      setThresholds({
        check_in_start: data.check_in_start,
        check_in_late_after: data.check_in_late_after,
        check_out_earliest: data.check_out_earliest,
        check_out_latest: data.check_out_latest,
        early_checkin_minutes: data.early_checkin_minutes ?? 30,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { thresholds, row, loading, refetch: fetchData };
}
