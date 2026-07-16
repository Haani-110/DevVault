import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center text-text-muted text-xl mb-4">
        {icon}
      </div>
      <h3 className="font-display font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-5">{description}</p>
      {action}
    </div>
  );
}
