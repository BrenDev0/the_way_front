"use client";

import { useEffect, useState } from "react";

export const SCRAMBLE = "01#$%&*<>/\\|=+-_^~";

export function scramble(text: string, locked: number, seed: number) {
  return [...text]
    .map((ch, i) => (i < locked || ch === " " ? ch : SCRAMBLE[(seed * 7 + i * 13) % SCRAMBLE.length]))
    .join("");
}

export function Scramble({ text, lockEvery = 2, frameMs = 35 }: { text: string; lockEvery?: number; frameMs?: number }) {
  const [frame, setFrame] = useState(0);
  const locked = Math.floor(frame / lockEvery);
  const done = locked >= text.length;

  useEffect(() => {
    setFrame(0);
  }, [text]);

  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setFrame((f) => f + 1), frameMs);
    return () => clearTimeout(id);
  }, [frame, done, frameMs]);

  return (
    <>
      <span aria-hidden="true">{scramble(text, locked, frame)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
