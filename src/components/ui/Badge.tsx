import clsx from 'clsx';
import type { PropsWithChildren } from 'react';

type Tone = 'brass' | 'mint' | 'danger' | 'muted';

const tones: Record<Tone, string> = {
  brass: 'bg-brass-400/10 text-brass-400 border-brass-400/25',
  mint: 'bg-mint-500/10 text-mint-400 border-mint-500/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  muted: 'bg-surface-hover text-text-muted border-border',
};

export default function Badge({ tone = 'muted', children }: PropsWithChildren<{ tone?: Tone }>) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium border',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
