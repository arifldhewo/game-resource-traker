"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onCheckedChange, label }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked
          ? "border-accent/60 bg-accent/20"
          : "border-line bg-[#161a1d]",
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-4 rounded-full transition-transform",
          checked
            ? "translate-x-[22px] bg-accent"
            : "translate-x-[3px] bg-muted",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
