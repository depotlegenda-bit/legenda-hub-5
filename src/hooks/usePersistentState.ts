import { Dispatch, SetStateAction, useEffect, useState } from 'react';

/**
 * useState yang otomatis menyimpan & memuat nilai dari localStorage.
 * Berguna untuk filter / pilihan halaman supaya tidak hilang saat refresh.
 */
export function usePersistentState<T>(storageKey: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore quota errors */
    }
  }, [storageKey, value]);

  return [value, setValue as Dispatch<SetStateAction<T>>] as const;
}
