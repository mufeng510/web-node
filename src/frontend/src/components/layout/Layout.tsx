import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLibraries } from '../../hooks/useLibraries';
import { routes } from '../../routes';
import { CommandPalette } from '../command-palette/CommandPalette';
import type { BreadcrumbItem } from '../ui/Breadcrumb';
import { Spinner } from '../ui/Spinner';
import { BottomNav } from './BottomNav';
import { LeftSidebar } from './LeftSidebar';
import { MobileDrawer } from './MobileDrawer';
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
    <div className="h-[var(--shell-h)] bg-bg grid grid-rows-[var(--topbar-h)_minmax(0,1fr)] overflow-hidden">
      <TopBar
        user={user}
        currentLibrary={currentLibrary}
        breadcrumb={breadcrumb}
        onOpenPalette={() => setPaletteOpen(true)}
        onMenuClick={() => setMobileMenuOpen(true)}
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

        <LeftSidebar
          libraries={libraries}
          currentLibrary={currentLibrary}
          onLibraryChange={handleLibraryChange}
          className="hidden lg:flex"
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden pb-[var(--bottom-nav-h)] lg:pb-0">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <BottomNav
        currentLibrary={currentLibrary}
        onLibraryChange={handleLibraryChange}
        className="lg:hidden"
      />
    </div>
  );
}
