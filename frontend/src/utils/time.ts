export function formatPollingInterval(
  intervalMinutes: number | undefined | null
): string {
  if (!intervalMinutes || intervalMinutes <= 0) {
    return 'hour';
  }

  const DAY_IN_MINUTES = 24 * 60;
  const HOUR_IN_MINUTES = 60;

  if (intervalMinutes % DAY_IN_MINUTES === 0) {
    const days = intervalMinutes / DAY_IN_MINUTES;
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (intervalMinutes % HOUR_IN_MINUTES === 0) {
    const hours = intervalMinutes / HOUR_IN_MINUTES;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${intervalMinutes} minute${intervalMinutes === 1 ? '' : 's'}`;
}

