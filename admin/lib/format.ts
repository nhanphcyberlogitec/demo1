// Localized short-date formatter used in the Users table "Created" column
// (TECH_SPEC §3.2, AC-18). Falls back to the raw ISO string if Intl fails.
export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}
