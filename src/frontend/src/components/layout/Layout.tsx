import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLibraries } from '../../hooks/useLibraries';
import { Spinner } from '../ui/Spinner';
import { BottomNav } from './BottomNav';
import { LeftSidebar } from './LeftSidebar';
import { MobileDrawer } from './MobileDrawer';
import { RightSidebar } from './RightSidebar';
import { TopBar } from './TopBar';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { libraries, currentLibrary, setCurrentLibrary, loading: libLoading } = useLibraries();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner label="Loading libraries" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <TopBar
        user={user}
        libraries={libraries}
        currentLibrary={currentLibrary}
        onLibraryChange={handleLibraryChange}
        onMenuClick={() => setMobileMenuOpen(true)}
        onRightSidebarClick={() => setRightSidebarOpen(true)}
        onLogout={logout}
      />

      <div className="flex-1 flex overflow-hidden">
        <MobileDrawer
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          libraries={libraries}
          currentLibrary={currentLibrary}
          onLibraryChange={handleLibraryChange}
        />

        <LeftSidebar library={currentLibrary} className={isMobile ? 'hidden lg:block' : ''} />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Outlet />
        </main>

        <RightSidebar
          isOpen={rightSidebarOpen}
          onClose={() => setRightSidebarOpen(false)}
          className={
            isMobile
              ? 'fixed inset-y-0 right-0 z-50 w-[var(--right-sidebar-w)] transform transition-transform lg:static lg:translate-x-0'
              : ''
          }
        />
      </div>

      <BottomNav
        currentLibrary={currentLibrary}
        onLibraryChange={handleLibraryChange}
        className="lg:hidden"
      />
    </div>
  );
}
