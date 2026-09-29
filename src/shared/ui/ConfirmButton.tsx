"use client";

import { useState, type ReactNode } from "react";

interface ConfirmButtonProps {
  children: ReactNode;
  question?: string;
  onConfirm: () => Promise<unknown> | void;
  disabled?: boolean;
}

export function ConfirmButton({ children, question = "¿seguro?", onConfirm, disabled }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
      setAsking(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" className="linkbtn linkbtn--danger" onClick={() => setAsking(true)} disabled={disabled}>
        {children}
      </button>
    );
  }

  return (
    <span className="confirm">
      <span className="confirm__question">{question}</span>
      <button type="button" className="linkbtn linkbtn--danger" onClick={confirm} disabled={working || disabled}>
        {working ? "..." : "[sí]"}
      </button>
      <button type="button" className="linkbtn" onClick={() => setAsking(false)} disabled={working}>
        [no]
      </button>
    </span>
  );
}
