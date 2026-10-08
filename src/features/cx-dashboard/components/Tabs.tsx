"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabSpec<T extends string> {
  id: T;
  label: string;
  /** a count that needs someone: shown beside the label */
  badge?: number | null;
}

/** The tab in the address (#ventas), so a link or a reload opens the same one. */
export function useTabFromHash<T extends string>(ids: readonly T[], fallback: T) {
  const [tab, setTab] = useState<T>(fallback);

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, "") as T;
      if (ids.includes(hash)) setTab(hash);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [ids]);

  function choose(next: T) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  return [tab, choose] as const;
}

/** A horizontal row of tabs, keyboard-driven the standard way: arrows move, Home and End
 *  jump, and only the chosen tab is in the tab order. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  children,
}: {
  label: string;
  tabs: TabSpec<T>[];
  value: T;
  onChange: (tab: T) => void;
  children: ReactNode;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const target = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (target === null) return;
    e.preventDefault();
    const next = tabs[target].id;
    onChange(next);
    refs.current.get(next)?.focus();
  }

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) refs.current.set(tab.id, node);
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? "tabs__tab tabs__tab--selected" : "tabs__tab"}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              {tab.label}
              {tab.badge ? <span className="tabs__badge">{tab.badge > 99 ? "99+" : tab.badge}</span> : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} tabIndex={0} className="tabs__panel">
        {children}
      </div>
    </div>
  );
}
