const cleanValue = (value) => value == null
  ? ""
  : String(value).replace(/_/g, " ").replace(/\s+/g, " ").trim();

export function poolBusinessDetails(lead) {
  const rawRevenue = cleanValue(lead.revenue);
  const numericRevenue = rawRevenue.replace(/\s/g, "").replace(",", ".");
  const revenue = /^\d+(\.\d+)?$/.test(numericRevenue)
    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(numericRevenue))} €`
    : rawRevenue;
  const headcount = cleanValue(lead.headcount) || cleanValue(lead.employee_range);
  return { revenue, headcount };
}

// Personal call dates already include their UTC offset in the API response.
// Missing dates stay last in either direction; never reorder the API snapshot.
export function sortByMyLastCall(leads, direction) {
  const timestamp = (value) => value ? Date.parse(value) : NaN;
  return [...leads].sort((a, b) => {
    const left = timestamp(a.my_last_call_at);
    const right = timestamp(b.my_last_call_at);
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
    if (!Number.isFinite(right)) return -1;
    return direction === "newest" ? right - left : left - right;
  });
}
