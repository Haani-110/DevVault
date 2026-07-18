import { useRef, type ReactNode, type CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  strength?: number;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

/**
 * Wraps children in a div that tilts in 3D toward the mouse cursor.
 * Gold glare overlay follows the cursor for a holographic card feel.
 */
export default function Tilt3D({ children, strength = 10, className = '', style, disabled = false }: Props) {
  const ref      = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect  = el.getBoundingClientRect();
      const xNorm = ((e.clientX - rect.left)  / rect.width  - 0.5) * 2; // -1 → 1
      const yNorm = ((e.clientY - rect.top)   / rect.height - 0.5) * 2; // -1 → 1
      const rX    = -yNorm * strength;
      const rY    =  xNorm * strength;
      el.style.transform = `perspective(900px) rotateX(${rX}deg) rotateY(${rY}deg) translateZ(6px) scale(1.015)`;

      if (glareRef.current) {
        const gx = ((e.clientX - rect.left)  / rect.width)  * 100;
        const gy = ((e.clientY - rect.top)   / rect.height) * 100;
        glareRef.current.style.background =
          `radial-gradient(circle at ${gx}% ${gy}%, rgba(232,163,61,0.14) 0%, transparent 55%)`;
        glareRef.current.style.opacity = '1';
      }
    });
  }

  function onMouseEnter() {
    if (disabled) return;
    const el = ref.current;
    if (el) el.style.transition = 'transform 0.08s ease-out';
  }

  function onMouseLeave() {
    if (disabled) return;
    cancelAnimationFrame(frameRef.current);
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1)';
    el.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0) scale(1)';
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  }

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ ...style, transformStyle: 'preserve-3d', willChange: 'transform' }}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {/* Glare overlay — pointer-events: none so it doesn't block clicks */}
      <div
        ref={glareRef}
        aria-hidden
        style={{
          position:       'absolute',
          inset:          0,
          borderRadius:   'inherit',
          pointerEvents:  'none',
          opacity:        0,
          transition:     'opacity 0.3s',
          zIndex:         10,
        }}
      />
    </div>
  );
}
