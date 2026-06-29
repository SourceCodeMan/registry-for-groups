const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function formatPrice(cents: number | null): string | null {
  return cents != null ? `$${(cents / 100).toFixed(2)}` : null;
}

export const OCCASION_LABEL: Record<string, string> = {
  birthday: "Birthday",
  christmas: "Christmas",
  general: "General",
  other: "Other",
};
