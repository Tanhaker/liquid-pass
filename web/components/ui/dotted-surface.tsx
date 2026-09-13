"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface DottedSurfaceProps {
  size?: number;
  opacity?: number;
  className?: string;
}

export default function DottedSurface({
  size = 7,
  opacity = 0.8,
  className = "",
}: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;
    let isVisible = true;
    let animationFrameId: number;

    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Scene setup
    const scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 700;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 4000);
    camera.position.set(0, 320, 880);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      container.appendChild(renderer.domElement);
    } catch (e) {
      console.warn("WebGL not supported, falling back to clean CSS gradient", e);
      return;
    }

    // Grid Dimensions
    const isMobile = width < 768;
    const cols = isMobile ? 45 : 75;
    const rows = isMobile ? 30 : 50;
    const numPoints = cols * rows;
    const spacing = 48;

    const positions = new Float32Array(numPoints * 3);
    const initialY = new Float32Array(numPoints);

    let i = 0;
    for (let ix = 0; ix < cols; ix++) {
      for (let iy = 0; iy < rows; iy++) {
        const x = ix * spacing - (cols * spacing) / 2;
        const z = iy * spacing - (rows * spacing) / 2;
        const y = 0;

        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;
        initialY[i / 3] = y;
        i += 3;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );

    // Create a circular point texture for smooth dots
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    const dotTexture = new THREE.CanvasTexture(canvas);

    // Theme Configuration with Amber #C77700 in both themes
    const getThemeConfig = () => {
      const isLight =
        document.documentElement.getAttribute("data-theme") === "light";
      return {
        color: new THREE.Color("#C77700"),
        blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
        opacity: isLight ? opacity * 0.75 : opacity,
      };
    };

    const initialTheme = getThemeConfig();

    const material = new THREE.PointsMaterial({
      size: size,
      map: dotTexture,
      transparent: true,
      opacity: initialTheme.opacity,
      color: initialTheme.color,
      blending: initialTheme.blending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Listen for data-theme changes on html
    const syncTheme = () => {
      if (isDisposed) return;
      const theme = getThemeConfig();
      material.color = theme.color;
      material.blending = theme.blending;
      material.opacity = theme.opacity;
      material.needsUpdate = true;
    };

    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // Animation Loop
    let count = 0;
    const animate = () => {
      if (isDisposed) return;

      if (isVisible && !prefersReducedMotion) {
        count += 0.035;

        const pos = geometry.attributes.position.array as Float32Array;
        let index = 0;

        for (let ix = 0; ix < cols; ix++) {
          for (let iy = 0; iy < rows; iy++) {
            const yIndex = index * 3 + 1;
            // Compound smooth sine waves
            pos[yIndex] =
              Math.sin((ix + count) * 0.3) * 35 +
              Math.sin((iy + count) * 0.4) * 35 +
              Math.cos((ix + iy + count) * 0.2) * 15;
            index++;
          }
        }

        geometry.attributes.position.needsUpdate = true;
      }

      if (renderer && isVisible) {
        renderer.render(scene, camera);
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    // If reduced motion is requested, render one single static frame
    if (prefersReducedMotion) {
      if (renderer) renderer.render(scene, camera);
    } else {
      animate();
    }

    // Visibility & Intersection Observers to eliminate background CPU load
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(container);

    // Window resize handler
    const handleResize = () => {
      if (!container || !renderer || isDisposed) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener("resize", handleResize);

    // Cleanup & Teardown
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      themeObserver.disconnect();
      intersectionObserver.disconnect();

      geometry.dispose();
      dotTexture.dispose();
      material.dispose();

      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [size, opacity]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ touchAction: "none" }}
    />
  );
}
