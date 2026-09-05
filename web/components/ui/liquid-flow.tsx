"use client";

import { useEffect, useRef } from "react";

/**
 * Hero background: a slow aurora of liquid light.
 *
 * Large, soft lobes of colour drift on slow Lissajous paths and overlap, so
 * the surface breathes and shifts without ever resolving into countable
 * objects. That last part is the point: a dense particle field at this scale
 * reads as television static however it is tuned, because the eye counts
 * specks. Broad gradients give depth and motion with nothing to count.
 *
 * The product tie is the drift itself -- nothing here holds still -- and the
 * field is weighted upward, so the hero's downward mask carries it to nothing.
 *
 * Cost is one clear plus six radial-gradient fills per frame. The particle
 * version this replaced issued several hundred stroke calls and a full-canvas
 * composite every frame, which saturated the main thread badly enough to stall
 * Framer Motion's entrance animations elsewhere on the page.
 */

interface LiquidFlowProps {
  className?: string;
}

type Tone = "hot" | "warm" | "cool";

type Lobe = {
  /** Lissajous centre and excursion, in fractions of the canvas. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  phase: number;
  speed: number;
  radius: number;
  alpha: number;
  tone: Tone;
};

export default function LiquidFlow({ className = "" }: LiquidFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let running = true;
    let isLight = document.documentElement.getAttribute("data-theme") === "light";

    /* Uranium leads, amber warms it, periwinkle stops it going monochrome.
       Light mode uses the WCAG-safe accents from DESIGN_RULES section 2. */
    const DARK: Record<Tone, string> = {
      hot: "183,255,60",
      warm: "199,119,0",
      cool: "123,146,255",
    };
    const LIGHT: Record<Tone, string> = {
      hot: "62,122,0",
      warm: "154,92,0",
      cool: "45,111,196",
    };

    /* Placed by hand, not randomised. The composition is asymmetric on
       purpose: mass sits right and high, behind the scrubber card, and stays
       clear of the headline on the left. */
    const lobes: Lobe[] = [
      { ax: 0.30, ay: 0.34, bx: 0.16, by: 0.10, phase: 0.0, speed: 0.000062, radius: 0.62, alpha: 1.0, tone: "hot" },
      { ax: 0.70, ay: 0.30, bx: 0.13, by: 0.14, phase: 1.7, speed: 0.000048, radius: 0.55, alpha: 0.85, tone: "hot" },
      { ax: 0.82, ay: 0.52, bx: 0.10, by: 0.12, phase: 3.1, speed: 0.000039, radius: 0.48, alpha: 0.70, tone: "warm" },
      { ax: 0.18, ay: 0.62, bx: 0.14, by: 0.09, phase: 4.4, speed: 0.000055, radius: 0.44, alpha: 0.55, tone: "cool" },
      { ax: 0.52, ay: 0.22, bx: 0.20, by: 0.08, phase: 2.2, speed: 0.000034, radius: 0.50, alpha: 0.60, tone: "warm" },
      { ax: 0.44, ay: 0.66, bx: 0.18, by: 0.11, phase: 5.6, speed: 0.000044, radius: 0.40, alpha: 0.45, tone: "hot" },
    ];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const draw = (t: number) => {
      const c = isLight ? LIGHT : DARK;
      const min = Math.min(width, height);

      ctx.clearRect(0, 0, width, height);
      // Additive in the dark, so overlapping lobes bloom where they meet.
      ctx.globalCompositeOperation = isLight ? "source-over" : "lighter";

      for (const lobe of lobes) {
        const a = t * lobe.speed + lobe.phase;
        const x = (lobe.ax + Math.sin(a) * lobe.bx) * width;
        // 1.7 against 1.0 keeps the two cycles out of phase, so the path never
        // settles into a visible figure-of-eight.
        const y = (lobe.ay + Math.cos(a * 1.7) * lobe.by) * height;
        const r = lobe.radius * min;
        const rgb = c[lobe.tone];

        // Peak alpha stays low on purpose. These sit behind body copy, and the
        // headline has to remain the brightest thing in the frame.
        const peak = lobe.alpha * (isLight ? 0.1 : 0.17);

        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${peak})`);
        g.addColorStop(0.45, `rgba(${rgb},${peak * 0.38})`);
        g.addColorStop(1, `rgba(${rgb},0)`);

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.globalCompositeOperation = "source-over";
    };

    let raf = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      if (running) draw(now - start);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      draw(0); // one settled frame, no loop
    } else {
      raf = requestAnimationFrame(loop);
    }

    // An unseen hero should cost nothing.
    const io = new IntersectionObserver(([e]) => (running = e.isIntersecting), {
      threshold: 0.01,
    });
    io.observe(canvas);

    const onVisibility = () => {
      running = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const themeObserver = new MutationObserver(() => {
      isLight = document.documentElement.getAttribute("data-theme") === "light";
      if (reduced) draw(0);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
