import clsx from 'clsx';

interface Props {
  className?: string;
}

export default function Skeleton({ className }: Props) {
  return (
    <div
      className={clsx(
        'rounded-lg bg-surface-hover animate-pulse',
        className
      )}
    />
  );
}
