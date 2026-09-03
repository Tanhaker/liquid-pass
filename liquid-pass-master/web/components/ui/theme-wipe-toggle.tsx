"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

type HorizontalThemeWipeToggleProps = {
  className?: string;
  direction?: "left" | "right";
};

export const HorizontalThemeWipeToggle = ({
  className,
}: HorizontalThemeWipeToggleProps) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const isTransitioningRef = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const syncTheme = () => {
      const themeAttr = document.documentElement.getAttribute("data-theme");
      const isDark = themeAttr === "dark" || (!themeAttr && true);
      setDarkMode(isDark);
    };
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  const onToggle = useCallback(async () => {
    if (isTransitioningRef.current || typeof document === "undefined") return;

    const nextDark = !darkMode;

    const updateDOM = () => {
      setDarkMode(nextDark);
      document.documentElement.setAttribute("data-theme", nextDark ? "dark" : "light");
      if (nextDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", nextDark ? "dark" : "light");
    };

    // Fallback if browser does not support View Transitions API
    if (!(document as any).startViewTransition) {
      updateDOM();
      return;
    }

    isTransitioningRef.current = true;

    try {
      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          updateDOM();
        });
      });

      await transition.ready;

      // When switching to light mode: right-to-left wipe.
      // When switching back to dark mode: left-to-right wipe.
      const clipKeyframes = !nextDark
        ? ["inset(0 0 0 100%)", "inset(0 0 0 0)"] // right-to-left
        : ["inset(0 100% 0 0)", "inset(0 0 0 0)"]; // left-to-right

      const animation = document.documentElement.animate(
        {
          clipPath: clipKeyframes,
        },
        {
          duration: 850,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );

      await animation.finished;
    } catch (e) {
      updateDOM();
    } finally {
      isTransitioningRef.current = false;
    }
  }, [darkMode]);

  if (!mounted) {
    return (
      <div className={cn("w-8 h-8 flex items-center justify-center p-2", className)}>
        <Sun className="w-4 h-4 text-uranium opacity-50" />
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      aria-label="Switch theme"
      className={cn(
        "flex items-center justify-center p-2 rounded-none outline-none focus:outline-none active:outline-none cursor-pointer hover:bg-dark-surface transition-colors",
        className,
      )}
      type="button"
    >
      <AnimatePresence mode="wait" initial={false}>
        {darkMode ? (
          <motion.span
            key="sun-icon"
            initial={{ opacity: 0, scale: 0.6, rotate: 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            className="text-uranium flex items-center justify-center"
            title="Switch to Light Mode"
          >
            <Sun className="w-4 h-4" />
          </motion.span>
        ) : (
          <motion.span
            key="moon-icon"
            initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            className="text-aviation flex items-center justify-center"
            title="Switch to Dark Mode"
          >
            <Moon className="w-4 h-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};
