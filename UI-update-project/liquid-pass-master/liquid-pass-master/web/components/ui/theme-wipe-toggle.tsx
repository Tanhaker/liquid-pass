"use client";

import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [wiping, setWiping] = useState<"to-light" | "to-dark" | null>(null);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark" || (!savedTheme && true);
    
    setDarkMode(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const onToggle = useCallback(() => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    setWiping(nextDark ? "to-dark" : "to-light");

    // Apply theme attributes to root element
    document.documentElement.setAttribute("data-theme", nextDark ? "dark" : "light");
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", nextDark ? "dark" : "light");

    // Clear wipe transition after animation finishes
    setTimeout(() => {
      setWiping(null);
    }, 550);
  }, [darkMode]);

  if (!mounted) {
    return (
      <div className={cn("w-8 h-8 flex items-center justify-center p-2", className)}>
        <Sun className="w-4 h-4 text-uranium opacity-50" />
      </div>
    );
  }

  return (
    <>
      {/* Full-viewport wipe overlay (right-to-left for light, left-to-right for dark) */}
      <AnimatePresence>
        {wiping && (
          <motion.div
            key={wiping}
            initial={{
              clipPath:
                wiping === "to-light"
                  ? "inset(0 0 0 100%)" // right edge start
                  : "inset(0 100% 0 0)", // left edge start
            }}
            animate={{
              clipPath: "inset(0 0 0 0)", // full sweep
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              backgroundColor: wiping === "to-light" ? "#EDEDE8" : "#08090C",
            }}
            className="fixed inset-0 pointer-events-none z-[99999] opacity-35"
          />
        )}
      </AnimatePresence>

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
    </>
  );
};
