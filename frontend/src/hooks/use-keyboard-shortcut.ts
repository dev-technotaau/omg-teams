import { useEffect } from "react";

interface ShortcutOptions {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Register a global keyboard shortcut.
 * Ignores events inside input/textarea/select unless explicitly desired.
 */
export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: ShortcutOptions & { ignoreInputs?: boolean } = {},
): void {
  const { ctrl, shift, alt, meta, ignoreInputs = true } = options;

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (ctrl && !e.ctrlKey && !e.metaKey) return;
      if (shift && !e.shiftKey) return;
      if (alt && !e.altKey) return;
      if (meta && !e.metaKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      if (ignoreInputs) {
        const target = e.target as HTMLElement;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        if (target.isContentEditable) return;
      }

      e.preventDefault();
      handler(e);
    };

    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [key, handler, ctrl, shift, alt, meta, ignoreInputs]);
}
