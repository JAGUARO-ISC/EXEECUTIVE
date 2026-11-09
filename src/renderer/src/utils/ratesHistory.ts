export interface RatePoint {
  date: string;
  rate: number;
}

export const appendRatePoint = (history: RatePoint[], point: RatePoint, limit = 30): RatePoint[] => {
  if (!point.date || !Number.isFinite(point.rate) || point.rate <= 0 || limit < 1) return history.slice(-Math.max(0, limit));
  const next = [...history.filter((item) => item.date !== point.date), point]
    .sort((a, b) => a.date.localeCompare(b.date));
  return next.slice(-limit);
};

export const readRateHistory = (key: string): RatePoint[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is RatePoint => typeof item?.date === 'string' && Number.isFinite(item?.rate) && item.rate > 0) : [];
  } catch {
    return [];
  }
};

export const writeRateHistory = (key: string, history: RatePoint[]): void => {
  try { localStorage.setItem(key, JSON.stringify(history)); } catch { /* storage is optional */ }
};
