import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { routes } from '../../routes';
import { WORKSPACE_NAV } from './navConfig';

interface BottomNavProps {
  currentLibrary: { id: string; name: string } | null;
  onLibraryChange: (libraryId: string) => void;
  className?: string;
}

const linkStyles = cn(
  'flex flex-col items-center justify-center py-2 px-2 gap-1 transition-colors duration-150',
  'text-fg-muted hover:text-fg',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
);

export function BottomNav({ currentLibrary, onLibraryChange, className = '' }: BottomNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = WORKSPACE_NAV.filter((item) => item.primary);

  return (
    <nav
      aria-label={t('components.layout.ariaMobileMainNav')}
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-bg-elevated/95 backdrop-blur-sm border-t border-border z-[var(--z-sticky)] lg:hidden',
        className
      )}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={linkStyles}>
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span className="text-xs">{t(item.label)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            if (!currentLibrary?.id) {
              navigate(routes.home);
              return;
            }
            onLibraryChange(currentLibrary.id);
            navigate(routes.editor(currentLibrary.id), { state: { newNote: true } });
          }}
          className={linkStyles}
          aria-label={t('components.layout.ariaNewNoteBottom')}
        >
          <Plus className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs">{t('components.layout.btnNew')}</span>
        </button>
      </div>
    </nav>
  );
}
