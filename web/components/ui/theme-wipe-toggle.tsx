"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Theme switch with a CSS View Transitions wipe.
 *
 * The team's original drove `document.documentElement.classList` and
 * `localStorage` directly. This app already has next-themes mounted in
 * providers.tsx, and two things writing the same class attribute is how you
 * get a theme that flips back on the next render -- so the wipe is kept and
 * the state is handed to next-themes.
 *
 * `startViewTransition` needs the DOM mutation to happen synchronously inside
 * its callback, hence flushSync. Browsers without it (Firefox, Safari < 18)
 * fall through to a plain, instant switch.
 */
type HorizontalThemeWipeToggleProps = {
  className?: string;
  direction?: "left" | "right";
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

export const HorizontalThemeWipeToggle = ({
  className,
  direction = "left",
}: HorizontalThemeWipeToggleProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Rendering the icon before mount would ship the server's guess at the
  // theme into the HTML and mismatch on hydration.
  useEffect(() => setMounted(true), []);

  const darkMode = resolvedTheme !== "light";

  const onToggle = useCallback(async () => {
    const next = darkMode ? "light" : "dark";
    const doc = document as ViewTransitionDocument;

    if (!doc.startViewTransition) {
      setTheme(next);
      return;
    }

    try {
      const transition = doc.startViewTransition(() => {
        flushSync(() => setTheme(next));
      });
      await transition.ready;

      document.documentElement.animate(
        {
          clipPath:
            direction === "left"
              ? ["inset(0 100% 0 0)", "inset(0 0 0 0)"]
              : ["inset(0 0 0 100%)", "inset(0 0 0 0)"],
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    } catch {
      setTheme(next);
    }
  }, [darkMode, direction, setTheme]);

  if (!mounted) {
    return (
      <div className={cn("flex size-8 items-center justify-center p-2", className)}>
        <Sun className="size-4 text-uranium opacity-50" />
      </div>
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={onToggle}
      aria-label="Switch theme"
      type="button"
      className={cn(
        "flex cursor-pointer items-center justify-center p-2 outline-none transition-colors hover:bg-dark-surface focus:outline-none active:outline-none",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {darkMode ? (
          <motion.span
            key="sun-icon"
            initial={{ opacity: 0, scale: 0.6, rotate: 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center text-uranium"
          >
            <Sun className="size-4" />
          </motion.span>
        ) : (
          <motion.span
            key="moon-icon"
            initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center text-aviation"
          >
            <Moon className="size-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};
