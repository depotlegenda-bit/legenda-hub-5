import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import macanBg from '@/assets/macan-bg.png';
import nagaBg from '@/assets/naga-bg.png';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const { collapsed } = useSidebarCollapse();
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppSidebar />
      <main
        className={cn(
          'relative min-h-[100dvh] px-3 pt-16 pb-6 sm:px-4 sm:pt-20 md:px-6 md:pt-8 md:pb-8 lg:px-8 max-w-full overflow-x-hidden transition-[margin] duration-300',
          collapsed ? 'md:ml-0' : 'md:ml-64'
        )}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {settings.showBgArtwork && (
          <>
            <img
              src={nagaBg}
              alt=""
              aria-hidden="true"
              className={cn(
                'pointer-events-none select-none fixed top-16 left-0 w-[10vw] min-w-[60px] opacity-20 md:opacity-25 z-0',
                collapsed ? 'md:top-4 md:left-0' : 'md:top-4 md:left-64'
              )}
            />
            <img
              src={macanBg}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none fixed bottom-0 right-0 w-[40vw] md:w-[30vw] opacity-15 md:opacity-25 z-0"
            />
          </>
        )}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
