import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Outlet {
  id: string;
  name: string;
}

const STORAGE_KEY = 'outlet:selected';

function readStored(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutletState] = useState<string>(() => readStored());
  const [loading, setLoading] = useState(true);

  const setSelectedOutlet = (id: string) => {
    setSelectedOutletState(id);
    if (typeof window !== 'undefined') {
      try {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    supabase
      .from('outlets')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setOutlets(data);
          const stored = readStored();
          // Pakai pilihan tersimpan jika masih valid, jika tidak fallback ke yang pertama.
          const validStored = stored && data.some((o) => o.id === stored) ? stored : '';
          if (validStored) {
            setSelectedOutletState(validStored);
          } else if (!selectedOutlet && data.length > 0) {
            setSelectedOutlet(data[0].id);
          } else if (selectedOutlet && !data.some((o) => o.id === selectedOutlet) && data.length > 0) {
            setSelectedOutlet(data[0].id);
          }
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { outlets, selectedOutlet, setSelectedOutlet, loading };
}
