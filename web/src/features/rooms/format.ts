/** Hourly hire rate for display, in pesos. Whole amounts drop the centavos. */
export function formatHourlyRate(rate: number | null): string {
  if (rate === null) return "No rate set";
  if (rate === 0) return "Free";
  const whole = Number.isInteger(rate);
  const amount = rate.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  return `₱${amount} / hour`;
}
