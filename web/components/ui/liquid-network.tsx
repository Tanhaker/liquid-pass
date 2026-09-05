"use client";

import { useEffect, useRef } from "react";

interface LiquidNetworkProps {
  className?: string;
}

interface Stream {
  points: { x: number; y: number }[];
  speed: number;
  offset: number;
  width: number;
  opacity: number;
  color: string;
}

interface Pulse {
  stream: number;
  progress: number;
  speed: number;
  size: number;
}

/**
 * Hero background: value flowing through the protocol.
 *
 * Not a particle field -- the streams are meant to read as time and value
 * moving along a circuit, with pulses travelling the paths.
 *
 * Theme handling is the one place this departs from a plain canvas effect.
 * Painting an opaque background would cover the page in light mode, so the
 * canvas only paints its own ground in dark mode; on the paper theme it stays
 * transparent and the page shows through, with the palette swapped to the
 * WCAG-compliant accents from DESIGN_RULES section 2.
 */
export default function LiquidNetwork({ className = "" }: LiquidNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    let visible = true;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let isLight = document.documentElement.getAttribute("data-theme") === "light";

    let streams: Stream[] = [];
    let pulses: Pulse[] = [];

    /** Locked palette. Neon reads on the void; it disappears on paper. */
    const palette = () =>
      isLight
        ? { hot: "#3E7A00", cool: "#5C8F1F", amber: "#9A5C00", line: "0,0,0", glow: 12 }
        : { hot: "#B7FF3C", cool: "#75B82A", amber: "#C77700", line: "183,255,60", glow: 18 };

    /*
     * Organic circuit-like path. These represent time and value flowing
     * through the system rather than random drift.
     */
    const createStream = (
      startX: number,
      baseY: number,
      direction: number,
      color: string,
      opacity: number,
    ): Stream => {
      const points: { x: number; y: number }[] = [];
      const segments = 14;

      for (let i = 0; i <= segments; i++) {
        const progress = i / segments;
        const x =
          startX +
          direction * (progress * width * 0.7 + Math.sin(progress * Math.PI * 3) * 45);
        const y =
          baseY +
          Math.sin(progress * Math.PI * 2.2) * 65 +
          Math.sin(progress * Math.PI * 5) * 20;
        points.push({ x, y });
      }

      return {
        points,
        speed: 0.00008 + Math.random() * 0.00004,
        offset: Math.random(),
        width: 1 + Math.random() * 1.2,
        opacity,
        color,
      };
    };

    /*
     * Streams are derived from the canvas size, so they are rebuilt whenever it
     * changes. Building them once left the geometry stale after any resize --
     * the paths ran off the edge or bunched into the middle.
     */
    const buildScene = () => {
      const p = palette();
      streams = [
        createStream(-width * 0.25, height * 0.42, 1, p.hot, isLight ? 0.5 : 0.35),
        createStream(-width * 0.3, height * 0.58, 1, p.cool, isLight ? 0.32 : 0.2),
        createStream(width * 0.25, height * 0.3, 1, p.hot, isLight ? 0.34 : 0.22),
        createStream(width * 0.1, height * 0.72, 1, p.amber, isLight ? 0.28 : 0.15),
      ];

      if (pulses.length === 0) {
        for (let i = 0; i < 16; i++) {
          pulses.push({
            stream: Math.floor(Math.random() * streams.length),
            progress: Math.random(),
            speed: 0.00015 + Math.random() * 0.00015,
            size: 1.5 + Math.random() * 2,
          });
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildScene();
    };

    resize();

    /*
     * Dark mode paints its own void. Light mode must not -- an opaque fill here
     * would drop a black slab over the paper background, so the canvas is
     * simply cleared and the page shows through.
     */
    const drawBackground = () => {
      ctx.clearRect(0, 0, width, height);
      if (isLight) return;

      const gradient = ctx.createRadialGradient(
        width * 0.58,
        height * 0.45,
        0,
        width * 0.58,
        height * 0.45,
        width * 0.75,
      );
      gradient.addColorStop(0, "#0B120D");
      gradient.addColorStop(0.45, "#070A08");
      gradient.addColorStop(1, "#030504");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    };

    /** Faint perspective architecture behind the streams. */
    const drawArchitecture = (time: number) => {
      const p = palette();
      ctx.save();
      ctx.strokeStyle = `rgba(${p.line},${isLight ? 0.05 : 0.035})`;
      ctx.lineWidth = 1;

      const horizon = height * 0.54;

      for (let i = 0; i < 9; i++) {
        const progress = i / 9;
        const y = horizon + Math.pow(progress, 1.8) * height * 0.48;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      for (let i = -12; i <= 12; i++) {
        const x = width / 2 + i * 100;
        ctx.beginPath();
        ctx.moveTo(width / 2, horizon);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Slow highlight sweeping across the grid. Static under reduced motion.
      const sweep = prefersReducedMotion
        ? width * 0.5
        : ((time * 0.00002) % 1) * width * 1.4 - width * 0.2;

      const glow = ctx.createLinearGradient(sweep - 120, 0, sweep + 120, 0);
      glow.addColorStop(0, `rgba(${p.line},0)`);
      glow.addColorStop(0.5, `rgba(${p.line},0.035)`);
      glow.addColorStop(1, `rgba(${p.line},0)`);

      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    };

    const drawStream = (stream: Stream) => {
      if (stream.points.length < 2) return;
      const p = palette();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(stream.points[0].x, stream.points[0].y);

      for (let i = 1; i < stream.points.length; i++) {
        const previous = stream.points[i - 1];
        const current = stream.points[i];
        const controlX = (previous.x + current.x) / 2;
        ctx.quadraticCurveTo(controlX, previous.y, current.x, current.y);
      }

      // Glow layer
      ctx.shadowColor = stream.color;
      ctx.shadowBlur = p.glow;
      ctx.strokeStyle = stream.color;
      ctx.globalAlpha = stream.opacity * 0.3;
      ctx.lineWidth = stream.width * 5;
      ctx.stroke();

      // Main line
      ctx.shadowBlur = 0;
      ctx.globalAlpha = stream.opacity;
      ctx.lineWidth = stream.width;
      ctx.stroke();
      ctx.restore();
    };

    const getPointOnStream = (stream: Stream, progress: number) => {
      const points = stream.points;
      const scaled = progress * (points.length - 1);
      const index = Math.floor(scaled);
      const next = Math.min(index + 1, points.length - 1);
      const amount = scaled - index;
      const a = points[index];
      const b = points[next];
      return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
    };

    const drawPulse = (pulse: Pulse, time: number) => {
      const stream = streams[pulse.stream];
      if (!stream) return;

      pulse.progress += pulse.speed;
      if (pulse.progress > 1) {
        pulse.progress = 0;
        pulse.stream = Math.floor(Math.random() * streams.length);
      }

      const point = getPointOnStream(stream, pulse.progress);
      const breathing = 0.7 + Math.sin(time * 0.004 + pulse.progress * 10) * 0.3;

      ctx.save();
      ctx.globalAlpha = breathing;
      ctx.shadowColor = stream.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = stream.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, pulse.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawNodes = (time: number) => {
      const p = palette();
      const nodes = [
        { x: width * 0.12, y: height * 0.32 },
        { x: width * 0.24, y: height * 0.68 },
        { x: width * 0.77, y: height * 0.27 },
        { x: width * 0.9, y: height * 0.55 },
        { x: width * 0.68, y: height * 0.78 },
      ];

      nodes.forEach((node, index) => {
        const pulse = prefersReducedMotion
          ? 0.5
          : 0.5 + Math.sin(time * 0.0015 + index) * 0.2;

        ctx.save();
        ctx.globalAlpha = pulse * 0.5;
        ctx.shadowColor = p.hot;
        ctx.shadowBlur = 15;
        ctx.fillStyle = p.hot;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawFrame = (time: number) => {
      const p = palette();

      drawBackground();
      drawArchitecture(time);
      streams.forEach(drawStream);
      drawNodes(time);

      if (!prefersReducedMotion) {
        pulses.forEach((pulse) => drawPulse(pulse, time));
      }

      // Soft atmospheric bloom over the whole field.
      const atmosphere = ctx.createRadialGradient(
        width * 0.72,
        height * 0.48,
        0,
        width * 0.72,
        height * 0.48,
        width * 0.4,
      );
      atmosphere.addColorStop(0, `rgba(${p.line},${isLight ? 0.03 : 0.055})`);
      atmosphere.addColorStop(0.5, `rgba(${p.line},0.018)`);
      atmosphere.addColorStop(1, `rgba(${p.line},0)`);

      ctx.fillStyle = atmosphere;
      ctx.fillRect(0, 0, width, height);
    };

    const render = (time: number) => {
      if (visible) drawFrame(time);
      animationFrame = requestAnimationFrame(render);
    };

    // Pause while off-screen or backgrounded, so an unseen hero costs nothing.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0.01 },
    );
    observer.observe(canvas);

    // Named, so it can actually be removed on unmount. An anonymous listener
    // here leaks a closure over the canvas on every remount.
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Repaint in the new palette the moment the theme attribute flips.
    const themeObserver = new MutationObserver(() => {
      const next = document.documentElement.getAttribute("data-theme") === "light";
      if (next !== isLight) {
        isLight = next;
        buildScene();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", resize);

    if (prefersReducedMotion) {
      // One static frame, no loop.
      drawFrame(0);
    } else {
      render(0);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
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
