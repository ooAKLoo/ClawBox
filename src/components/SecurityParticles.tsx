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
  /** Per-particle pulse phase */
  pulsePhase: number;
  /** Per-particle pulse amplitude */
  pulseAmp: number;
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
const BREATH_SPEED = 0.34; // cycles / second
const BREATH_SCALE = 0.032;
const DIFFUSE_SPEED = 0.58; // cycles / second
const DIFFUSE_STRENGTH = 0.052; // radial spread amount
const DIFFUSE_PHASE_SPREAD = 0.58; // lower = more coherent
const WOBBLE_SPEED = 0.32; // cycles / second
const WOBBLE_ANGLE = 0.12; // radians
const PARTICLE_BASE_SIZE = 1.05;
const PARTICLE_SIZE_JITTER = 0.12;
const PARTICLE_BASE_ALPHA = 0.38;
const PARTICLE_ALPHA_JITTER = 0.08;

function initParticles(): SphereParticle[] {
  const particles: SphereParticle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Fibonacci sphere distribution for even spacing
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2; // -1 to 1
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const theta = goldenAngle * i;
    const phi = Math.acos(y);

    particles.push({
      theta,
      phi,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseAmp: 0.86 + Math.random() * 0.28,
      r: PARTICLE_BASE_SIZE + (Math.random() * 2 - 1) * PARTICLE_SIZE_JITTER,
      baseAlpha: PARTICLE_BASE_ALPHA + (Math.random() * 2 - 1) * PARTICLE_ALPHA_JITTER,
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
  const lastTimeRef = useRef<number | null>(null);
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

    const draw = (time: number) => {
      ctx.clearRect(0, 0, size, size);
      const prevTime = lastTimeRef.current ?? time;
      const delta = Math.min(time - prevTime, 32);
      lastTimeRef.current = time;

      // Keep rotation speed stable regardless of refresh rate.
      rotationRef.current += ROTATION_SPEED * (delta / (1000 / 60));
      const rot = rotationRef.current;
      const t = time * 0.001;
      const tau = Math.PI * 2;

      const breathingRaw = Math.sin(t * tau * BREATH_SPEED);
      const breathWave = (breathingRaw + 1) / 2;
      // Smooth envelope so inhale/exhale feels gentle.
      const breathEnvelope = breathWave * breathWave * (3 - 2 * breathWave);
      const breathing = 1 + breathingRaw * BREATH_SCALE;

      const dynamicRadius = sphereRadius * breathing;
      const wobble = Math.sin(t * tau * WOBBLE_SPEED) * WOBBLE_ANGLE;
      const cosWobble = Math.cos(wobble);
      const sinWobble = Math.sin(wobble);

      // Soft halo to improve breathing texture and depth.
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        dynamicRadius * 0.2,
        cx,
        cy,
        dynamicRadius * 1.35
      );
      halo.addColorStop(0, `rgba(${r},${g},${b},${0.06 + breathEnvelope * 0.05})`);
      halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      const ps = particlesRef.current;

      // Project and sort by depth for correct layering
      const projected: { x: number; y: number; z: number; r: number; alpha: number }[] = [];

      for (const p of ps) {
        const theta = p.theta + rot;
        const sinPhi = Math.sin(p.phi);
        const cosPhi = Math.cos(p.phi);
        const localWave = (Math.sin(t * tau * DIFFUSE_SPEED + p.pulsePhase * DIFFUSE_PHASE_SPREAD) + 1) / 2;
        const localDiffuse = DIFFUSE_STRENGTH * p.pulseAmp * (0.35 + localWave * 0.65) * breathEnvelope;
        const pulsedRadius = dynamicRadius * (1 + localDiffuse);

        // 3D coordinates
        const x3d = pulsedRadius * sinPhi * Math.cos(theta);
        const y3d = pulsedRadius * cosPhi;
        const z3d = pulsedRadius * sinPhi * Math.sin(theta);

        // Add slight wobble so the sphere feels less mechanical.
        const yTilt = y3d * cosWobble - z3d * sinWobble;
        const zTilt = y3d * sinWobble + z3d * cosWobble;

        // Depth factor: front particles brighter/larger, back particles dimmer
        const depthFactor = (zTilt + dynamicRadius) / (2 * dynamicRadius); // 0 (back) to 1 (front)

        projected.push({
          x: cx + x3d,
          y: cy + yTilt,
          z: zTilt,
          r: p.r * (0.52 + depthFactor * 0.78) * (1 + localDiffuse * 0.55),
          alpha: p.baseAlpha * (0.24 + depthFactor * 0.76) * (0.9 + breathEnvelope * 0.08 + localDiffuse * 0.2),
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
          if (dist < dynamicRadius * 0.6) {
            const lineAlpha =
              (1 - dist / (dynamicRadius * 0.6))
              * 0.06
              * Math.min(projected[i].alpha, projected[j].alpha)
              * 3
              * (0.88 + breathEnvelope * 0.2);
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

      // Inner glow pulse to strengthen "breathing" feel.
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.14 + breathEnvelope * 0.08})`;
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [size, sphereRadius, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
