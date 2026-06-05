import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
        secondary:
          'border-transparent bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        outline: 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300',
        success:
          'border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
        danger: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
