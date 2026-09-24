"use client";

import { useId } from "react";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: SegmentedProps<T>) {
  const id = useId();

  return (
    <div className="field">
      <span className="field__label" id={id}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              className={checked ? "segmented__option segmented__option--checked" : "segmented__option"}
              onClick={() => onChange(option.value)}
              disabled={disabled}
            >
              [{checked ? "x" : " "}] {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
