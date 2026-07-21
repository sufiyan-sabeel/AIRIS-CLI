// @ts-nocheck — JSX types provided by @react-three/fiber at runtime
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

interface ParticleNetworkProps {
  count?: number;
  area?: number;
  connectionDistance?: number;
  speed?: number;
  color?: string;
  mouseX?: number;
  mouseY?: number;
}

export function ParticleNetwork({
  count = 120,
  area = 12,
  connectionDistance = 3,
  speed = 0.15,
  color = "#3b82f6",
  mouseX = 0,
  mouseY = 0,
}: ParticleNetworkProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const prefersReduced = useReducedMotion();
  const mouseVec = useRef(new THREE.Vector2());

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * area;
    }
    return pos;
  }, [count, area]);

  const velocities = useMemo(() => {
    return new Float32Array(count * 3).map(() => (Math.random() - 0.5) * speed);
  }, [count, speed]);

  const sizes = useMemo(() => {
    return new Float32Array(count).map(() => 0.02 + Math.random() * 0.06);
  }, [count]);

  const basePositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * area;
    }
    return pos;
  }, [count, area]);

  const baseVelocities = useMemo(() => {
    return new Float32Array(count * 3).map(() => (Math.random() - 0.5) * speed);
  }, [count, speed]);

  useFrame((state) => {
    if (prefersReduced) return;

    const time = state.clock.elapsedTime;
    mouseVec.current.x = mouseX;
    mouseVec.current.y = mouseY;

    // Update particle positions
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < count * 3; i += 3) {
        // Movement
        pos[i] += velocities[i] * 0.5;
        pos[i + 1] += velocities[i + 1] * 0.5;
        pos[i + 2] += velocities[i + 2] * 0.5;

        // Mouse repulsion
        const dx = pos[i] - mouseVec.current.x * 6;
        const dy = pos[i + 1] - mouseVec.current.y * 4;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          const force = (2 - dist) / 2;
          pos[i] += (dx / dist) * force * 0.01;
          pos[i + 1] += (dy / dist) * force * 0.01;
        }

        // Boundary wrap
        for (let j = 0; j < 3; j++) {
          if (Math.abs(pos[i + j]) > area / 2) {
            pos[i + j] *= -0.9;
          }
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Update connections
    if (linesRef.current && pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position
        .array as Float32Array;
      const pairs: number[] = [];
      const pairColors: number[] = [];

      const c = new THREE.Color(color);
      const maxPairs = Math.min(800, count * 3);

      for (let i = 0; i < count && pairs.length < maxPairs * 6; i += 2) {
        const i3 = i * 3;
        for (let j = i + 2; j < count && pairs.length < maxPairs * 6; j += 2) {
          const j3 = j * 3;
          const dx = pos[i3] - pos[j3];
          const dy = pos[i3 + 1] - pos[j3 + 1];
          const dz = pos[i3 + 2] - pos[j3 + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < connectionDistance) {
            const alpha = 1 - d / connectionDistance;
            pairs.push(pos[i3], pos[i3 + 1], pos[i3 + 2]);
            pairs.push(pos[j3], pos[j3 + 1], pos[j3 + 2]);
            const ca = c.clone().multiplyScalar(alpha * 0.4);
            pairColors.push(ca.r, ca.g, ca.b, ca.r, ca.g, ca.b);
          }
        }
      }

      const geom = linesRef.current.geometry;
      geom.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(pairs), 3)
      );
      geom.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(pairColors), 3)
      );
      geom.attributes.position.needsUpdate = true;
      geom.attributes.color.needsUpdate = true;
      geom.setDrawRange(0, pairs.length / 3);
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={basePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={count}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          color={color}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={0}
            array={new Float32Array()}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={0}
            array={new Float32Array()}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
