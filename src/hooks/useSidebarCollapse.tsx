import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

interface SidebarCollapseContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | undefined>(undefined);
const STORAGE_KEY = 'dl-sidebar-collapsed-v1';

function loadInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const setCollapsed = useCallback((v: boolean) => setCollapsedState(v), []);
  const toggle = useCallback(() => setCollapsedState((p) => !p), []);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

const noopCtx: SidebarCollapseContextValue = {
  collapsed: false,
  setCollapsed: () => {},
  toggle: () => {},
};

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext);
  // Fallback to no-op context to avoid crashes if a consumer renders outside the provider
  return ctx ?? noopCtx;
}
