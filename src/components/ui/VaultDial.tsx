import clsx from 'clsx';

export default function VaultDial({
  size = 28,
  spinning = false,
}: {
  size?: number;
  spinning?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={clsx(spinning && 'animate-dial-tick')}
    >
      <circle cx="16" cy="16" r="14" stroke="#E8A33D" strokeWidth="2" />
      <circle cx="16" cy="16" r="4.5" fill="#E8A33D" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360) / 8;
        return (
          <line
            key={i}
            x1="16"
            y1="3.5"
            x2="16"
            y2="6.5"
            stroke="#E8A33D"
            strokeWidth="1.5"
            strokeLinecap="round"
            transform={`rotate(${angle} 16 16)`}
          />
        );
      })}
    </svg>
  );
}
