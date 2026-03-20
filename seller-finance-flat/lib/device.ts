/**
 * Generate and persist a unique device ID for anonymous user tracking.
 * Stored in localStorage so it persists across sessions.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem("sf_device_id");
  if (!id) {
    id = "sf_" + crypto.randomUUID();
    localStorage.setItem("sf_device_id", id);
  }
  return id;
}
