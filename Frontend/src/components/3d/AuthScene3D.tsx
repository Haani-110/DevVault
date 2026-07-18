import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Floating vault ring (torus) ── */
interface RingProps {
  position: [number, number, number];
  radius: number;
  tube?: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color?: string;
}

function Ring({ position, radius, tube = 0.013, speedX, speedY, opacity, color = '#E8A33D' }: RingProps) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * speedX;
    ref.current.rotation.y = clock.elapsedTime * speedY;
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[radius, tube, 16, 160]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

/* ── Wireframe icosahedron in the centre ── */
function CentralGem() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * 0.13;
    ref.current.rotation.y = clock.elapsedTime * 0.18;
    ref.current.rotation.z = clock.elapsedTime * 0.06;
  });
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <icosahedronGeometry args={[1.6, 1]} />
      <meshBasicMaterial color="#E8A33D" wireframe transparent opacity={0.055} />
    </mesh>
  );
}

/* ── Glowing star field ── */
function StarField({ count = 320 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14;
      sz[i] = Math.random() * 0.06 + 0.02;
    }
    return [pos, sz];
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.018;
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.04) * 0.06;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size"     args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color="#E8A33D"
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.55}
        vertexColors={false}
      />
    </points>
  );
}

/* ── Secondary dim particles (depth fill) ── */
function DimParticles({ count = 180 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 32;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    return pos;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = -clock.elapsedTime * 0.009;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#5EEAD4" size={0.025} sizeAttenuation transparent opacity={0.22} />
    </points>
  );
}

/* ── Mouse-parallax camera rig ── */
function CameraRig() {
  const { camera } = useThree();
  useFrame(({ mouse }) => {
    camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (mouse.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ── Scene content ── */
function SceneContent() {
  return (
    <>
      <CameraRig />
      <StarField count={300} />
      <DimParticles count={160} />
      <CentralGem />

      {/* Primary vault rings */}
      <Ring position={[0, 0, 0]}       radius={2.8}  speedX={0.10}  speedY={0.07}  opacity={0.22} />
      <Ring position={[0, 0, 0]}       radius={2.2}  speedX={-0.07} speedY={0.12}  opacity={0.16} />
      {/* Offset rings for depth */}
      <Ring position={[1.2, 0.6, -2]}  radius={1.6}  speedX={0.14}  speedY={0.08}  opacity={0.13} />
      <Ring position={[-1, -0.8, -3]}  radius={3.6}  speedX={0.05}  speedY={-0.06} opacity={0.09} />
      <Ring position={[0.4, -1.2, -1]} radius={1.1}  speedX={0.18}  speedY={0.10}  opacity={0.18} />
      {/* Teal accent ring */}
      <Ring position={[-0.6, 1, -2]}   radius={2.0}  speedX={-0.09} speedY={0.05}  opacity={0.10} color="#5EEAD4" />
    </>
  );
}

/* ── Exported component ── */
export default function AuthScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
