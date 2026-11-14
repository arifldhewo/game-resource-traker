"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  id,
  className,
  disabled,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  function commit(raw: string, force: boolean) {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) {
      if (force) setText(String(value));
      return;
    }
    let next = parsed;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onChange(next);
    if (force) setText(String(next));
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-prts border border-line bg-inset focus-within:border-accent/60",
        disabled && "opacity-50",
        className,
      )}
    >
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={text}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value, false);
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value, true);
        }}
        className="w-full min-w-0 bg-transparent px-2.5 py-2 text-[14.5px] text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {unit && (
        <span className="shrink-0 pr-2.5 font-mono text-[9px] tracking-[0.1em] text-muted-2">
          {unit}
        </span>
      )}
    </div>
  );
}
