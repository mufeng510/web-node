import { type LabelHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: Label is a generic component meant to be used with htmlFor
  <label ref={ref} className={cn('block text-sm font-medium text-fg mb-1', className)} {...props} />
));

Label.displayName = 'Label';
