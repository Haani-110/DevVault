/**
 * Large decorative vault-dial illustration for the auth hero panel — a scaled-up,
 * elaborated version of the actual VaultDial logomark (concentric rings, tick
 * marks, a center disc, handle spokes), not a generic stock 3D/particle effect.
 * Pure SVG + CSS, so it's cheap, crisp at any size, and needs no Three.js.
 */
export default function VaultHero() {
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const bolts = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full h-full animate-vault-spin"
      style={{ transformOrigin: '50% 50%' }}
      aria-hidden="true"
    >
      {/* Outer rim */}
      <circle cx="200" cy="200" r="172" stroke="#E8A33D" strokeWidth="2" opacity="0.3" fill="none" />

      {/* Tick marks around the rim, like a combination dial */}
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="200"
          y1="20"
          x2="200"
          y2="34"
          stroke="#E8A33D"
          strokeWidth={deg % 90 === 0 ? 3 : 1.5}
          opacity={deg % 90 === 0 ? 0.55 : 0.3}
          transform={`rotate(${deg} 200 200)`}
        />
      ))}

      {/* Middle ring with bolt/rivet details, like a vault door */}
      <circle cx="200" cy="200" r="112" stroke="#E8A33D" strokeWidth="1.5" opacity="0.4" fill="none" />
      {bolts.map((deg) => (
        <circle
          key={deg}
          cx="200"
          cy="88"
          r="4.5"
          fill="#E8A33D"
          opacity="0.45"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}

      {/* Inner ring */}
      <circle cx="200" cy="200" r="60" stroke="#E8A33D" strokeWidth="1.5" opacity="0.5" fill="none" />

      {/* Handle spokes, like a wheel/vault handle */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="200"
          y1="172"
          x2="200"
          y2="142"
          stroke="#E8A33D"
          strokeWidth="3"
          opacity="0.4"
          strokeLinecap="round"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}

      {/* Center disc */}
      <circle cx="200" cy="200" r="27" fill="#E8A33D" opacity="0.9" />
      <circle cx="200" cy="200" r="27" stroke="#0b0a0a" strokeWidth="1" fill="none" opacity="0.2" />
    </svg>
  );
}
