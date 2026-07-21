// @ts-nocheck — JSX types provided by @react-three/fiber at runtime
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FloatingGeometryProps {
  count?: number;
  lowQuality?: boolean;
}

const GEOMETRIES = ["octahedron", "torus", "dodecahedron", "icosahedron"] as const;

function createGeometry(type: string, scale: number): THREE.BufferGeometry {
  switch (type) {
    case "octahedron": return new THREE.OctahedronGeometry(scale);
    case "torus": return new THREE.TorusGeometry(scale, scale * 0.3, 8, 12);
    case "dodecahedron": return new THREE.DodecahedronGeometry(scale);
    case "icosahedron": return new THREE.IcosahedronGeometry(scale);
    default: return new THREE.OctahedronGeometry(scale);
  }
}

interface GeoInstance {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  speed: number;
  phase: number;
  color: string;
}

const COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#6366f1", "#0ea5e9"];

export function FloatingGeometry({ count = 20, lowQuality = false }: FloatingGeometryProps) {
  const groupRef = useRef<THREE.Group>(null);

  const instances = useMemo(() => {
    const items: GeoInstance[] = [];
    const adjustedCount = lowQuality ? Math.min(count, 8) : count;
    for (let i = 0; i < adjustedCount; i++) {
      const type = GEOMETRIES[i % GEOMETRIES.length];
      const s = lowQuality ? 0.12 + Math.random() * 0.2 : 0.08 + Math.random() * 0.25;
      items.push({
        geometry: createGeometry(type, s),
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 8,
          -3 - Math.random() * 10
        ),
        rotation: new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
        scale: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        color: COLORS[i % COLORS.length],
      });
    }
    return items;
  }, [count, lowQuality]);

  const meshesRef = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    instances.forEach((inst, i) => {
      const mesh = meshesRef.current[i];
      if (!mesh) return;
      mesh.position.x = inst.position.x + Math.sin(time * inst.speed * 0.5 + inst.phase) * 0.5;
      mesh.position.y = inst.position.y + Math.sin(time * inst.speed * 0.3 + inst.phase * 1.3) * 0.4;
      mesh.position.z = inst.position.z + Math.sin(time * inst.speed * 0.2 + inst.phase * 0.7) * 0.3;
      mesh.rotation.x += inst.speed * 0.003;
      mesh.rotation.y += inst.speed * 0.005;
      mesh.rotation.z += inst.speed * 0.002;
      const pulse = 1 + Math.sin(time * inst.speed + inst.phase) * 0.05;
      mesh.scale.setScalar(inst.scale * pulse);
    });
  });

  return (
    <group ref={groupRef}>
      {instances.map((inst, i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => { meshesRef.current[i] = el; }}
          geometry={inst.geometry}
          position={inst.position}
          rotation={inst.rotation}
          scale={inst.scale}
        >
          <meshPhysicalMaterial
            color={inst.color}
            metalness={lowQuality ? 0.1 : 0.3}
            roughness={lowQuality ? 0.6 : 0.4}
            transparent
            opacity={lowQuality ? 0.06 : 0.12}
            wireframe
            envMapIntensity={lowQuality ? 0 : 0.2}
          />
        </mesh>
      ))}
    </group>
  );
}
