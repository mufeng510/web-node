import { X } from 'lucide-react';
import {
  type HTMLAttributes,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerId: string;
  contentId: string;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within Dialog.Root');
  }
  return context;
}

interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function DialogRoot({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerId = useId();
  const contentId = useId();
  const titleId = useId();
  const descriptionId = useId();

  const handleOpenChange = (value: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(value);
    }
    onOpenChange?.(value);
  };

  return (
    <DialogContext.Provider
      value={{ open, onOpenChange: handleOpenChange, triggerId, contentId, titleId, descriptionId }}
    >
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function DialogTrigger({ children, className, ...props }: DialogTriggerProps) {
  const { open, onOpenChange, triggerId, contentId } = useDialogContext();

  return (
    <button
      id={triggerId}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={contentId}
      className={cn('', className)}
      onClick={() => onOpenChange(!open)}
      {...props}
    >
      {children}
    </button>
  );
}

DialogTrigger.displayName = 'DialogTrigger';

interface DialogPortalProps {
  children: ReactNode;
}

export function DialogPortal({ children }: DialogPortalProps) {
  if (typeof window === 'undefined') return null;
  const portalRoot = document.getElementById('dialog-portal') || document.body;
  return portalRoot === document.body ? children : children;
}

interface DialogOverlayProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogOverlay({ className, onClick, ...props }: DialogOverlayProps) {
  const { open, onOpenChange } = useDialogContext();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className={cn('fixed inset-0 bg-overlay/50 z-50 animate-in fade-in-0', className)}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    />
  );
}

interface DialogContentProps extends HTMLAttributes<HTMLDialogElement> {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function DialogContent({ children, className, size = 'md', ...props }: DialogContentProps) {
  const { open, onOpenChange, contentId, titleId, descriptionId } = useDialogContext();
  const contentRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    contentRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[90vw]',
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <dialog
        ref={contentRef}
        id={contentId}
        open
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full m-0 p-0 animate-in zoom-in-95 fade-in-0',
          'bg-bg-elevated border border-border rounded-lg shadow-lg text-fg',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </dialog>
    </DialogPortal>
  );
}

interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <div className={cn('px-6 py-4 border-b border-border', className)} {...props} />;
}

DialogHeader.displayName = 'DialogHeader';

interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  const { titleId, descriptionId } = useDialogContext();
  return (
    <h2
      id={titleId}
      aria-describedby={descriptionId}
      className={cn('text-lg font-semibold text-fg', className)}
      {...props}
    />
  );
}

DialogTitle.displayName = 'DialogTitle';

interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext();
  return (
    <p id={descriptionId} className={cn('mt-1 text-sm text-fg-muted', className)} {...props} />
  );
}

DialogDescription.displayName = 'DialogDescription';

interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <div className={cn('px-4 py-3 flex items-center justify-end gap-2', className)} {...props} />
  );
}

DialogFooter.displayName = 'DialogFooter';

interface DialogCloseProps extends HTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export function DialogClose({
  className,
  children,
  label = 'Close dialog',
  ...props
}: DialogCloseProps) {
  const { onOpenChange } = useDialogContext();

  return (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      aria-label={label}
      className={cn(
        'absolute right-4 top-4 p-1 rounded text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        className
      )}
      {...props}
    >
      {children || <X className="w-5 h-5" />}
    </button>
  );
}

DialogClose.displayName = 'DialogClose';

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Footer: DialogFooter,
  Close: DialogClose,
});
