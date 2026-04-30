import { useEffect, useState } from 'react';

const KEY = 'dl-sidebar-collapsed-v1';
const EVENT = 'dl-sidebar-collapsed-change';

export function setSidebarCollapsed(value: boolean) {
  localStorage.setItem(KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(KEY) === '1';
  });

  useEffect(() => {
    const onChange = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      setCollapsed(typeof v === 'boolean' ? v : localStorage.getItem(KEY) === '1');
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setCollapsed(e.newValue === '1');
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return collapsed;
}
