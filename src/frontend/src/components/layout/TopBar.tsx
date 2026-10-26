import { Bell, FilePlus, Menu, Moon, NotebookPen, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { routes } from '../../routes';
import { api } from '../../services/api';
import { Breadcrumb, type BreadcrumbItem } from '../ui/Breadcrumb';
import { IconButton } from '../ui/IconButton';
import { UserMenu } from './UserMenu';

interface TopBarProps {
  user: { id: string; email: string; role: string } | null;
  currentLibrary: { id: string; name: string } | null;
  breadcrumb?: BreadcrumbItem[];
  onOpenPalette: () => void;
  onMenuClick: () => void;
  /** Drives aria-expanded on the drawer trigger. */
  menuOpen?: boolean;
  onLogout: () => Promise<void>;
}

export function TopBar({
  user,
  currentLibrary,
  breadcrumb,
  onOpenPalette,
  onMenuClick,
  menuOpen = false,
  onLogout,
}: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const { isDark, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const res = (await api.get('/notifications', {
          params: { limit: '1', unreadOnly: true },
        })) as unknown as { success: boolean; data: { items: unknown[]; hasMore: boolean } };
        if (!cancelled && res.success) {
          setUnreadCount(res.data.hasMore ? 2 : res.data.items.length > 0 ? 1 : 0);
        }
      } catch {
        // notifications unavailable: hide badge
      }
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="h-[var(--topbar-h)] bg-bg/80 backdrop-blur-sm border-b border-border flex items-center gap-3 px-4 lg:px-6">
      {/* Left group: menu, identity, and where you are. The breadcrumb is the
          header's answer to "where am I"; the library used to sit here and read
          as a centred page title. */}
      <IconButton
        onClick={onMenuClick}
        aria-label={t('components.layout.ariaOpenMenu')}
        aria-expanded={menuOpen}
        aria-controls="mobile-menu-drawer"
        className="lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </IconButton>

      <Link
        to={routes.home}
        aria-label="Web Note home"
        className="hidden sm:flex items-center gap-2 flex-shrink-0 rounded-md px-1 py-1 text-fg transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <NotebookPen className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-tight">Web Note</span>
      </Link>

      <div className="flex-1 min-w-0 hidden md:flex justify-center">
        {breadcrumb && breadcrumb.length > 0 && (
          <Breadcrumb items={breadcrumb} className="max-w-full" />
        )}
      </div>

      {/* Right group */}
      <div className="flex items-center gap-1 lg:gap-2 ml-auto">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label={t('components.layout.ariaOpenCommandPalette')}
          className="hidden md:flex items-center gap-2 w-40 lg:w-52 px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border text-sm text-fg-subtle hover:text-fg hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Search className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left truncate">
            {t('components.layout.placeholderSearch')}
          </span>
          <kbd className="kbd hidden lg:inline-flex">⌘K</kbd>
        </button>
        <Link
          to={routes.notifications}
          aria-label={
            unreadCount > 0
              ? t('components.layout.ariaNotificationsUnread', { count: unreadCount })
              : t('components.layout.ariaNotifications')
          }
          className="relative inline-flex items-center justify-center rounded-md p-2 text-fg-muted transition-colors duration-150 hover:text-fg hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg [&_svg]:w-5 [&_svg]:h-5"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive"
              aria-hidden="true"
            />
          )}
        </Link>
        {currentLibrary && (
          <IconButton
            onClick={() => navigate(routes.editor(currentLibrary.id), { state: { newNote: true } })}
            aria-label={t('components.layout.ariaNewNote')}
          >
            <FilePlus className="w-5 h-5" />
          </IconButton>
        )}
        <IconButton
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-pressed={isDark}
          aria-label={
            isDark
              ? t('components.layout.ariaSwitchToLight')
              : t('components.layout.ariaSwitchToDark')
          }
          title={
            isDark
              ? t('components.layout.ariaSwitchToLight')
              : t('components.layout.ariaSwitchToDark')
          }
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </IconButton>
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
