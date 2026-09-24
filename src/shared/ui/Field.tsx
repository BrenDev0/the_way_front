"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  revealable?: boolean;
}

export function Field({ label, hint, revealable, type = "text", className, ...props }: FieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable ? (revealed ? "text" : "password") : type;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__row">
        <span className="field__prompt" aria-hidden="true">
          ❯
        </span>
        <input
          id={id}
          type={inputType}
          className={className ? `field__input ${className}` : "field__input"}
          spellCheck={false}
          autoCapitalize="none"
          {...props}
        />
        {revealable && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {revealed ? "[ocultar]" : "[ver]"}
          </button>
        )}
      </div>
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}
