/**
 * Persistent device fingerprint for device binding.
 * Stored in localStorage — persists across sessions.
 * Spec Section 22
 */

const DEVICE_ID_KEY = "omg_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function generateDeviceId(): string {
  // Combine crypto random with browser fingerprint signals
  const random = crypto.randomUUID();
  const ua = navigator.userAgent;
  const lang = navigator.language;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Hash the fingerprint components into a stable ID
  const raw = `${random}-${ua}-${lang}-${screen}-${tz}`;
  return btoa(raw)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 48);
}
