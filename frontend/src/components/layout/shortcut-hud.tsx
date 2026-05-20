"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderBinding } from "@/hooks/use-leader-key";

// ─────────────────────────────────────────────────────────────
//  ShortcutHud — visual feedback for the leader-key system
//
//  Two surfaces:
//   1. WaitingHint: a small floating chip that appears when the
//      user presses the leader key (e.g. "G — press the next
//      key…"). Auto-dismisses when the leader resolves or times
//      out.
//   2. HelpDialog: opens on `?` — full list of all currently-
//      registered bindings so the user can discover what's
//      available. Press Esc or `?` again to close.
// ─────────────────────────────────────────────────────────────

interface ShortcutHudProps {
  /** From useLeaderKey — true while the leader window is open. */
  isWaiting: boolean;
  /** Single label for what leader is bound to (default "G"). */
  leaderLabel?: string;
  /** All currently-registered bindings for the ? help dialog. */
  bindings: LeaderBinding[];
}

const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
function isTypingInto(el: Element | null): boolean {
  if (!el) return false;
  if (TEXT_INPUT_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function ShortcutHud({ isWaiting, leaderLabel = "G", bindings }: ShortcutHudProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Global `?` toggles the help dialog. Esc closes it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?" && !isTypingInto(document.activeElement)) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      } else if (e.key === "Escape" && showHelp) {
        e.preventDefault();
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHelp]);

  if (typeof document === "undefined") return null;

  return (
    <>
      {isWaiting &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
              "animate-fade-in border-border-default bg-bg-surface-raised",
              "flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-lg",
            )}
          >
            <kbd className="border-border-default bg-bg-muted text-text-primary rounded-sm border px-1.5 py-0.5 font-mono text-xs">
              {leaderLabel}
            </kbd>
            <span className="text-text-muted text-xs">press next key…</span>
          </div>,
          document.body,
        )}

      {showHelp &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            className="fixed inset-0 z-100 flex items-start justify-center pt-[10vh]"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
              aria-hidden="true"
              onClick={() => setShowHelp(false)}
            />
            <div className="animate-fade-in border-border-default bg-bg-surface-raised relative z-10 w-full max-w-md overflow-hidden rounded-lg border shadow-2xl">
              <div className="border-border-default flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Keyboard size={18} className="text-text-muted" />
                  <h2 className="text-text-primary text-sm font-medium">Keyboard shortcuts</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  aria-label="Close shortcuts"
                  className="text-text-muted hover:bg-bg-hover hover:text-text-primary rounded-md p-1 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4">
                <p className="text-text-muted mb-3 text-xs">
                  Press the leader key first, then the second key:
                </p>
                {bindings.length === 0 ? (
                  <p className="text-text-muted py-4 text-center text-sm italic">
                    No shortcuts registered.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {bindings.map((b) => (
                      <li
                        key={`${b.key}-${b.label}`}
                        className="hover:bg-bg-hover flex items-center justify-between rounded-md px-2 py-1.5"
                      >
                        <span className="text-text-secondary text-sm">{b.label}</span>
                        <span className="flex items-center gap-1">
                          <kbd className="border-border-default bg-bg-muted text-text-muted rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                            {leaderLabel}
                          </kbd>
                          <kbd className="border-border-default bg-bg-muted text-text-muted rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                            {b.key.toUpperCase()}
                          </kbd>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-border-default mt-4 border-t pt-3">
                  <p className="text-text-muted mb-2 text-xs">Always available:</p>
                  <ul className="space-y-1">
                    <li className="flex items-center justify-between rounded-md px-2 py-1.5">
                      <span className="text-text-secondary text-sm">Command palette</span>
                      <span className="flex items-center gap-1">
                        <kbd className="border-border-default bg-bg-muted text-text-muted rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                          ⌘
                        </kbd>
                        <kbd className="border-border-default bg-bg-muted text-text-muted rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                          K
                        </kbd>
                      </span>
                    </li>
                    <li className="flex items-center justify-between rounded-md px-2 py-1.5">
                      <span className="text-text-secondary text-sm">Show this dialog</span>
                      <kbd className="border-border-default bg-bg-muted text-text-muted rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                        ?
                      </kbd>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
