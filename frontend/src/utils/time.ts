export function formatPollingInterval(
  intervalHours: number | undefined | null
): string {
  if (!intervalHours || intervalHours <= 0) {
    return 'hour';
  }

  if (intervalHours % 24 === 0) {
    const days = intervalHours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  return `${intervalHours} hour${intervalHours === 1 ? '' : 's'}`;
}

