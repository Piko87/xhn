import type { TicketInput } from "./types";
import { diffDays, minutesUntil, shanghaiNow, weekdayOf, type ShanghaiNow } from "./time";

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type ShelfInfo = { on: boolean; label: string };

export function effectiveShelf(ticket: {
  shelf_mode: string;
  shelf_trigger: string;
  shelf_on: string;
  shelf_off: string;
  book_start: string;
  book_end: string;
  weekdays: string | number[];
}, now = shanghaiNow()): ShelfInfo {
  if (ticket.shelf_mode === "放入仓库") return { on: false, label: "仓库" };
  if (ticket.shelf_mode === "发布上架") return { on: true, label: "正常" };
  if (ticket.shelf_trigger === "指定时间") {
    const current = Date.parse(`${now.date}T${now.time}:00+08:00`);
    const onAt = ticket.shelf_on ? Date.parse(ticket.shelf_on) : NaN;
    const offAt = ticket.shelf_off ? Date.parse(ticket.shelf_off) : NaN;
    const on = Number.isFinite(onAt) && Number.isFinite(offAt) && current >= onAt && current <= offAt;
    return { on, label: on ? "正常" : "自动控制·下架" };
  }
  const weekdays = Array.isArray(ticket.weekdays) ? ticket.weekdays : parseJson<number[]>(ticket.weekdays, []);
  const on = now.date >= ticket.book_start && now.date <= ticket.book_end && weekdays.includes(now.weekday);
  return { on, label: on ? "正常" : "自动控制·下架" };
}

export function advanceText(mode: string, value: number) {
  if (mode === "day") return value <= 0 ? "演出当天可订" : `至少提前 ${value} 天`;
  return `开演前 ${value} 分钟停售`;
}

export function withinVerifyWindow(input: {
  sessionDate: string;
  start: string;
  end: string;
  beforeMinutes: number;
  now?: ShanghaiNow;
}) {
  const now = input.now ?? shanghaiNow();
  const early = input.beforeMinutes;
  const open = Date.parse(`${input.sessionDate}T${input.start}:00+08:00`) - early * 60_000;
  const close = Date.parse(`${input.sessionDate}T${input.end}:00+08:00`);
  const current = Date.parse(`${now.date}T${now.time}:00+08:00`);
  return current >= open && current <= close;
}

export function refundHint(ticket: { refund_mode: string; refund_days: number; refund_audit: number; pickup_refund: string }) {
  const policy =
    ticket.refund_mode === "演出日期前可退"
      ? `演出日期前 ${ticket.refund_days} 天可退`
      : ticket.refund_mode;
  const audit = ticket.refund_audit ? "，需人工审核" : "，无需审核";
  return `${policy}${audit}；${ticket.pickup_refund}`;
}

export type SaleContext = {
  ticket: TicketInput & { id: number };
  session: { session_date: string; start_time: string; end_time: string; status: string; presale_days: number };
  channel: { id: number; kind: string; distributor_id: number | null };
  directEnabled: boolean;
  distEnabled: boolean;
  qty: number;
  buyerName: string;
  buyerPhone: string;
  idNo: string;
  seatText: string;
  priceDay?: { stop_sale: number; daily_stock: number } | null;
  soldToday: number;
  soldTotal: number;
  phoneTicketsInWindow: number;
  inventoryRemaining: number | null;
  now?: ShanghaiNow;
};

export function evaluateSale(input: SaleContext) {
  const reasons: string[] = [];
  const now = input.now ?? shanghaiNow();
  const ticket = input.ticket;
  const shelf = effectiveShelf(ticket, now);
  if (!shelf.on) reasons.push(`票类当前状态为「${shelf.label}」`);
  if (input.session.status !== "开售") reasons.push("场次未开售");
  const ahead = diffDays(input.session.session_date, now.date);
  if (ahead < 0) reasons.push("场次已过演出日");
  else if (ahead > input.session.presale_days) reasons.push(`超出预售天数（本场预售 ${input.session.presale_days} 天）`);
  if (now.date < ticket.book_start || now.date > ticket.book_end) reasons.push("不在票类预订时间段内");
  if (ticket.need_play_date && !ticket.weekdays.includes(weekdayOf(input.session.session_date))) {
    reasons.push("演出日不在可售星期内");
  }
  if (ticket.advance_mode === "day") {
    if (ahead < ticket.advance_value) reasons.push(`需${advanceText("day", ticket.advance_value)}`);
  } else if (minutesUntil(input.session.session_date, input.session.start_time, now) < ticket.advance_value) {
    reasons.push(`已过提前预订截止（${advanceText("session", ticket.advance_value)}）`);
  }
  if (ticket.timed_sale) {
    if (now.time < ticket.timed_start || now.time > ticket.timed_end) {
      reasons.push(`不在限时售卖时段 ${ticket.timed_start}–${ticket.timed_end}`);
    }
  }
  if (!ticket.sale_channels.includes(input.channel.id)) reasons.push("渠道不在票类可售白名单");
  else if (input.channel.kind === "直销" && !input.directEnabled) reasons.push("直销渠道销售开关未打开");
  else if (input.channel.kind === "分销" && !input.distEnabled) reasons.push("分销商未开通该票");
  if (input.qty < ticket.order_min || input.qty > ticket.order_max) {
    reasons.push(`下单数量需在 ${ticket.order_min}–${ticket.order_max}`);
  }
  if (ticket.realname !== "不实名") {
    if (!input.buyerName.trim() || !input.buyerPhone.trim()) reasons.push("实名规则要求填写取票人姓名和手机");
    if ((ticket.realname === "仅取票人" || ticket.realname === "取票人及游客" || ticket.realname === "全部游客") && !input.idNo.trim()) {
      reasons.push("实名规则要求填写证件号");
    }
  }
  if (ticket.limit_by !== "不限制" && ticket.limit_qty > 0) {
    if (input.phoneTicketsInWindow + input.qty > ticket.limit_qty) {
      reasons.push(`购票限制：${ticket.limit_days} 天内同一取票人最多 ${ticket.limit_qty} 张`);
    }
  }
  if (ticket.seating_mode === "按号入座") {
    const seats = input.seatText.split(/[、,，\s]+/).filter(Boolean);
    if (seats.length !== input.qty) reasons.push("按号入座需要填写与数量一致的座位号，用顿号分隔");
  }
  if (input.priceDay?.stop_sale) reasons.push("价格日历已停止售卖");
  const dailyCap = input.priceDay ? input.priceDay.daily_stock : ticket.daily_stock;
  if (dailyCap >= 0 && input.soldToday + input.qty > dailyCap) reasons.push(`超过票类日库存（上限 ${dailyCap}）`);
  if (ticket.total_stock >= 0 && input.soldTotal + input.qty > ticket.total_stock) {
    reasons.push(`超过票类总库存（上限 ${ticket.total_stock}）`);
  }
  if (input.inventoryRemaining !== null && input.qty > input.inventoryRemaining) {
    reasons.push(`分区渠道库存不足，剩余 ${Math.max(input.inventoryRemaining, 0)}`);
  }
  return { ok: reasons.length === 0, reasons };
}
