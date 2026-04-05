import { env } from "./env.js";
import { registerService } from "./service-init.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  VirusTotal — Service Registration
//
//  Validates API key on startup by fetching the
//  user account quota (lightweight endpoint).
//  The actual scanning happens in upload middleware.
// ──────────────────────────────────────────────

const VT_API_BASE = "https://www.virustotal.com/api/v3";

registerService({
  name: "virustotal",
  critical: false,
  isConfigured: () => env.hasVirusTotal,
  connect: async () => {
    // Verify API key by fetching account info (lightweight check)
    const response = await fetch(`${VT_API_BASE}/users/current`, {
      headers: { "x-apikey": env.VIRUSTOTAL_API_KEY },
    });
    if (!response.ok) {
      throw new Error(`VirusTotal API key validation failed (${response.status})`);
    }
    const data = (await response.json()) as { data?: { attributes?: { quotas?: unknown } } };
    logger.info("VirusTotal API key verified", {
      quotas: data.data?.attributes?.quotas ? "available" : "unknown",
    });
  },
  disconnect: async () => {
    // Stateless — no cleanup needed
  },
});
