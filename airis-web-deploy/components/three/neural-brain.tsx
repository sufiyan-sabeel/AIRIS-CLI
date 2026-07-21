// @ts-nocheck — JSX types provided by @react-three/fiber at runtime
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface NeuralBrainProps {
  mouseX?: number;
  mouseY?: number;
  scrollProgress?: number;
  isReduced?: boolean;
  lowQuality?: boolean;
}

const NODE_COUNT = 80;
const CONNECTION_DISTANCE = 3.5;
const SPHERE_RADIUS = 2.2;
const CORE_COLOR = new THREE.Color("#3b82f6");
const CONNECTION_COLOR = new THREE.Color("#06b6d4");
const ENERGY_COLOR = new THREE.Color("#60a5fa");

function fiboSphere(index: number, total: number, radius: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (index + 0.5)) / total);
  const theta = Math.PI * (1 + Math.sqrt(5)) * index;
  const r = radius * (0.7 + Math.random() * 0.3);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}

function createNodePositions(count: number): THREE.Vector3[] {
  return Array.from({ length: count }, (_, i) => fiboSphere(i, count, SPHERE_RADIUS));
}

interface Connection {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  alpha: number;
  energyPhase: number;
}

function buildConnections(positions: THREE.Vector3[]): Connection[] {
  const pairs: Connection[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const d = positions[i].distanceTo(positions[j]);
      if (d < CONNECTION_DISTANCE && Math.random() < 0.15) {
        pairs.push({
          p1: positions[i],
          p2: positions[j],
          alpha: 1 - d / CONNECTION_DISTANCE,
          energyPhase: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  return pairs;
}

function NeuralCore({ isReduced, lowQuality }: { isReduced: boolean; lowQuality: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame((state) => {
    if (isReduced || !meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.x = Math.sin(t * 0.15) * 0.1;
    meshRef.current.rotation.y = t * 0.08;
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.2 + Math.sin(t * 0.5) * 0.08;
    }
  });

  return (
    <mesh ref={meshRef}>
      {lowQuality ? (
        <sphereGeometry args={[0.6, 16, 16]} />
      ) : (
        <icosahedronGeometry args={[0.6, 2]} />
      )}
      <meshPhysicalMaterial
        ref={materialRef}
        color="#1e40af"
        emissive="#3b82f6"
        emissiveIntensity={0.2}
        metalness={0.8}
        roughness={0.2}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

function NeuralNodes({ isReduced, lowQuality }: { isReduced: boolean; lowQuality: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => createNodePositions(NODE_COUNT), []);
  const totalNodes = lowQuality ? Math.round(NODE_COUNT * 0.6) : NODE_COUNT;
  const activePositions = positions.slice(0, totalNodes);

  const [posArray, sizes, colors] = useMemo(() => {
    const pos = new Float32Array(totalNodes * 3);
    const sz = new Float32Array(totalNodes);
    const col = new Float32Array(totalNodes * 3);
    activePositions.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      sz[i] = 0.04 + Math.random() * (lowQuality ? 0.04 : 0.06);
      const c = CORE_COLOR.clone().lerp(new THREE.Color("#60a5fa"), Math.random());
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    return [pos, sz, col];
  }, [activePositions, totalNodes, lowQuality]);

  useFrame((state) => {
    if (isReduced || !pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const p = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < totalNodes; i++) {
      const idx = i * 3;
      const base = activePositions[i];
      const wave = Math.sin(t * 0.3 + i * 0.2) * 0.08;
      const wave2 = Math.cos(t * 0.2 + i * 0.15) * 0.05;
      p[idx] = base.x + wave;
      p[idx + 1] = base.y + wave2;
      p[idx + 2] = base.z + Math.sin(t * 0.25 + i * 0.1) * 0.06;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={totalNodes} array={posArray} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={totalNodes} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-color" count={totalNodes} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={lowQuality ? 0.08 : 0.12}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function NeuralConnections({ isReduced, lowQuality }: { isReduced: boolean; lowQuality: boolean }) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const energyRef = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => createNodePositions(NODE_COUNT), []);
  const totalNodes = lowQuality ? Math.round(NODE_COUNT * 0.6) : NODE_COUNT;
  const activePositions = positions.slice(0, totalNodes);

  const { connPos, connCol } = useMemo(() => {
    const connections = buildConnections(activePositions);
    const pos = new Float32Array(connections.length * 6);
    const col = new Float32Array(connections.length * 6);
    connections.forEach(({ p1, p2, alpha }, i) => {
      pos[i * 6] = p1.x;
      pos[i * 6 + 1] = p1.y;
      pos[i * 6 + 2] = p1.z;
      pos[i * 6 + 3] = p2.x;
      pos[i * 6 + 4] = p2.y;
      pos[i * 6 + 5] = p2.z;
      const bright = 0.4 + alpha * 0.6;
      const c = CONNECTION_COLOR.clone().multiplyScalar(bright);
      col[i * 6] = c.r;
      col[i * 6 + 1] = c.g;
      col[i * 6 + 2] = c.b;
      col[i * 6 + 3] = c.r;
      col[i * 6 + 4] = c.g;
      col[i * 6 + 5] = c.b;
    });
    return { connPos: pos, connCol: col };
  }, [activePositions]);

  // Energy pulse connections
  const energyPositions = useMemo(() => {
    const connections = buildConnections(activePositions);
    const pos = new Float32Array(connections.length * 6);
    connections.forEach(({ p1, p2 }, i) => {
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      pos[i * 6] = mid.x;
      pos[i * 6 + 1] = mid.y;
      pos[i * 6 + 2] = mid.z;
      pos[i * 6 + 3] = mid.x;
      pos[i * 6 + 4] = mid.y;
      pos[i * 6 + 5] = mid.z;
    });
    return pos;
  }, [activePositions]);

  useFrame((state) => {
    if (isReduced) return;
    const t = state.clock.elapsedTime;

    if (linesRef.current) {
      linesRef.current.rotation.y = t * 0.03;
      linesRef.current.rotation.x = Math.sin(t * 0.1) * 0.05;
    }
    if (energyRef.current && !lowQuality) {
      energyRef.current.rotation.y = t * 0.03;
      energyRef.current.rotation.x = Math.sin(t * 0.1) * 0.05;
      const attr = energyRef.current.geometry.attributes.position;
      const p = attr.array as Float32Array;
      const connections = buildConnections(activePositions);
      const maxEnergy = Math.min(connections.length, p.length / 6);
      for (let i = 0; i < maxEnergy; i++) {
        const { p1, p2, energyPhase } = connections[i];
        const prog = (Math.sin(t * 0.8 + energyPhase) + 1) * 0.5;
        const pt = new THREE.Vector3().copy(p1).lerp(p2, prog);
        p[i * 6] = pt.x;
        p[i * 6 + 1] = pt.y;
        p[i * 6 + 2] = pt.z;
        p[i * 6 + 3] = pt.x;
        p[i * 6 + 4] = pt.y;
        p[i * 6 + 5] = pt.z;
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={connPos.length / 3} array={connPos} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={connCol.length / 3} array={connCol} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {!lowQuality && (
        <lineSegments ref={energyRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={energyPositions.length / 3} array={energyPositions} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#60a5fa" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

export function NeuralBrain({
  mouseX = 0,
  mouseY = 0,
  scrollProgress = 0,
  isReduced = false,
  lowQuality = false,
}: NeuralBrainProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (!isReduced) {
      // Mouse-reactive rotation with spring-like smoothing
      const targetRX = mouseY * 0.3 - 0.15;
      const targetRY = mouseX * 0.3 - 0.1;
      groupRef.current.rotation.x += (targetRX - groupRef.current.rotation.x) * 0.03;
      groupRef.current.rotation.y += (targetRY - groupRef.current.rotation.y) * 0.03;

      // Scroll-reactive motion - subtle y offset and scale breathing
      const scrollOffset = scrollProgress * 0.4;
      const breathe = Math.sin(state.clock.elapsedTime * 0.15) * 0.03;
      groupRef.current.position.y = -scrollOffset + breathe;
    }

    if (glowRef.current && !isReduced) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.8, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Outer glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.8, 48]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Neural connections with energy pulses */}
      <NeuralConnections isReduced={isReduced} lowQuality={lowQuality} />

      {/* Neural nodes */}
      <NeuralNodes isReduced={isReduced} lowQuality={lowQuality} />

      {/* Core */}
      <NeuralCore isReduced={isReduced} lowQuality={lowQuality} />

      {/* Inner particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={lowQuality ? 15 : 30}
            array={new Float32Array((lowQuality ? 15 : 30) * 3).map(() => (Math.random() - 0.5) * 1.5)}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.03} color="#60a5fa" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
}
