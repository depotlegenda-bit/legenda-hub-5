import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ThemeToggle from './ThemeToggle';
import ViewModeToggle from './ViewModeToggle';
import logoKop from '@/assets/logo-kop.png';
import { useAppSettings } from '@/hooks/useAppSettings';
import { MENU_GROUPS } from '@/lib/menuRegistry';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';

export default function AppSidebar() {
  const { role, signOut } = useAuth();
  const { settings } = useAppSettings();
  const { isEnabled } = useMenuPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Auto close drawer on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const visibleGroups = MENU_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => role && isEnabled(role, item.key)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile top bar with hamburger - always visible on small screens */}
      <div
        className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center justify-between px-3 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          className="p-2 -ml-1 rounded-lg hover:bg-sidebar-accent/50 active:scale-95 transition"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img
          src={settings.customLogoUrl || logoKop}
          alt="Logo"
          className="h-8 w-auto object-contain"
        />
        <div className="w-9" />
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-[100dvh] w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:w-64 md:translate-x-0 md:z-40 shadow-2xl md:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile-only close button inside drawer */}
        <button
          className="md:hidden absolute top-3 right-3 z-10 p-2 rounded-lg bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-6 border-b border-sidebar-border bg-sidebar-accent/30 flex flex-col items-center">
          <img
            src={settings.customLogoUrl || logoKop}
            alt="Logo Perusahaan"
            className="max-h-16 w-auto object-contain"
          />
          <p className="text-xs text-sidebar-foreground/60 mt-2">Business Management</p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1">
          {visibleGroups.map((group) => {
            const isGroupActive = group.items.some((item) => location.pathname === item.to);

            if (group.items.length === 1) {
              const item = group.items[0];
              const active = location.pathname === item.to;
              return (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <group.icon className="w-4 h-4" />
                  {group.label}
                </button>
              );
            }

            return (
              <Collapsible key={group.key} defaultOpen={isGroupActive}>
                <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
                  <span className="flex items-center gap-3">
                    <group.icon className="w-4 h-4" />
                    {group.label}
                  </span>
                  <ChevronDown className="w-3 h-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-1">
                    {group.items.map((item) => {
                      const active = location.pathname === item.to;
                      return (
                        <button
                          key={item.to}
                          onClick={() => { navigate(item.to); setOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                            active
                              ? 'bg-sidebar-accent text-sidebar-primary'
                              : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground'
                          )}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          <ThemeToggle variant="sidebar" />
          <ViewModeToggle variant="sidebar" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </Button>
        </div>
      </aside>
    </>
  );
}
