import { useState, useCallback } from "react";
import { copyToClipboard } from "@/utils/clipboard";

/**
 * Copy text to clipboard with a "copied" state that auto-resets.
 */
export function useCopyToClipboard(resetMs = 2000): {
  copied: boolean;
  copy: (text: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      }
    },
    [resetMs],
  );

  return { copied, copy };
}
