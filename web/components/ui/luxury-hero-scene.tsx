"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Hero stage: canvas atmosphere + a parallaxed 3D scene, with the page's own
 * hero content composited on top.
 *
 * Unlike every previous hero background this is a WRAPPER, not a backdrop --
 * children render inside `.hero-content` above the scene, so page.tsx nests the
 * hero section within it rather than layering a canvas behind.
 *
 * One change from the supplied component: the background was a hard-coded
 * #020403 in both the canvas fill and the root element's CSS. That paints an
 * opaque black slab over the paper theme, so both now follow --bg-page, and
 * light mode gets a softened scene rather than neon-on-white.
 */

interface LuxuryHeroSceneProps {
  children?: React.ReactNode;
  className?: string;
}

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  opacity: number;
  phase: number;
  twinkleSpeed: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
};

type Ribbon = {
  y: number;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  opacity: number;
  width: number;
};

export default function LuxuryHeroScene({
  children,
  className = "",
}: LuxuryHeroSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hourglassRef = useRef<HTMLDivElement>(null);
  const cube1Ref = useRef<HTMLDivElement>(null);
  const cube2Ref = useRef<HTMLDivElement>(null);
  const cube3Ref = useRef<HTMLDivElement>(null);
  const data1Ref = useRef<HTMLDivElement>(null);
  const data2Ref = useRef<HTMLDivElement>(null);
  const data3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!root || !canvas || !scene) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let visible = true;

    // Theme-aware ground. Hard-coding the dark value here was the one thing in
    // the original that would have shipped broken.
    let isLight = document.documentElement.getAttribute("data-theme") === "light";

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const particles: Particle[] = [];
    const sparks: Spark[] = [];
    const ribbons: Ribbon[] = [];

    const random = (min: number, max: number) => min + Math.random() * (max - min);

    /* Neon reads on the void and disappears on paper, so light mode gets the
       WCAG-safe accent from DESIGN_RULES section 2 and a much lower ceiling. */
    const ink = () => (isLight ? "62,122,0" : "183,255,60");
    const groundColor = () => (isLight ? "#EDEDE8" : "#020403");
    const gain = () => (isLight ? 0.55 : 1);

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const createParticles = () => {
      particles.length = 0;
      const count = width < 768 ? 45 : 140;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: random(0.4, 2.4),
          speed: random(0.015, 0.08),
          drift: random(0.1, 0.8),
          opacity: random(0.08, 0.5),
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: random(0.001, 0.003),
        });
      }
    };

    const createRibbons = () => {
      ribbons.length = 0;
      const count = width < 768 ? 3 : 8;
      for (let i = 0; i < count; i++) {
        ribbons.push({
          y: height * 0.1 + (height * 0.8 * i) / Math.max(count - 1, 1),
          amplitude: random(30, 105),
          frequency: random(0.0016, 0.0035),
          speed: random(0.00015, 0.0005),
          phase: Math.random() * Math.PI * 2,
          opacity: random(0.055, 0.17),
          width: random(0.8, 2.2),
        });
      }
    };

    resize();
    createParticles();
    createRibbons();

    /* ---------------------------------------------------------------- */
    /* BACKGROUND                                                        */
    /* ---------------------------------------------------------------- */
    const drawBackground = (time: number) => {
      ctx.fillStyle = groundColor();
      ctx.fillRect(0, 0, width, height);

      const c = ink();
      const g = gain();
      const breathing = 1 + Math.sin(time * 0.00035) * 0.1;

      const atmosphere = ctx.createRadialGradient(
        width * 0.73, height * 0.46, 0,
        width * 0.73, height * 0.46, width * 0.58,
      );
      atmosphere.addColorStop(0, `rgba(${c},${0.085 * breathing * g})`);
      atmosphere.addColorStop(0.25, `rgba(${c},${0.035 * g})`);
      atmosphere.addColorStop(0.6, `rgba(${c},${0.012 * g})`);
      atmosphere.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atmosphere;
      ctx.fillRect(0, 0, width, height);

      const amberRgb = isLight ? "154,92,0" : "199,119,0";
      const amber = ctx.createRadialGradient(
        width * 0.84, height * 0.7, 0,
        width * 0.84, height * 0.7, width * 0.25,
      );
      amber.addColorStop(0, `rgba(${amberRgb},${0.025 * g})`);
      amber.addColorStop(1, `rgba(${amberRgb},0)`);
      ctx.fillStyle = amber;
      ctx.fillRect(0, 0, width, height);
    };

    /* ---------------------------------------------------------------- */
    /* VERTICAL LIGHT                                                    */
    /* ---------------------------------------------------------------- */
    const drawLightColumns = (time: number) => {
      const c = ink();
      const g = gain();
      const count = width < 768 ? 4 : 10;
      for (let i = 0; i < count; i++) {
        const baseX = (width / (count + 1)) * (i + 1);
        const movement = Math.sin(time * 0.0002 + i * 1.7) * 30;
        const gradient = ctx.createLinearGradient(
          baseX + movement, 0, baseX + movement, height,
        );
        gradient.addColorStop(0, `rgba(${c},0)`);
        gradient.addColorStop(0.35, `rgba(${c},${0.025 * g})`);
        gradient.addColorStop(0.5, `rgba(${c},${0.012 * g})`);
        gradient.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(baseX - 2, 0, 4, height);
      }
    };

    /* ---------------------------------------------------------------- */
    /* LIQUID RIBBONS                                                    */
    /* ---------------------------------------------------------------- */
    const drawRibbons = (time: number) => {
      const c = ink();
      const g = gain();
      const glowHex = isLight ? "#3E7A00" : "#B7FF3C";
      const midHex = isLight ? "#4C7A17" : "#709D28";

      ribbons.forEach((ribbon, index) => {
        ctx.save();
        ctx.beginPath();

        const step = 7;
        for (let x = -150; x <= width + 150; x += step) {
          const primary =
            Math.sin(x * ribbon.frequency + time * ribbon.speed + ribbon.phase) *
            ribbon.amplitude;
          const secondary = Math.sin(x * 0.0012 + time * 0.00018 + index) * 35;
          const turbulence = Math.sin(x * 0.0042 + time * 0.00045) * 9;
          const y = ribbon.y + primary + secondary + turbulence;
          if (x === -150) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        // Huge soft glow.
        ctx.shadowColor = glowHex;
        ctx.shadowBlur = 42;
        ctx.globalAlpha = ribbon.opacity * g;
        ctx.strokeStyle = `rgba(${c},0.16)`;
        ctx.lineWidth = ribbon.width * 7;
        ctx.stroke();

        // Medium glow.
        ctx.shadowBlur = 14;
        ctx.strokeStyle = midHex;
        ctx.lineWidth = ribbon.width * 2.5;
        ctx.globalAlpha = ribbon.opacity * 1.4 * g;
        ctx.stroke();

        // Sharp centre.
        ctx.shadowBlur = 0;
        ctx.strokeStyle = glowHex;
        ctx.lineWidth = ribbon.width;
        ctx.globalAlpha = ribbon.opacity * 2 * g;
        ctx.stroke();

        ctx.restore();
      });
    };

    /* ---------------------------------------------------------------- */
    /* PARTICLES                                                         */
    /* ---------------------------------------------------------------- */
    const drawParticles = (time: number) => {
      const g = gain();
      const dot = isLight ? "#4C7A17" : "#CFFF73";
      const glowHex = isLight ? "#3E7A00" : "#B7FF3C";

      particles.forEach((particle) => {
        if (!reducedMotion) {
          particle.y -= particle.speed;
          particle.x +=
            Math.sin(time * 0.0004 + particle.phase) * particle.drift * 0.1;
        }
        if (particle.y < -10) {
          particle.y = height + 10;
          particle.x = Math.random() * width;
        }

        const twinkle =
          0.65 + Math.sin(time * particle.twinkleSpeed + particle.phase) * 0.35;

        ctx.save();
        ctx.globalAlpha = particle.opacity * twinkle * g;
        ctx.fillStyle = dot;
        ctx.shadowColor = glowHex;
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    /* ---------------------------------------------------------------- */
    /* ORBITAL SYSTEM                                                    */
    /* ---------------------------------------------------------------- */
    const drawOrbitalSystem = (time: number) => {
      const c = ink();
      const g = gain();
      const glowHex = isLight ? "#3E7A00" : "#B7FF3C";
      const brightHex = isLight ? "#5C8F1F" : "#E1FFA7";

      const cx = width * 0.76;
      const cy = height * 0.47;
      const baseWidth = width < 768 ? width * 0.45 : width * 0.27;
      const baseHeight = width < 768 ? height * 0.13 : height * 0.095;

      ctx.save();
      for (let i = 0; i < 8; i++) {
        const rx = baseWidth + i * 35;
        const ry = baseHeight + i * 9;
        const rotation = time * 0.000025 * (i % 2 === 0 ? 1 : -1);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation + i * 0.09);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle =
          i === 0
            ? `rgba(${c},${0.15 * g})`
            : i % 3 === 0
              ? `rgba(${c},${0.08 * g})`
              : `rgba(${c},${0.025 * g})`;
        ctx.lineWidth = i === 0 ? 1.5 : 0.7;
        ctx.shadowColor = glowHex;
        ctx.shadowBlur = i === 0 ? 16 : 4;
        ctx.stroke();

        const angle = time * 0.00035 * (i % 2 === 0 ? 1 : -1) + i * 1.7;
        ctx.globalAlpha = g;
        ctx.fillStyle = i % 4 === 0 ? brightHex : glowHex;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * rx, Math.sin(angle) * ry, i === 0 ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      ctx.restore();
    };

    /* ---------------------------------------------------------------- */
    /* SPARKS                                                            */
    /* ---------------------------------------------------------------- */
    const spawnSpark = () => {
      if (Math.random() > 0.024) return;
      sparks.push({
        x: random(width * 0.42, width * 0.97),
        y: random(height * 0.08, height * 0.92),
        vx: random(-0.35, 0.35),
        vy: random(-0.45, 0.45),
        life: 0,
        maxLife: random(35, 100),
        size: random(1, 3),
        rotation: random(0, Math.PI),
      });
    };

    const drawSparks = () => {
      const c = ink();
      const g = gain();
      const coreHex = isLight ? "#4C7A17" : "#D8FF9A";
      const glowHex = isLight ? "#3E7A00" : "#B7FF3C";

      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.life++;
        spark.x += spark.vx;
        spark.y += spark.vy;

        const progress = spark.life / spark.maxLife;
        const alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha) * g;
        ctx.fillStyle = coreHex;
        ctx.shadowColor = glowHex;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(${c},0.75)`;
        ctx.lineWidth = 0.5;
        const flare = spark.size * 4;
        ctx.beginPath();
        ctx.moveTo(spark.x - flare, spark.y);
        ctx.lineTo(spark.x + flare, spark.y);
        ctx.moveTo(spark.x, spark.y - flare);
        ctx.lineTo(spark.x, spark.y + flare);
        ctx.stroke();
        ctx.restore();

        if (spark.life >= spark.maxLife) sparks.splice(i, 1);
      }
    };

    /* ---------------------------------------------------------------- */
    /* FLOOR GRID                                                        */
    /* ---------------------------------------------------------------- */
    const drawFloor = (time: number) => {
      const c = ink();
      const g = gain();
      const horizon = height * 0.78;

      const gradient = ctx.createLinearGradient(0, horizon, 0, height);
      gradient.addColorStop(0, `rgba(${c},${0.025 * g})`);
      gradient.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, horizon, width, height - horizon);

      ctx.save();
      ctx.strokeStyle = `rgba(${c},${0.025 * g})`;
      ctx.lineWidth = 1;

      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(width / 2, horizon);
        ctx.lineTo(width / 2 + i * 100, height);
        ctx.stroke();
      }

      for (let i = 1; i < 9; i++) {
        const progress = i / 9;
        const y = horizon + Math.pow(progress, 1.8) * (height - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const reflectionX = ((time * 0.000035) % 1) * width;
      const reflection = ctx.createLinearGradient(
        reflectionX - 180, 0, reflectionX + 180, 0,
      );
      reflection.addColorStop(0, `rgba(${c},0)`);
      reflection.addColorStop(0.5, `rgba(${c},${0.06 * g})`);
      reflection.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = reflection;
      ctx.fillRect(0, height * 0.86, width, 2);
      ctx.restore();
    };

    /* ---------------------------------------------------------------- */
    /* MAIN LOOP                                                         */
    /* ---------------------------------------------------------------- */
    const animate = (time: number) => {
      if (!visible) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }
      drawBackground(time);
      drawLightColumns(time);
      drawRibbons(time);
      drawFloor(time);
      drawOrbitalSystem(time);
      drawParticles(time);
      if (!reducedMotion) {
        spawnSpark();
        drawSparks();
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animate(0);

    /* ---------------------------------------------------------------- */
    /* GSAP MOUSE PARALLAX                                               */
    /* ---------------------------------------------------------------- */
    const handleMouseMove = (event: MouseEvent) => {
      if (reducedMotion || width < 900) return;

      const rect = root.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / rect.width - 0.5;
      const mouseY = (event.clientY - rect.top) / rect.height - 0.5;

      gsap.to(scene, {
        rotateY: mouseX * 5,
        rotateX: mouseY * -3,
        x: mouseX * -8,
        y: mouseY * -5,
        duration: 1.5,
        ease: "power3.out",
        overwrite: true,
      });

      const parallax: Array<[HTMLDivElement | null, number, number, number]> = [
        [hourglassRef.current, -24, -18, 1.5],
        [cube1Ref.current, -40, -25, 1.8],
        [cube2Ref.current, 30, -22, 2],
        [cube3Ref.current, 50, 30, 1.7],
        [data1Ref.current, 25, -20, 1.6],
        [data2Ref.current, -30, 25, 1.8],
        [data3Ref.current, 40, 15, 1.4],
      ];

      for (const [el, fx, fy, duration] of parallax) {
        if (!el) continue;
        gsap.to(el, {
          x: mouseX * fx,
          y: mouseY * fy,
          ...(el === hourglassRef.current
            ? { rotateY: mouseX * -10, rotateX: mouseY * 5 }
            : {}),
          duration,
          ease: "power3.out",
          overwrite: true,
        });
      }
    };

    const handleMouseLeave = () => {
      if (reducedMotion) return;
      gsap.to(scene, {
        rotateX: 0, rotateY: 0, x: 0, y: 0,
        duration: 1.8, ease: "power3.out",
      });
      [
        hourglassRef.current, cube1Ref.current, cube2Ref.current,
        cube3Ref.current, data1Ref.current, data2Ref.current, data3Ref.current,
      ].forEach((el) => {
        if (!el) return;
        gsap.to(el, {
          x: 0, y: 0,
          ...(el === hourglassRef.current ? { rotateX: 0, rotateY: 0 } : {}),
          duration: 1.5, ease: "power3.out",
        });
      });
    };

    root.addEventListener("mousemove", handleMouseMove);
    root.addEventListener("mouseleave", handleMouseLeave);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(root);

    const handleVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Repaint in the new palette the moment the theme flips.
    const themeObserver = new MutationObserver(() => {
      isLight = document.documentElement.getAttribute("data-theme") === "light";
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationFrame);
      root.removeEventListener("mousemove", handleMouseMove);
      root.removeEventListener("mouseleave", handleMouseLeave);
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resize);
      gsap.killTweensOf(scene);
      [
        hourglassRef.current, cube1Ref.current, cube2Ref.current,
        cube3Ref.current, data1Ref.current, data2Ref.current, data3Ref.current,
      ].forEach((el) => el && gsap.killTweensOf(el));
    };
  }, []);

  return (
    <div ref={rootRef} className={`liquid-hero ${className}`}>
      <canvas ref={canvasRef} className="liquid-canvas" aria-hidden="true" />

      <div ref={sceneRef} className="luxury-scene" aria-hidden="true">
        <div className="orbital-core">
          <div className="core-glow" />
          <div className="core-ring ring-a" />
          <div className="core-ring ring-b" />
          <div className="core-ring ring-c" />
          <div className="core-light">
            <div className="core-light-inner" />
          </div>
        </div>

        <div ref={hourglassRef} className="hourglass">
          <div className="hourglass-glow" />
          <div className="hourglass-top" />
          <div className="hourglass-body">
            <div className="glass-highlight" />
            <div className="sand-top" />
            <div className="sand-stream" />
            <div className="sand-bottom" />
            <span className="sand-particle sand-1" />
            <span className="sand-particle sand-2" />
            <span className="sand-particle sand-3" />
            <span className="sand-particle sand-4" />
          </div>
          <div className="hourglass-bottom" />
          <div className="hourglass-label">TIME DECAYS</div>
        </div>

        <div ref={cube1Ref} className="cube cube-one">
          <div className="cube-face cube-front" />
          <div className="cube-face cube-back" />
          <div className="cube-face cube-left" />
          <div className="cube-face cube-right" />
          <div className="cube-face cube-top" />
          <div className="cube-face cube-bottom" />
          <div className="cube-core" />
        </div>

        <div ref={cube2Ref} className="cube cube-two">
          <div className="cube-face cube-front" />
          <div className="cube-face cube-back" />
          <div className="cube-face cube-left" />
          <div className="cube-face cube-right" />
          <div className="cube-face cube-top" />
          <div className="cube-face cube-bottom" />
          <div className="cube-core" />
        </div>

        <div ref={cube3Ref} className="cube cube-three">
          <div className="cube-face cube-front" />
          <div className="cube-face cube-back" />
          <div className="cube-face cube-left" />
          <div className="cube-face cube-right" />
          <div className="cube-face cube-top" />
          <div className="cube-face cube-bottom" />
          <div className="cube-core" />
        </div>

        <div ref={data1Ref} className="data-panel data-one">
          <div className="data-line"><span>REMAINING</span><i /></div>
          <strong>24.8<small>DAYS</small></strong>
          <div className="data-bar"><span /></div>
          <em>TIME VALUE</em>
        </div>

        <div ref={data2Ref} className="data-panel data-two">
          <div className="data-line"><span>DECAY RATE</span><i /></div>
          <strong>-20%</strong>
          <div className="mini-bars">
            <span /><span /><span /><span /><span /><span />
          </div>
          <em>LIVE MODEL</em>
        </div>

        <div ref={data3Ref} className="data-panel data-three">
          <div className="data-line"><span>NETWORK</span><i /></div>
          <strong>ARB</strong>
          <small>SEPOLIA</small>
          <div className="network-status"><span />LIVE ON-CHAIN</div>
        </div>

        <div className="energy-trail trail-one"><span /></div>
        <div className="energy-trail trail-two"><span /></div>
        <div className="energy-trail trail-three"><span /></div>
        <div className="energy-trail trail-four"><span /></div>

        <div className="diamond diamond-one" />
        <div className="diamond diamond-two" />
        <div className="diamond diamond-three" />
        <div className="diamond diamond-four" />

        <div className="marker marker-one"><span /><i /></div>
        <div className="marker marker-two"><span /><i /></div>
      </div>

      <div className="hero-content">{children}</div>

      <style jsx>{`
        .liquid-hero {
          position: relative;
          width: 100%;
          min-height: 760px;
          overflow: hidden;
          isolation: isolate;
          /* Follows the theme rather than a hard-coded #020403, which would
             sit as a black slab on the paper theme. */
          background: var(--bg-page);
          perspective: 1600px;
        }

        .liquid-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
        }

        .luxury-scene {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          transform-style: preserve-3d;
          transform-origin: 70% 50%;
        }

        /* Neon on paper is unreadable, so light mode gets a dimmer, less
           saturated scene rather than the full glow treatment. */
        :global(html[data-theme="light"]) .luxury-scene {
          opacity: 0.5;
          filter: saturate(0.75) brightness(0.7);
        }

        .hero-content {
          position: relative;
          z-index: 30;
          min-height: 760px;
        }

        .orbital-core {
          position: absolute;
          left: 73%;
          top: 47%;
          width: 1px;
          height: 1px;
          transform-style: preserve-3d;
        }

        .core-glow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 260px;
          height: 260px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(183, 255, 60, 0.12),
            rgba(183, 255, 60, 0.035) 35%,
            transparent 72%
          );
          filter: blur(10px);
          animation: coreBreath 4s ease-in-out infinite;
        }

        .core-light {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 38px;
          height: 38px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(221, 255, 170, 0.9),
            rgba(183, 255, 60, 0.4) 30%,
            rgba(183, 255, 60, 0.05) 65%,
            transparent
          );
          box-shadow: 0 0 20px rgba(183, 255, 60, 0.45),
            0 0 70px rgba(183, 255, 60, 0.18);
          animation: corePulse 3s ease-in-out infinite;
        }

        .core-light-inner {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 7px;
          height: 7px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: #e4ffc0;
          box-shadow: 0 0 12px #b7ff3c, 0 0 25px #b7ff3c;
        }

        .core-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid rgba(183, 255, 60, 0.16);
          border-radius: 50%;
          transform-style: preserve-3d;
        }

        .ring-a {
          width: 440px; height: 150px;
          margin-left: -220px; margin-top: -75px;
          transform: rotateX(68deg);
          animation: ringSpinA 18s linear infinite;
        }

        .ring-b {
          width: 560px; height: 190px;
          margin-left: -280px; margin-top: -95px;
          transform: rotateX(68deg) rotateY(30deg);
          opacity: 0.45;
          animation: ringSpinB 25s linear infinite reverse;
        }

        .ring-c {
          width: 680px; height: 235px;
          margin-left: -340px; margin-top: -117px;
          transform: rotateX(58deg) rotateY(-25deg);
          opacity: 0.25;
          animation: ringSpinC 32s linear infinite;
        }

        @keyframes ringSpinA { from { rotate: 0deg; } to { rotate: 360deg; } }
        @keyframes ringSpinB { from { rotate: 360deg; } to { rotate: 0deg; } }
        @keyframes ringSpinC { from { rotate: 0deg; } to { rotate: -360deg; } }

        @keyframes coreBreath {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.45; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.9; }
        }

        @keyframes corePulse {
          0%, 100% { transform: translate(-50%, -50%) scale(0.8); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }

        .hourglass {
          position: absolute;
          right: 7%;
          top: 41%;
          width: 120px;
          height: 285px;
          transform-style: preserve-3d;
          animation: hourglassFloat 7s ease-in-out infinite;
        }

        .hourglass-glow {
          position: absolute;
          left: 50%; top: 50%;
          width: 180px; height: 280px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(183, 255, 60, 0.11), transparent 70%);
          filter: blur(20px);
        }

        .hourglass-body {
          position: absolute;
          left: 50%; top: 50%;
          width: 82px; height: 220px;
          transform: translate(-50%, -50%);
          clip-path: polygon(0 0, 100% 0, 62% 49%, 100% 100%, 0 100%, 38% 49%);
          border: 1px solid rgba(183, 255, 60, 0.3);
          background: linear-gradient(135deg, rgba(255,255,255,0.055), rgba(183,255,60,0.01));
          box-shadow: inset 0 0 30px rgba(183,255,60,0.05), 0 0 30px rgba(183,255,60,0.05);
        }

        .glass-highlight {
          position: absolute;
          left: 14px; top: 15px;
          width: 1px; height: 165px;
          background: linear-gradient(to bottom, rgba(255,255,255,0.2), transparent);
          transform: rotate(5deg);
        }

        .hourglass-top, .hourglass-bottom {
          position: absolute;
          left: 50%;
          width: 110px; height: 8px;
          transform: translateX(-50%);
          border-radius: 8px;
          background: linear-gradient(90deg, transparent, rgba(183,255,60,0.7), transparent);
          box-shadow: 0 0 16px rgba(183,255,60,0.25);
        }

        .hourglass-top { top: 25px; }
        .hourglass-bottom { bottom: 25px; }

        .sand-top {
          position: absolute;
          left: 50%; top: 13px;
          width: 62px; height: 58px;
          transform: translateX(-50%);
          background: linear-gradient(90deg, rgba(90,140,20,0.4), #b7ff3c, rgba(90,140,20,0.4));
          clip-path: polygon(0 0, 100% 0, 72% 100%, 28% 100%);
          filter: drop-shadow(0 0 9px rgba(183,255,60,0.45));
          animation: sandDrain 6s linear infinite;
        }

        .sand-bottom {
          position: absolute;
          left: 50%; bottom: 13px;
          width: 62px; height: 74px;
          transform: translateX(-50%);
          background: linear-gradient(90deg, rgba(90,140,20,0.4), #b7ff3c, rgba(90,140,20,0.4));
          clip-path: polygon(28% 0, 72% 0, 100% 100%, 0 100%);
          filter: drop-shadow(0 0 9px rgba(183,255,60,0.45));
          animation: sandFill 6s linear infinite;
        }

        .sand-stream {
          position: absolute;
          left: 50%; top: 73px;
          width: 2px; height: 58px;
          transform: translateX(-50%);
          background: #b7ff3c;
          box-shadow: 0 0 8px #b7ff3c, 0 0 20px rgba(183,255,60,0.5);
          animation: streamPulse 1.5s infinite;
        }

        .sand-particle {
          position: absolute;
          width: 2px; height: 2px;
          border-radius: 50%;
          background: #d9ff9d;
          box-shadow: 0 0 8px #b7ff3c;
          animation: sandFall 1.8s linear infinite;
        }

        .sand-1 { left: 47%; top: 76px; }
        .sand-2 { left: 54%; top: 88px; animation-delay: -0.5s; }
        .sand-3 { left: 44%; top: 95px; animation-delay: -1s; }
        .sand-4 { left: 56%; top: 108px; animation-delay: -1.3s; }

        .hourglass-label {
          position: absolute;
          left: 50%; bottom: 4px;
          transform: translateX(-50%);
          color: rgba(183,255,60,0.45);
          font-family: monospace;
          font-size: 7px;
          letter-spacing: 0.22em;
          white-space: nowrap;
        }

        @keyframes hourglassFloat {
          0%, 100% { transform: translateY(0) rotateZ(0deg); }
          50% { transform: translateY(-16px) rotateZ(-1deg); }
        }
        @keyframes sandDrain { from { height: 62px; } to { height: 14px; } }
        @keyframes sandFill { from { height: 18px; } to { height: 78px; } }
        @keyframes streamPulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
        @keyframes sandFall {
          0% { transform: translateY(-10px); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(55px); opacity: 0; }
        }

        .cube {
          position: absolute;
          width: 64px; height: 64px;
          transform-style: preserve-3d;
          animation: cubeFloat 8s ease-in-out infinite;
        }

        .cube-one { left: 8%; top: 23%; transform: rotateX(38deg) rotateY(48deg); }
        .cube-two {
          right: 16%; top: 15%;
          width: 50px; height: 50px;
          animation-delay: -2.5s;
          transform: rotateX(45deg) rotateY(30deg);
        }
        .cube-three {
          right: 18%; bottom: 13%;
          width: 84px; height: 84px;
          animation-delay: -4.5s;
          transform: rotateX(45deg) rotateY(-40deg);
        }

        .cube-face {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(183,255,60,0.23);
          background: linear-gradient(135deg, rgba(255,255,255,0.065), rgba(183,255,60,0.015));
          box-shadow: inset 0 0 20px rgba(183,255,60,0.035);
          backdrop-filter: blur(5px);
        }

        .cube-front { transform: translateZ(32px); }
        .cube-back { transform: rotateY(180deg) translateZ(32px); }
        .cube-left { transform: rotateY(-90deg) translateZ(32px); }
        .cube-right { transform: rotateY(90deg) translateZ(32px); }
        .cube-top { transform: rotateX(90deg) translateZ(32px); }
        .cube-bottom { transform: rotateX(-90deg) translateZ(32px); }

        .cube-core {
          position: absolute;
          left: 50%; top: 50%;
          width: 16px; height: 16px;
          transform: translate(-50%, -50%) translateZ(40px);
          border-radius: 50%;
          background: #b7ff3c;
          box-shadow: 0 0 15px #b7ff3c, 0 0 35px rgba(183,255,60,0.5);
          animation: cubePulse 2.5s ease-in-out infinite;
        }

        @keyframes cubeFloat { 0%, 100% { margin-top: 0; } 50% { margin-top: -25px; } }
        @keyframes cubePulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) translateZ(40px) scale(0.7); }
          50% { opacity: 1; transform: translate(-50%, -50%) translateZ(40px) scale(1.15); }
        }

        .data-panel {
          position: absolute;
          min-width: 125px;
          padding: 12px 14px;
          border: 1px solid rgba(183,255,60,0.13);
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(13,18,14,0.68), rgba(4,7,5,0.42));
          backdrop-filter: blur(14px);
          box-shadow: inset 0 1px rgba(255,255,255,0.045), 0 15px 40px rgba(0,0,0,0.35);
          font-family: monospace;
          transform: translateZ(50px);
        }

        .data-one { left: 47%; top: 17%; animation: dataFloatOne 6s ease-in-out infinite; }
        .data-two { right: 28%; bottom: 17%; animation: dataFloatTwo 7s ease-in-out infinite; }
        .data-three { right: 4%; top: 62%; animation: dataFloatThree 5.5s ease-in-out infinite; }

        .data-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: rgba(255,255,255,0.38);
          font-size: 6px;
          letter-spacing: 0.15em;
        }

        .data-line i {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #b7ff3c;
          box-shadow: 0 0 7px #b7ff3c;
        }

        .data-panel strong {
          display: block;
          margin-top: 7px;
          color: #f2f5ef;
          font-size: 20px;
          line-height: 1;
          letter-spacing: -0.06em;
        }

        .data-panel strong::first-letter { color: #b7ff3c; }

        .data-panel strong small {
          margin-left: 5px;
          color: rgba(183,255,60,0.55);
          font-size: 7px;
          letter-spacing: 0.1em;
        }

        .data-panel em {
          display: block;
          margin-top: 7px;
          color: rgba(255,255,255,0.25);
          font-size: 6px;
          font-style: normal;
          letter-spacing: 0.14em;
        }

        .data-bar {
          width: 100%; height: 2px;
          margin-top: 10px;
          overflow: hidden;
          border-radius: 2px;
          background: rgba(255,255,255,0.07);
        }

        .data-bar span {
          display: block;
          width: 80%; height: 100%;
          background: #b7ff3c;
          box-shadow: 0 0 7px #b7ff3c;
          animation: barPulse 3s ease-in-out infinite;
        }

        .mini-bars {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 20px;
          margin-top: 9px;
        }

        .mini-bars span { width: 5px; border-radius: 1px; background: rgba(183,255,60,0.65); }
        .mini-bars span:nth-child(1) { height: 30%; }
        .mini-bars span:nth-child(2) { height: 55%; }
        .mini-bars span:nth-child(3) { height: 45%; }
        .mini-bars span:nth-child(4) { height: 85%; }
        .mini-bars span:nth-child(5) { height: 65%; }
        .mini-bars span:nth-child(6) { height: 100%; }

        .network-status {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          color: rgba(183,255,60,0.6);
          font-size: 6px;
        }

        .network-status span {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #b7ff3c;
          box-shadow: 0 0 7px #b7ff3c;
          animation: statusBlink 1.8s infinite;
        }

        @keyframes dataFloatOne {
          0%, 100% { transform: translateZ(50px) translateY(0); }
          50% { transform: translateZ(75px) translateY(-10px); }
        }
        @keyframes dataFloatTwo {
          0%, 100% { transform: translateZ(50px) translateY(0); }
          50% { transform: translateZ(70px) translateY(10px); }
        }
        @keyframes dataFloatThree {
          0%, 100% { transform: translateZ(50px) translateY(0); }
          50% { transform: translateZ(85px) translateY(-7px); }
        }
        @keyframes barPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes statusBlink { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }

        .energy-trail {
          position: absolute;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(183,255,60,0.45), transparent);
          transform-origin: left center;
        }

        .energy-trail span {
          position: absolute;
          left: -5px; top: -2px;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #b7ff3c;
          box-shadow: 0 0 10px #b7ff3c, 0 0 25px rgba(183,255,60,0.6);
          animation: energyTravel 3s linear infinite;
        }

        .trail-one { left: 5%; top: 39%; width: 34%; transform: rotate(-8deg); }
        .trail-two { left: 37%; top: 66%; width: 28%; transform: rotate(-16deg); opacity: 0.55; }
        .trail-three { right: 3%; top: 33%; width: 26%; transform: rotate(13deg); opacity: 0.45; }
        .trail-four { left: 45%; top: 25%; width: 22%; transform: rotate(12deg); opacity: 0.3; }

        @keyframes energyTravel { from { left: -5%; } to { left: 105%; } }

        .diamond {
          position: absolute;
          width: 13px; height: 13px;
          border: 1px solid rgba(183,255,60,0.32);
          background: rgba(183,255,60,0.025);
          transform: rotate(45deg);
          box-shadow: 0 0 15px rgba(183,255,60,0.08);
          animation: diamondFloat 6s ease-in-out infinite;
        }

        .diamond-one { left: 27%; top: 18%; }
        .diamond-two { left: 39%; bottom: 22%; width: 8px; height: 8px; animation-delay: -2s; }
        .diamond-three { right: 31%; top: 27%; width: 10px; height: 10px; animation-delay: -3s; }
        .diamond-four { right: 8%; bottom: 28%; width: 17px; height: 17px; animation-delay: -4s; }

        @keyframes diamondFloat {
          0%, 100% { transform: translateY(0) rotate(45deg); opacity: 0.3; }
          50% { transform: translateY(-18px) rotate(65deg); opacity: 0.85; }
        }

        .marker { position: absolute; width: 22px; height: 22px; opacity: 0.35; }
        .marker span, .marker i { position: absolute; background: #b7ff3c; }
        .marker span { left: 50%; top: 0; width: 1px; height: 100%; }
        .marker i { left: 0; top: 50%; width: 100%; height: 1px; }
        .marker-one { left: 43%; top: 28%; }
        .marker-two { right: 24%; bottom: 25%; transform: scale(0.7); }

        @media (max-width: 1200px) {
          .hourglass { right: 1%; transform: scale(0.8); }
          .data-three { right: 1%; }
          .orbital-core { left: 75%; }
        }

        @media (max-width: 900px) {
          .luxury-scene { opacity: 0.68; }
          .orbital-core { left: 73%; top: 52%; transform: scale(0.75); }
          .hourglass { right: -4%; transform: scale(0.65); }
          .data-panel { display: none; }
          .energy-trail { opacity: 0.35; }
        }

        @media (max-width: 768px) {
          .liquid-hero { min-height: 720px; }
          .hero-content { min-height: 720px; }
          .luxury-scene { opacity: 0.5; }
          .orbital-core { left: 72%; top: 52%; transform: scale(0.58); }
          .hourglass { right: -13%; top: 48%; transform: scale(0.5); }
          .cube-one { left: -5%; }
          .cube-two { right: 2%; }
          .cube-three { right: -7%; }
          .diamond { opacity: 0.5; }
        }

        @media (prefers-reduced-motion: reduce) {
          .core-glow, .core-light, .core-ring, .hourglass, .sand-top,
          .sand-bottom, .sand-stream, .sand-particle, .cube, .cube-core,
          .data-panel, .energy-trail span, .diamond, .data-bar span {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
