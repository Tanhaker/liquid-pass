"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient particle field behind the hero.
 *
 * Canvas 2D rather than WebGL/Three.js: it is ~70 lines, has no dependency,
 * cannot fail to acquire a context on a locked-down machine, and costs a
 * fraction of the frame budget. It is also purely decorative and sits behind
 * `aria-hidden`, so if it never draws, nothing is lost.
 *
 * Guards, in order of how likely they are to matter during a live demo:
 *   - prefers-reduced-motion renders one static frame and stops
 *   - the loop pauses entirely while the tab is hidden
 *   - particle count scales with viewport area and is capped
 *   - devicePixelRatio is clamped to 2, so a 3x phone does not render 9x pixels
 */
export function Constellation({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let points: P[] = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ~1 point per 14k px², capped so a wide monitor doesn't melt.
      const count = Math.min(90, Math.floor((w * h) / 14000));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 1.4 + 0.5,
      }));
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h);

      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Links first so dots sit on top of them.
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 130 * 130) continue;
          const alpha = (1 - Math.sqrt(d2) / 130) * 0.22;
          ctx!.strokeStyle = `rgba(94,234,212,${alpha})`;
          ctx!.lineWidth = 0.6;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      for (const p of points) {
        ctx!.fillStyle = "rgba(167,139,250,0.5)";
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    function start() {
      cancelAnimationFrame(raf);
      if (reduced) {
        frame();
        cancelAnimationFrame(raf);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    }

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
