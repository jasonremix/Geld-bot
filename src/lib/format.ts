export function formatDate(date: Date | string | null | undefined, locale = "de-DE"): string {
  if (!date) return "Nicht verfügbar";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Nicht verfügbar";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined, locale = "de-DE"): string {
  if (!date) return "Nicht verfügbar";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Nicht verfügbar";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Nicht verfügbar";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Anzeigewert für nicht vorhandene Provider-Daten – niemals erfundene Werte. */
export const NOT_AVAILABLE = "Nicht verfügbar";
