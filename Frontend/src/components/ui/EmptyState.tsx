import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-hover border border-border flex items-center justify-center text-text-faint">
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-xs">
        <p className="font-display font-semibold text-text">{title}</p>
        {description && <p className="text-sm text-text-muted leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
