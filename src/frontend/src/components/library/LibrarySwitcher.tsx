import { Check, ChevronDown, FolderGit2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { DropdownMenu } from '../ui/DropdownMenu';

export interface LibraryOption {
  id: string;
  name: string;
}

export interface LibrarySwitcherProps {
  libraries: LibraryOption[];
  currentLibrary: LibraryOption | null;
  onLibraryChange: (libraryId: string) => void;
  /** Whether the file tree below is showing this library's files. */
  active?: boolean;
}

/** Declares which library the file tree below belongs to. A single-library
 * install renders the same clickable button as a multi-library one; an earlier
 * version degraded to an inert div that looked identical but did nothing. */
export function LibrarySwitcher({
  libraries,
  currentLibrary,
  onLibraryChange,
  active = false,
}: LibrarySwitcherProps) {
  const [open, setOpen] = useState(false);
  const isOnlyLibrary = libraries.length <= 1;

  return (
    <div className="px-2 py-2 border-b border-border">
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Switch library"
        menuClassName="min-w-[12rem]"
        trigger={
          <button
            type="button"
            aria-label={
              isOnlyLibrary ? `Library: ${currentLibrary?.name ?? 'none'}` : 'Switch library'
            }
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium',
              'border transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              active
                ? 'border-border-strong bg-bg-hover text-fg'
                : 'border-transparent hover:bg-bg-hover text-fg'
            )}
          >
            <FolderGit2 className="w-4 h-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
            <span className="truncate flex-1 text-left">
              {currentLibrary?.name ?? 'Select library'}
            </span>
            {!isOnlyLibrary && (
              <ChevronDown className="w-4 h-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
            )}
          </button>
        }
      >
        {libraries.length === 0 && (
          <p className="px-3 py-2 text-sm text-fg-muted">No libraries yet</p>
        )}
        {isOnlyLibrary && currentLibrary && (
          <p className="px-3 py-2 text-sm text-fg-muted">
            {currentLibrary.name} is the only registered library.
          </p>
        )}
        {libraries.map((library) => (
          <button
            key={library.id}
            type="button"
            role="menuitemradio"
            aria-checked={currentLibrary?.id === library.id}
            onClick={() => {
              onLibraryChange(library.id);
              setOpen(false);
            }}
            className={cn(
              'w-full px-3 py-2 text-sm text-left flex items-center gap-2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              currentLibrary?.id === library.id
                ? 'bg-primary/10 text-primary'
                : 'text-fg hover:bg-bg-hover'
            )}
          >
            <FolderGit2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{library.name}</span>
            {currentLibrary?.id === library.id && (
              <Check className="w-4 h-4 ml-auto" aria-hidden="true" />
            )}
          </button>
        ))}
      </DropdownMenu>
    </div>
  );
}
