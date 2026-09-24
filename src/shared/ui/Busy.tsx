"use client";

import { useEffect, useState } from "react";
import { scramble } from "./Scramble";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SHADES = ["█", "▓", "▒", "░"];
const FRAME_MS = 80;
const LOCK_FRAMES = 3;
const WORD_FRAMES = 50;
const TRAIL = 10;

export function Busy({ words }: { words: string[] }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  const width = Math.max(...words.map((w) => w.length));
  const word = words[Math.floor(frame / WORD_FRAMES) % words.length].padEnd(width, " ");
  const locked = Math.floor((frame % WORD_FRAMES) / LOCK_FRAMES);
  const head = frame % TRAIL;

  return (
    <span className="busy" role="status" aria-label={words[0]}>
      <span className="busy__spinner" aria-hidden="true">
        {SPINNER[frame % SPINNER.length]}
      </span>
      <span className="busy__word" aria-hidden="true">
        {scramble(word, locked, frame)}
      </span>
      <span aria-hidden="true">
        {Array.from({ length: TRAIL }, (_, i) => {
          const shade = i <= head ? Math.min(head - i, SHADES.length - 1) : SHADES.length - 1;
          return (
            <span key={i} className={`shade-${shade}`}>
              {SHADES[shade]}
            </span>
          );
        })}
      </span>
    </span>
  );
}
