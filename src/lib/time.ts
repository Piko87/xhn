export type ShanghaiNow = { date: string; time: string; weekday: number };

const WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function shanghaiNow(now = new Date()): ShanghaiNow {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAY[parts.weekday] ?? 1,
  };
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function diffDays(later: string, earlier: string) {
  const a = Date.parse(`${later}T00:00:00Z`);
  const b = Date.parse(`${earlier}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export function startOfWeek(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDays(iso, delta);
}

export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const sunday0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sunday0 === 0 ? 7 : sunday0;
}

export function minutesUntil(date: string, time: string, now = shanghaiNow()) {
  const start = Date.parse(`${date}T${time}:00+08:00`);
  const current = Date.parse(`${now.date}T${now.time}:00+08:00`);
  return Math.round((start - current) / 60_000);
}

export function formatRange(start: string, end: string) {
  return `${start}–${end}`;
}

export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
