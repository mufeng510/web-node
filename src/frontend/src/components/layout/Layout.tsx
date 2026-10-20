import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLibraries } from '../../hooks/useLibraries';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useRouteFocus } from '../../hooks/useRouteFocus';
import { useSidebarSize } from '../../hooks/useSidebarSize';
import { routes } from '../../routes';
import { CommandPalette } from '../command-palette/CommandPalette';
import type { BreadcrumbItem } from '../ui/Breadcrumb';
import { Resizable } from '../ui/Resizable';
import { Spinner } from '../ui/Spinner';
import { BottomNav } from './BottomNav';
import { LeftSidebar } from './LeftSidebar';
import { MobileDrawer } from './MobileDrawer';
import { RightRailProvider, RightRailSlot } from './RightRail';
import { TopBar } from './TopBar';
import { WORKSPACE_NAV } from './navConfig';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user, logout } = useAuth();
  const { libraries, currentLibrary, setCurrentLibrary, loading: libLoading } = useLibraries();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sidebar = useSidebarSize();
  // The rail is display:none below lg, but a grid track would still reserve its
  // width and crush main to nothing, so the split only exists on wide screens.
  const resizableSidebar = useMediaQuery('(min-width: 1024px)') && !sidebar.collapsed;
  // The editor opens in split view, so a rail sharing the 1024px breakpoint
  // would leave the preview pane a couple of hundred pixels wide.
  const isRailWide = useMediaQuery('(min-width: 1280px)');

  useRouteFocus();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      // Let the shortcut work from a text field, but not while composing IME input.
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const breadcrumb = useMemo<BreadcrumbItem[]>(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];

    if (segments[0] === 'editor') {
      const libraryName =
        libraries.find((l) => l.id === params.libraryId)?.name ?? currentLibrary?.name ?? 'Library';
      items.push({ label: libraryName, href: routes.home });
      const notePath = params['*'];
      if (notePath) {
        for (const part of notePath.split('/')) {
          items.push({ label: part });
        }
      }
      return items;
    }

    const match = WORKSPACE_NAV.find((item) => item.to === location.pathname);
    if (match) {
      items.push({ label: match.label });
      return items;
    }
    if (location.pathname === routes.settings) {
      items.push({ label: 'Settings' });
      return items;
    }
    return items;
  }, [location.pathname, params.libraryId, params['*'], libraries, currentLibrary?.name]);

  useEffect(() => {
    if (currentLibrary && libraries.length > 0) {
      const found = libraries.find((l) => l.id === currentLibrary.id);
      if (!found) {
        setCurrentLibrary(libraries[0] ?? null);
      }
    }
  }, [libraries, currentLibrary, setCurrentLibrary]);

  const handleLibraryChange = (libraryId: string) => {
    const lib = libraries.find((l) => l.id === libraryId);
    if (lib) {
      setCurrentLibrary(lib);
      localStorage.setItem('currentLibraryId', libraryId);
    }
    setMobileMenuOpen(false);
  };

  if (libLoading) {
    return (
      <div className="h-[var(--shell-h)] flex items-center justify-center bg-bg">
        <Spinner label="Loading libraries" />
      </div>
    );
  }

  return (
    <RightRailProvider>
      <div className="h-[var(--shell-h)] bg-bg grid grid-rows-[var(--topbar-h)_minmax(0,1fr)] overflow-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-bg-elevated focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          跳到主内容
        </a>

        <TopBar
          user={user}
          currentLibrary={currentLibrary}
          breadcrumb={breadcrumb}
          onOpenPalette={() => setPaletteOpen(true)}
          onMenuClick={() => setMobileMenuOpen(true)}
          menuOpen={mobileMenuOpen}
          onLogout={logout}
        />

        <div className="flex min-h-0 overflow-hidden">
          <MobileDrawer
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            libraries={libraries}
            currentLibrary={currentLibrary}
            onLibraryChange={handleLibraryChange}
          />

          {(() => {
            const main = (
              <main
                id="main-content"
                tabIndex={-1}
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[var(--bottom-nav-h)] lg:pb-0 focus:outline-none"
              >
                <Outlet />
              </main>
            );
            // The rail sits beside main, never inside it, so route focus and the
            // skip link keep pointing at the note.
            const content = (
              <div className="flex min-h-0 min-w-0 flex-1">
                {main}
                {isRailWide && <RightRailSlot />}
              </div>
            );

            if (!resizableSidebar) {
              return (
                <>
                  <LeftSidebar
                    libraries={libraries}
                    currentLibrary={currentLibrary}
                    onLibraryChange={handleLibraryChange}
                    collapsed={sidebar.collapsed}
                    onToggleCollapsed={sidebar.toggleCollapsed}
                    className="hidden lg:flex"
                  />
                  {content}
                </>
              );
            }

            return (
              <Resizable
                size={sidebar.width}
                onSizeChange={sidebar.setWidth}
                onReset={sidebar.resetWidth}
                min={200}
                max={480}
                firstLabel="Resize sidebar"
                className="flex-1 min-w-0 h-full"
                first={
                  <LeftSidebar
                    libraries={libraries}
                    currentLibrary={currentLibrary}
                    onLibraryChange={handleLibraryChange}
                    onToggleCollapsed={sidebar.toggleCollapsed}
                    resizable
                    className="hidden lg:flex"
                  />
                }
                second={content}
              />
            );
          })()}
        </div>

        <div id="route-announcer" role="status" aria-live="polite" className="sr-only" />

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

        <BottomNav
          currentLibrary={currentLibrary}
          onLibraryChange={handleLibraryChange}
          className="lg:hidden"
        />
      </div>
    </RightRailProvider>
  );
}
