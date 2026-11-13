"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAccess } from "@/lib/guard";
import { nextCode, qall, qget, toTicketInput } from "@/lib/queries";
import type { ActionState, TicketInput } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("products", "write");
  const id = Number(formData.get("id") || 0);
  const name = text(formData, "name");
  const area = text(formData, "area");
  const terminal = text(formData, "terminal_no");
  const address = text(formData, "address");
  const venueId = Number(formData.get("venue_id") || 0);
  if (!name || !area || !terminal || !address) return { ok: false, message: "请填写名称、区域、终端号和地址" };
  const db = getDb();
  const fields = [
    name,
    area,
    terminal,
    address,
    text(formData, "published_at") || new Date().toISOString().slice(0, 16).replace("T", " "),
    text(formData, "remark"),
    Number(formData.get("hue") || 16),
    text(formData, "intro"),
    text(formData, "director"),
    text(formData, "traffic"),
    text(formData, "notice"),
    text(formData, "supplier_phone"),
    venueId || null,
  ];
  if (id) {
    db.prepare(
      `UPDATE products SET name=?, area=?, terminal_no=?, address=?, published_at=?, remark=?, hue=?, intro=?, director=?, traffic=?, notice=?, supplier_phone=?, venue_id=? WHERE id=?`,
    ).run(...fields, id);
    revalidatePath(`/products/${id}`);
    revalidatePath("/products");
    return { ok: true, message: "产品已保存" };
  }
  const info = db.prepare(
    `INSERT INTO products (code, name, product_type, area, terminal_no, address, published_at, remark, hue, intro, director, traffic, notice, supplier_phone, venue_id, status)
     VALUES (?, ?, '演出', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '出售中')`,
  ).run(nextCode("P"), ...fields);
  revalidatePath("/products");
  redirect(`/products/${Number(info.lastInsertRowid)}/edit`);
}

const NUMBER_FIELDS = new Set([
  "daily_stock",
  "total_stock",
  "cost_price",
  "retail_price",
  "window_price",
  "gate_price",
  "need_play_date",
  "verify_before_minutes",
  "auto_verify",
  "auto_verify_hour",
  "precheck",
  "id_compare",
  "show_order_code",
  "advance_value",
  "timed_sale",
  "order_min",
  "order_max",
  "limit_days",
  "limit_qty",
  "unpaid_cancel_minutes",
  "notify_visitor_sms",
  "notify_visitor_wechat",
  "notify_supplier_sms",
  "notify_distributor_sms",
  "refund_days",
  "refund_audit",
  "reschedule",
  "reschedule_audit",
  "change_audit",
  "people_count",
]);

export async function saveTicket(input: TicketInput): Promise<ActionState> {
  await requireAccess("ticket_rules", "write");
  if (!input.name.trim()) return { ok: false, message: "请填写票名称" };
  if (input.book_end < input.book_start) return { ok: false, message: "预订结束日不能早于开始日" };
  if (input.order_min < 1 || input.order_max < input.order_min) return { ok: false, message: "下单人数下限需小于等于上限" };
  if (input.timed_sale && input.timed_end <= input.timed_start) return { ok: false, message: "限时售卖结束时刻需晚于开始时刻" };
  if (input.weekdays.length === 0) return { ok: false, message: "请至少选择一个可售星期" };
  if (input.shelf_mode === "上下架自动控制" && input.shelf_trigger === "指定时间" && (!input.shelf_on || !input.shelf_off)) {
    return { ok: false, message: "指定上下架时间需要填写开始和结束" };
  }
  for (const tier of input.fee_tiers) {
    if (tier.feePercent < 0 || tier.feePercent > 100) return { ok: false, message: "退票手续费百分比需在 0–100" };
  }
  const db = getDb();
  const current = db.prepare("SELECT product_id FROM tickets WHERE id = ?").get(input.id) as { product_id: number } | undefined;
  if (!current) return { ok: false, message: "票类不存在" };
  const peers = db
    .prepare("SELECT id, book_start, book_end FROM tickets WHERE product_id = ? AND name = ? AND id != ?")
    .all(current.product_id, input.name.trim(), input.id) as { book_start: string; book_end: string }[];
  if (peers.some((peer) => !(input.book_end < peer.book_start || input.book_start > peer.book_end))) {
    return { ok: false, message: "同一产品下同名票类的预订时间段不能重叠" };
  }
  const stored: Record<string, string | number | null> = {
    name: input.name.trim(),
    zone_id: input.zone_id,
    book_start: input.book_start,
    book_end: input.book_end,
    calendar_mode: input.calendar_mode,
    daily_stock: input.daily_stock,
    total_stock: input.total_stock,
    cost_price: input.cost_price,
    retail_price: input.retail_price,
    window_price: input.window_price,
    gate_price: input.gate_price,
    weekdays: JSON.stringify(input.weekdays),
    need_play_date: input.need_play_date,
    entry_mode: input.entry_mode,
    verify_before_minutes: input.verify_before_minutes,
    auto_verify: input.auto_verify,
    auto_verify_hour: input.auto_verify_hour,
    precheck: input.precheck,
    id_compare: input.id_compare,
    show_order_code: input.show_order_code,
    order_hint: input.order_hint,
    ticket_desc: input.ticket_desc,
    advance_mode: input.advance_mode,
    advance_value: input.advance_value,
    timed_sale: input.timed_sale,
    timed_start: input.timed_start,
    timed_end: input.timed_end,
    seating_mode: input.seating_mode,
    sale_channels: JSON.stringify(input.sale_channels),
    order_min: input.order_min,
    order_max: input.order_max,
    realname: input.realname,
    limit_by: input.limit_by,
    limit_days: input.limit_days,
    limit_qty: input.limit_qty,
    age_min: input.age_min,
    age_max: input.age_max,
    risk_tip: input.risk_tip,
    pay_mode: "在线支付",
    unpaid_cancel_minutes: input.unpaid_cancel_minutes,
    notify_visitor_sms: input.notify_visitor_sms,
    notify_visitor_wechat: input.notify_visitor_wechat,
    notify_supplier_sms: input.notify_supplier_sms,
    notify_distributor_sms: input.notify_distributor_sms,
    sms_header: input.sms_header,
    sms_body: input.sms_body,
    pickup_time: input.pickup_time,
    qr_type: input.qr_type,
    print_mode: input.print_mode,
    voice_mode: input.voice_mode,
    voice_custom: input.voice_custom,
    refund_mode: input.refund_mode,
    refund_days: input.refund_days,
    refund_audit: input.refund_audit,
    pickup_refund: input.pickup_refund,
    qty_change: input.qty_change,
    fee_tiers: JSON.stringify(input.fee_tiers),
    reschedule: input.reschedule,
    reschedule_channels: JSON.stringify(input.reschedule_channels),
    reschedule_audit: input.reschedule_audit,
    reschedule_weekend: input.reschedule_weekend,
    change_audit: input.change_audit,
    expire_action: input.expire_action,
    people_count: input.people_count,
    special_type: input.special_type,
    special_gender: input.special_gender,
    special_region: input.special_region,
    shelf_mode: input.shelf_mode,
    shelf_trigger: input.shelf_trigger,
    shelf_on: input.shelf_on,
    shelf_off: input.shelf_off,
  };
  for (const key of NUMBER_FIELDS) stored[key] = Number(stored[key] ?? 0);
  const keys = Object.keys(stored);
  db.prepare(`UPDATE tickets SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`).run(...keys.map((key) => stored[key]), input.id);
  revalidatePath(`/tickets/${input.id}`);
  revalidatePath("/products");
  return { ok: true, message: "票类规则已保存" };
}

export async function addTicket(formData: FormData): Promise<void> {
  await requireAccess("ticket_rules", "write");
  const productId = Number(formData.get("product_id"));
  const product = qget<{ venue_id: number | null; name: string }>("SELECT venue_id, name FROM products WHERE id = ?", productId);
  if (!product) redirect("/products");
  const zone = product.venue_id
    ? qget<{ id: number }>("SELECT id FROM zones WHERE venue_id = ? ORDER BY sort_order, id LIMIT 1", product.venue_id)
    : undefined;
  const db = getDb();
  const blank = toTicketInput({
    id: 0,
    name: "新票类",
    zone_id: zone?.id ?? null,
    book_start: "2026-11-01",
    book_end: "2026-12-31",
    calendar_mode: "日历票",
    daily_stock: -1,
    total_stock: -1,
    cost_price: 0,
    retail_price: 0,
    window_price: 0,
    gate_price: 0,
    weekdays: "[1,2,3,4,5,6,7]",
    need_play_date: 1,
    entry_mode: "整批入园",
    verify_before_minutes: 30,
    auto_verify: 0,
    auto_verify_hour: 21,
    precheck: 0,
    id_compare: 0,
    show_order_code: 1,
    order_hint: "",
    ticket_desc: "",
    advance_mode: "session",
    advance_value: 60,
    timed_sale: 1,
    timed_start: "09:00",
    timed_end: "22:30",
    seating_mode: "按号入座",
    sale_channels: "[1,2]",
    order_min: 1,
    order_max: 6,
    realname: "仅取票人",
    limit_by: "不限制",
    limit_days: 0,
    limit_qty: 0,
    age_min: null,
    age_max: null,
    risk_tip: "",
    pay_mode: "在线支付",
    unpaid_cancel_minutes: 15,
    notify_visitor_sms: 0,
    notify_visitor_wechat: 0,
    notify_supplier_sms: 0,
    notify_distributor_sms: 0,
    sms_header: "席衡演示",
    sms_body: "",
    pickup_time: "不限",
    qr_type: "门票码",
    print_mode: "每个游客一张",
    voice_mode: "播报票全称",
    voice_custom: "",
    refund_mode: "演出日期前可退",
    refund_days: 1,
    refund_audit: 1,
    pickup_refund: "取票后不可退",
    qty_change: "可减不可增",
    fee_tiers: "[]",
    reschedule: 0,
    reschedule_channels: "[]",
    reschedule_audit: 1,
    reschedule_weekend: "周末可改",
    change_audit: 1,
    expire_action: "不处理",
    people_count: 1,
    special_type: "无",
    special_gender: "不限",
    special_region: "",
    shelf_mode: "放入仓库",
    shelf_trigger: "预订时间",
    shelf_on: "",
    shelf_off: "",
  });
  const stored = { ...blank } as Record<string, unknown>;
  delete stored.id;
  stored.weekdays = JSON.stringify(blank.weekdays);
  stored.sale_channels = JSON.stringify(blank.sale_channels);
  stored.fee_tiers = JSON.stringify(blank.fee_tiers);
  stored.reschedule_channels = JSON.stringify(blank.reschedule_channels);
  const keys = Object.keys(stored);
  const info = db
    .prepare(`INSERT INTO tickets (code, product_id, ${keys.join(",")}) VALUES (?, ?, ${keys.map(() => "?").join(",")})`)
    .run(nextCode("T"), productId, ...keys.map((key) => stored[key] as string | number | null));
  const ticketId = Number(info.lastInsertRowid);
  for (const channelId of [1, 2, 3]) {
    db.prepare("INSERT INTO channel_switches (ticket_id, channel_id, enabled) VALUES (?, ?, ?)").run(ticketId, channelId, channelId === 3 ? 0 : 1);
  }
  const distributors = qall<{ id: number }>("SELECT id FROM distributors");
  for (const distributor of distributors) {
    db.prepare("INSERT INTO dist_prices (ticket_id, distributor_id, enabled, downstream, settlement) VALUES (?, ?, 0, 0, 0)").run(
      ticketId,
      distributor.id,
    );
  }
  revalidatePath("/products");
  redirect(`/tickets/${ticketId}`);
}

export async function savePriceDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("price_calendar", "write");
  const ticketId = Number(formData.get("ticket_id"));
  const day = text(formData, "day");
  if (!day) return { ok: false, message: "请选择日期" };
  getDb()
    .prepare(
      `INSERT INTO price_days (ticket_id, day, cost_price, retail_price, window_price, gate_price, daily_stock, daily_reserve, stop_sale, stop_reserve)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ticket_id, day) DO UPDATE SET
         cost_price=excluded.cost_price, retail_price=excluded.retail_price, window_price=excluded.window_price,
         gate_price=excluded.gate_price, daily_stock=excluded.daily_stock, daily_reserve=excluded.daily_reserve,
         stop_sale=excluded.stop_sale, stop_reserve=excluded.stop_reserve`,
    )
    .run(
      ticketId,
      day,
      Number(formData.get("cost_price") || 0),
      Number(formData.get("retail_price") || 0),
      Number(formData.get("window_price") || 0),
      Number(formData.get("gate_price") || 0),
      Number(formData.get("daily_stock") || 0),
      Number(formData.get("daily_reserve") || 0),
      formData.get("stop_sale") ? 1 : 0,
      formData.get("stop_reserve") ? 1 : 0,
    );
  revalidatePath(`/tickets/${ticketId}/calendar`);
  return { ok: true, message: `${day} 的价格已写入日历` };
}

export async function clearPriceDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("price_calendar", "write");
  const ticketId = Number(formData.get("ticket_id"));
  const day = text(formData, "day");
  getDb().prepare("DELETE FROM price_days WHERE ticket_id = ? AND day = ?").run(ticketId, day);
  revalidatePath(`/tickets/${ticketId}/calendar`);
  return { ok: true, message: "已恢复为票面价" };
}

export async function saveTotalStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("price_calendar", "write");
  const ticketId = Number(formData.get("ticket_id"));
  getDb().prepare("UPDATE tickets SET total_stock = ? WHERE id = ?").run(Number(formData.get("total_stock")), ticketId);
  revalidatePath(`/tickets/${ticketId}/calendar`);
  return { ok: true, message: "总库存已更新。它与场次座位库存分开计算。" };
}

export async function applyBasePrices(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("price_calendar", "write");
  const ticketId = Number(formData.get("ticket_id"));
  const month = text(formData, "month");
  const days = formData.getAll("weekday").map(Number);
  if (!days.length) return { ok: false, message: "请选择要覆盖的星期" };
  const ticket = qget<Record<string, unknown>>("SELECT * FROM tickets WHERE id = ?", ticketId);
  if (!ticket) return { ok: false, message: "票类不存在" };
  const input = toTicketInput(ticket);
  const db = getDb();
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const insert = db.prepare(
    `INSERT INTO price_days (ticket_id, day, cost_price, retail_price, window_price, gate_price, daily_stock, daily_reserve, stop_sale, stop_reserve)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
     ON CONFLICT(ticket_id, day) DO UPDATE SET
       cost_price=excluded.cost_price, retail_price=excluded.retail_price, window_price=excluded.window_price,
       gate_price=excluded.gate_price, daily_stock=excluded.daily_stock`,
  );
  for (let day = 1; day <= last; day += 1) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, mon - 1, day)).getUTCDay() || 7;
    if (!days.includes(weekday)) continue;
    insert.run(ticketId, iso, input.cost_price, input.retail_price, input.window_price, input.gate_price, input.daily_stock < 0 ? -1 : input.daily_stock);
  }
  revalidatePath(`/tickets/${ticketId}/calendar`);
  return { ok: true, message: "已按票面价覆盖所选星期" };
}

export async function saveSettlementDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("price_calendar", "write");
  const ticketId = Number(formData.get("ticket_id"));
  const distributorId = Number(formData.get("distributor_id"));
  const day = text(formData, "day");
  const price = Number(formData.get("price") || 0);
  getDb()
    .prepare(
      `INSERT INTO settlement_days (ticket_id, distributor_id, day, price) VALUES (?, ?, ?, ?)
       ON CONFLICT(ticket_id, distributor_id, day) DO UPDATE SET price=excluded.price`,
    )
    .run(ticketId, distributorId, day, price);
  revalidatePath(`/tickets/${ticketId}/calendar`);
  return { ok: true, message: "结算价已保存" };
}

export async function saveChannelSales(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("channel_sales", "write");
  const ticketId = Number(formData.get("ticket_id"));
  const db = getDb();
  const channels = qall<{ id: number; kind: string }>("SELECT id, kind FROM channels");
  const distributors = qall<{ id: number }>("SELECT id FROM distributors");
  db.exec("BEGIN");
  try {
    for (const channel of channels.filter((item) => item.kind === "直销")) {
      const enabled = formData.get(`direct_${channel.id}`) ? 1 : 0;
      db.prepare(
        `INSERT INTO channel_switches (ticket_id, channel_id, enabled) VALUES (?, ?, ?)
         ON CONFLICT(ticket_id, channel_id) DO UPDATE SET enabled=excluded.enabled`,
      ).run(ticketId, channel.id, enabled);
    }
    for (const distributor of distributors) {
      db.prepare(
        `INSERT INTO dist_prices (ticket_id, distributor_id, enabled, downstream, settlement) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(ticket_id, distributor_id) DO UPDATE SET enabled=excluded.enabled, downstream=excluded.downstream, settlement=excluded.settlement`,
      ).run(
        ticketId,
        distributor.id,
        formData.get(`dist_${distributor.id}`) ? 1 : 0,
        formData.get(`down_${distributor.id}`) ? 1 : 0,
        Number(formData.get(`price_${distributor.id}`) || 0),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  revalidatePath(`/tickets/${ticketId}/channels`);
  return { ok: true, message: "渠道销售与分销价格已保存" };
}
