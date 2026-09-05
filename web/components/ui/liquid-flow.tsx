"use client";

import { useEffect, useRef } from "react";

/**
 * Hero background: a moving aurora.
 *
 * Three layers running at deliberately different speeds, so the frame reads as
 * having depth rather than as one thing sliding about:
 *
 *   1. Colour lobes drifting on Lissajous paths        ~14-26s per cycle
 *   2. A soft diagonal light sweep crossing the frame  ~11s
 *   3. A dozen bright motes rising through it          ~8-20s each
 *
 * The counts matter. An earlier version of this used several hundred particles
 * and read as television static, because at hero scale the eye starts counting
 * specks. A dozen reads as deliberate. Everything else here is broad gradient,
 * which gives motion with nothing to count.
 *
 * Speeds matter just as much: the first pass at this drifted on 100-second
 * cycles, which moves about 5% of the canvas in the time anyone actually looks
 * at a hero. It was mistaken for a still image. These cycles are ~7x faster.
 *
 * Cost per frame: one clear, six radial fills, one sweep fill, twelve small
 * arcs. Cheap enough that it never competes with the page for the main thread.
 */

interface LiquidFlowProps {
  className?: string;
}

type Tone = "hot" | "warm" | "cool";

type Lobe = {
  ax: number; ay: number;   // centre, as a fraction of the canvas
  bx: number; by: number;   // excursion
  phase: number;
  speed: number;
  radius: number;
  alpha: number;
  tone: Tone;
};

type Mote = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
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
      hot: "183,255,60", warm: "199,119,0", cool: "123,146,255",
    };
    const LIGHT: Record<Tone, string> = {
      hot: "62,122,0", warm: "154,92,0", cool: "45,111,196",
    };

    /* Placed by hand. The composition is asymmetric on purpose: mass sits
       right and high, behind the scrubber card, clear of the headline. */
    const lobes: Lobe[] = [
      { ax: 0.30, ay: 0.34, bx: 0.22, by: 0.16, phase: 0.0, speed: 0.00044, radius: 0.62, alpha: 1.00, tone: "hot" },
      { ax: 0.70, ay: 0.30, bx: 0.19, by: 0.20, phase: 1.7, speed: 0.00034, radius: 0.55, alpha: 0.85, tone: "hot" },
      { ax: 0.82, ay: 0.52, bx: 0.16, by: 0.18, phase: 3.1, speed: 0.00028, radius: 0.48, alpha: 0.72, tone: "warm" },
      { ax: 0.18, ay: 0.62, bx: 0.20, by: 0.14, phase: 4.4, speed: 0.00039, radius: 0.44, alpha: 0.58, tone: "cool" },
      { ax: 0.52, ay: 0.22, bx: 0.26, by: 0.13, phase: 2.2, speed: 0.00024, radius: 0.50, alpha: 0.62, tone: "warm" },
      { ax: 0.44, ay: 0.66, bx: 0.24, by: 0.17, phase: 5.6, speed: 0.00031, radius: 0.40, alpha: 0.50, tone: "hot" },
    ];

    let motes: Mote[] = [];

    const spawnMote = (seed: boolean): Mote => {
      const maxLife = 8000 + Math.random() * 12000; // ms
      const r = Math.random();
      return {
        x: Math.random() * width,
        y: seed ? Math.random() * height : height + 30,
        // Rising and drifting right, slowly. These are embers, not rain.
        vx: 0.004 + Math.random() * 0.010,
        vy: -(0.012 + Math.random() * 0.020),
        life: seed ? Math.random() * maxLife : 0,
        maxLife,
        size: 1.1 + Math.random() * 2.2,
        tone: r > 0.82 ? "warm" : r > 0.96 ? "cool" : "hot",
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: 12 }, () => spawnMote(true));
    };

    resize();

    let last = 0;

    const draw = (t: number, dt: number) => {
      const c = isLight ? LIGHT : DARK;
      const min = Math.min(width, height);

      ctx.clearRect(0, 0, width, height);
      // Additive in the dark, so overlapping layers bloom where they meet.
      ctx.globalCompositeOperation = isLight ? "source-over" : "lighter";

      // ---- 1. Drifting colour lobes --------------------------------------
      for (const lobe of lobes) {
        const a = t * lobe.speed + lobe.phase;
        const x = (lobe.ax + Math.sin(a) * lobe.bx) * width;
        // 1.7 against 1.0 keeps the cycles out of phase, so the path never
        // settles into a visible figure-of-eight.
        const y = (lobe.ay + Math.cos(a * 1.7) * lobe.by) * height;
        const r = lobe.radius * min;
        const rgb = c[lobe.tone];

        // Peak alpha stays low: these sit behind body copy, and the headline
        // has to remain the brightest thing in the frame. It breathes a little
        // so the field pulses rather than merely translating.
        const breath = 0.82 + Math.sin(a * 0.9) * 0.18;
        const peak = lobe.alpha * (isLight ? 0.1 : 0.18) * breath;

        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${peak})`);
        g.addColorStop(0.45, `rgba(${rgb},${peak * 0.38})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      // ---- 2. Diagonal light sweep ---------------------------------------
      // One clear directional event, so there is always something obviously
      // in motion even when the lobes happen to be near the ends of their arcs.
      {
        const period = 11000;
        const p = ((t % period) / period) * 1.6 - 0.3; // overshoot both edges
        const cx = p * width;
        const band = width * 0.26;
        const rgb = c.hot;
        const g = ctx.createLinearGradient(cx - band, 0, cx + band, height);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(0.5, `rgba(${rgb},${isLight ? 0.035 : 0.055})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      // ---- 3. Rising motes -----------------------------------------------
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life += dt;

        if (m.life >= m.maxLife || m.y < -40 || m.x > width + 40) {
          Object.assign(m, spawnMote(false));
          continue;
        }

        const age = m.life / m.maxLife;
        const envelope = Math.sin(Math.PI * age); // fade in, hold, fade out
        const alpha = envelope * (isLight ? 0.42 : 0.72);
        if (alpha <= 0.01) continue;

        const rgb = c[m.tone];
        // A soft halo plus a bright core: reads as a light source rather than
        // a dot, without paying for shadowBlur on every draw.
        const halo = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 7);
        halo.addColorStop(0, `rgba(${rgb},${alpha * 0.5})`);
        halo.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${rgb},${alpha})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    };

    let raf = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      // Clamped: a backgrounded tab resumes with a huge gap, which would
      // teleport every mote across the frame on the first frame back.
      const dt = Math.min(48, last ? now - last : 16);
      last = now;
      if (running) draw(t, dt);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      draw(0, 16); // one settled frame, no loop
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
      last = 0; // resume cleanly rather than with a stale timestamp
    };
    document.addEventListener("visibilitychange", onVisibility);

    const themeObserver = new MutationObserver(() => {
      isLight = document.documentElement.getAttribute("data-theme") === "light";
      if (reduced) draw(0, 16);
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
