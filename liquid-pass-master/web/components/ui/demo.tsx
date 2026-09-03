import { HorizontalThemeWipeToggle } from "@/components/ui/theme-wipe-toggle";

export default function ThemeSwitchDemo() {
  return (
    <div className="flex flex-col gap-4 items-center p-6 bg-dark-card border border-dark-border">
      <HorizontalThemeWipeToggle direction="left" />
      <span className="text-xs font-mono text-zincGrey">Left → Right</span>
      <HorizontalThemeWipeToggle direction="right" />
      <span className="text-xs font-mono text-zincGrey">Right → Left</span>
    </div>
  );
}
