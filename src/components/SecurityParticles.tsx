import { useRef, useEffect } from "react";

/**
 * 3D particle sphere rendered via Canvas 2D projection.
 * Particles are distributed on a sphere surface and slowly rotate,
 * creating a "force field / shield" visual.
 */

interface SphereParticle {
  /** Spherical coords */
  theta: number;
  phi: number;
  /** Size */
  r: number;
  /** Base alpha */
  baseAlpha: number;
}

interface Props {
  /** size of the canvas (square) */
  size?: number;
  /** sphere radius in px */
  sphereRadius?: number;
  /** accent color rgb array */
  color?: [number, number, number];
  className?: string;
}

const PARTICLE_COUNT = 60;
const ROTATION_SPEED = 0.003;

function initParticles(): SphereParticle[] {
  const particles: SphereParticle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Fibonacci sphere distribution for even spacing
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const theta = goldenAngle * i;
    const phi = Math.acos(y);

    particles.push({
      theta,
      phi,
      r: 0.8 + Math.random() * 0.8,
      baseAlpha: 0.25 + Math.random() * 0.35,
    });
  }
  return particles;
}

export default function SecurityParticles({
  size = 92,
  sphereRadius = 38,
  color = [16, 185, 129],
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<SphereParticle[]>(initParticles());
  const rotationRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const [r, g, b] = color;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      rotationRef.current += ROTATION_SPEED;
      const rot = rotationRef.current;

      const ps = particlesRef.current;

      // Project and sort by depth for correct layering
      const projected: { x: number; y: number; z: number; r: number; alpha: number }[] = [];

      for (const p of ps) {
        const theta = p.theta + rot;
        const sinPhi = Math.sin(p.phi);
        const cosPhi = Math.cos(p.phi);

        // 3D coordinates
        const x3d = sphereRadius * sinPhi * Math.cos(theta);
        const y3d = sphereRadius * cosPhi;
        const z3d = sphereRadius * sinPhi * Math.sin(theta);

        // Depth factor: front particles brighter/larger, back particles dimmer
        const depthFactor = (z3d + sphereRadius) / (2 * sphereRadius); // 0 (back) to 1 (front)

        projected.push({
          x: cx + x3d,
          y: cy + y3d,
          z: z3d,
          r: p.r * (0.5 + depthFactor * 0.8),
          alpha: p.baseAlpha * (0.2 + depthFactor * 0.8),
        });
      }

      // Sort back to front
      projected.sort((a, b) => a.z - b.z);

      // Draw connection lines between nearby front-facing particles
      for (let i = 0; i < projected.length; i++) {
        if (projected[i].z < 0) continue; // skip back-facing
        for (let j = i + 1; j < projected.length; j++) {
          if (projected[j].z < 0) continue;
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < sphereRadius * 0.6) {
            const lineAlpha = (1 - dist / (sphereRadius * 0.6)) * 0.06 * Math.min(projected[i].alpha, projected[j].alpha) * 3;
            ctx.strokeStyle = `rgba(${r},${g},${b},${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, sphereRadius, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
