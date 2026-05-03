import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Outlet {
  id: string;
  name: string;
}

const STORAGE_KEY = 'outlet:selected';
const MANAGEMENT_NAME = 'manajemen';

function readStored(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

interface UseOutletsOptions {
  includeManagement?: boolean;
}

export function useOutlets({ includeManagement = false }: UseOutletsOptions = {}) {
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
          const filtered = includeManagement
            ? data
            : data.filter((o) => o.name.trim().toLowerCase() !== MANAGEMENT_NAME);
          setOutlets(filtered);
          const stored = readStored();
          const validStored = stored && filtered.some((o) => o.id === stored) ? stored : '';
          if (validStored) {
            setSelectedOutletState(validStored);
          } else if (!selectedOutlet && filtered.length > 0) {
            setSelectedOutlet(filtered[0].id);
          } else if (selectedOutlet && !filtered.some((o) => o.id === selectedOutlet) && filtered.length > 0) {
            setSelectedOutlet(filtered[0].id);
          }
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeManagement]);

  return { outlets, selectedOutlet, setSelectedOutlet, loading };
}
