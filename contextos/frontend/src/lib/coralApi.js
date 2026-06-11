export const CORAL_API_BASE = import.meta.env.VITE_CORAL_API_BASE || "https://coraldep.onrender.com";

export function coralApiUrl(path) {
  if (!path) return CORAL_API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  return `${CORAL_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}