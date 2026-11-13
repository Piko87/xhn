import { accessForRole } from "./auth";
import { getDb } from "./db";
import { customerStockLabel, remainingForChannel, stockForZone, type OccupyingOrder, type ZoneStock } from "./inventory";
import { advanceText, effectiveShelf, parseJson } from "./sale-rules";
import { addDays, diffDays, shanghaiNow, startOfMonth, startOfWeek } from "./time";
import type { FeeTier, TicketInput } from "./types";

export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type Sql = ReturnType<typeof getDb>;

function db() {
  return getDb();
}

export function qall<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function qget<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function listRoles() {
  const roles = qall<{ id: number; name: string; description: string; system: number }>("SELECT * FROM roles ORDER BY id");
  return roles.map((role) => ({ ...role, access: accessForRole(role.id), users: qget<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role_id = ?", role.id)?.n ?? 0 }));
}

export function listUsers() {
  return qall<{
    id: number;
    name: string;
    account: string;
    role_id: number;
    role_name: string;
    status: string;
    created_at: string;
  }>(
    `SELECT u.id, u.name, u.account, u.role_id, u.status, u.created_at, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`,
  );
}

export function listChannels() {
  return qall<{ id: number; name: string; kind: string; distributor_id: number | null }>(
    "SELECT * FROM channels ORDER BY id",
  );
}

export function listDistributors() {
  return qall<{ id: number; name: string; group_name: string }>("SELECT * FROM distributors ORDER BY id");
}

export function listVenues() {
  const venues = qall<{
    id: number;
    code: string;
    name: string;
    address: string;
    map_note: string;
    display_mode: string;
    fuzzy_ample: number;
    fuzzy_tight: number;
  }>("SELECT * FROM venues ORDER BY id");
  return venues.map((venue) => {
    const zones = qall<{ id: number; name: string; color: string }>(
      "SELECT id, name, color FROM zones WHERE venue_id = ? ORDER BY sort_order, id",
      venue.id,
    );
    const products = qget<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE venue_id = ?", venue.id)?.n ?? 0;
    return { ...venue, zones, zone_count: zones.length, product_count: products };
  });
}

export function getVenue(id: number) {
  const venue = qget<{
    id: number;
    code: string;
    name: string;
    address: string;
    map_note: string;
    display_mode: string;
    fuzzy_ample: number;
    fuzzy_tight: number;
  }>("SELECT * FROM venues WHERE id = ?", id);
  if (!venue) return null;
  const zones = qall<{
    id: number;
    venue_id: number;
    name: string;
    color: string;
    rows_n: number;
    cols_n: number;
    numbering: string;
    sort_order: number;
    reserved: number;
  }>(
    `SELECT z.*, COALESCE(d.reserved, 0) AS reserved
     FROM zones z LEFT JOIN inventory_defaults d ON d.zone_id = z.id AND d.venue_id = z.venue_id
     WHERE z.venue_id = ? ORDER BY z.sort_order, z.id`,
    id,
  );
  const holds = qall<{ zone_id: number; channel_id: number; qty: number; channel_name: string }>(
    `SELECT h.zone_id, h.channel_id, h.qty, c.name AS channel_name
     FROM inventory_default_holds h JOIN channels c ON c.id = h.channel_id
     WHERE h.venue_id = ?`,
    id,
  );
  const seats = qall<{ id: number; zone_id: number; row_no: number; col_no: number; row_label: string; seat_no: number; sellable: number }>(
    "SELECT id, zone_id, row_no, col_no, row_label, seat_no, sellable FROM seats WHERE venue_id = ? ORDER BY row_no, col_no",
    id,
  );
  return { ...venue, zones, holds, seats };
}

export function toTicketInput(row: Record<string, unknown>): TicketInput {
  return {
    id: Number(row.id),
    name: String(row.name),
    zone_id: row.zone_id == null ? null : Number(row.zone_id),
    book_start: String(row.book_start),
    book_end: String(row.book_end),
    calendar_mode: String(row.calendar_mode),
    daily_stock: Number(row.daily_stock),
    total_stock: Number(row.total_stock),
    cost_price: Number(row.cost_price),
    retail_price: Number(row.retail_price),
    window_price: Number(row.window_price),
    gate_price: Number(row.gate_price),
    weekdays: parseJson<number[]>(String(row.weekdays), []),
    need_play_date: Number(row.need_play_date),
    entry_mode: String(row.entry_mode),
    verify_before_minutes: Number(row.verify_before_minutes),
    auto_verify: Number(row.auto_verify),
    auto_verify_hour: Number(row.auto_verify_hour),
    precheck: Number(row.precheck),
    id_compare: Number(row.id_compare),
    show_order_code: Number(row.show_order_code),
    order_hint: String(row.order_hint),
    ticket_desc: String(row.ticket_desc),
    advance_mode: String(row.advance_mode),
    advance_value: Number(row.advance_value),
    timed_sale: Number(row.timed_sale),
    timed_start: String(row.timed_start),
    timed_end: String(row.timed_end),
    seating_mode: String(row.seating_mode),
    sale_channels: parseJson<number[]>(String(row.sale_channels), []),
    order_min: Number(row.order_min),
    order_max: Number(row.order_max),
    realname: String(row.realname),
    limit_by: String(row.limit_by),
    limit_days: Number(row.limit_days),
    limit_qty: Number(row.limit_qty),
    age_min: row.age_min == null ? null : Number(row.age_min),
    age_max: row.age_max == null ? null : Number(row.age_max),
    risk_tip: String(row.risk_tip),
    pay_mode: String(row.pay_mode),
    unpaid_cancel_minutes: Number(row.unpaid_cancel_minutes),
    notify_visitor_sms: Number(row.notify_visitor_sms),
    notify_visitor_wechat: Number(row.notify_visitor_wechat),
    notify_supplier_sms: Number(row.notify_supplier_sms),
    notify_distributor_sms: Number(row.notify_distributor_sms),
    sms_header: String(row.sms_header),
    sms_body: String(row.sms_body),
    pickup_time: String(row.pickup_time),
    qr_type: String(row.qr_type),
    print_mode: String(row.print_mode),
    voice_mode: String(row.voice_mode),
    voice_custom: String(row.voice_custom),
    refund_mode: String(row.refund_mode),
    refund_days: Number(row.refund_days),
    refund_audit: Number(row.refund_audit),
    pickup_refund: String(row.pickup_refund),
    qty_change: String(row.qty_change),
    fee_tiers: parseJson<FeeTier[]>(String(row.fee_tiers), []),
    reschedule: Number(row.reschedule),
    reschedule_channels: parseJson<number[]>(String(row.reschedule_channels), []),
    reschedule_audit: Number(row.reschedule_audit),
    reschedule_weekend: String(row.reschedule_weekend),
    change_audit: Number(row.change_audit),
    expire_action: String(row.expire_action),
    people_count: Number(row.people_count),
    special_type: String(row.special_type),
    special_gender: String(row.special_gender),
    special_region: String(row.special_region ?? ""),
    shelf_mode: String(row.shelf_mode),
    shelf_trigger: String(row.shelf_trigger),
    shelf_on: String(row.shelf_on ?? ""),
    shelf_off: String(row.shelf_off ?? ""),
  };
}

export function ticketWindowSummary(ticket: TicketInput) {
  const shelf = effectiveShelf(ticket);
  return {
    shelf: shelf.label,
    booking: `${ticket.book_start} 至 ${ticket.book_end}`,
    advance: advanceText(ticket.advance_mode, ticket.advance_value),
    timed: ticket.timed_sale ? `每日 ${ticket.timed_start}–${ticket.timed_end}` : "不限时",
  };
}

const ticketListSql = `SELECT t.*, z.name AS zone_name FROM tickets t LEFT JOIN zones z ON z.id = t.zone_id`;

export function listProducts(keyword = "") {
  const products = qall<Record<string, unknown>>(
    `SELECT p.*, v.name AS venue_name FROM products p LEFT JOIN venues v ON v.id = p.venue_id
     WHERE p.product_type = '演出' AND (? = '' OR p.name LIKE '%' || ? || '%' OR p.code LIKE '%' || ? || '%')
     ORDER BY p.id`,
    keyword,
    keyword,
    keyword,
  );
  return products.map((product) => {
    const tickets = qall<Record<string, unknown>>(`${ticketListSql} WHERE t.product_id = ? ORDER BY t.id`, Number(product.id)).map((row) => {
      const input = toTicketInput(row);
      const shelf = effectiveShelf(input);
      return {
        id: input.id,
        code: String(row.code),
        name: input.name,
        zone_name: row.zone_name ? String(row.zone_name) : "不使用分区",
        cost_price: input.cost_price,
        retail_price: input.retail_price,
        window_price: input.window_price,
        gate_price: input.gate_price,
        book_end: input.book_end,
        shelf: shelf.label,
        on: shelf.on,
      };
    });
    return { ...(product as {
      id: number;
      code: string;
      name: string;
      area: string;
      terminal_no: string;
      address: string;
      published_at: string;
      remark: string;
      hue: number;
      venue_id: number | null;
      venue_name: string | null;
    }), tickets };
  });
}

export function getProduct(id: number) {
  const product = qget<Record<string, unknown>>(
    `SELECT p.*, v.name AS venue_name, v.display_mode, v.fuzzy_ample, v.fuzzy_tight
     FROM products p LEFT JOIN venues v ON v.id = p.venue_id WHERE p.id = ?`,
    id,
  );
  if (!product) return null;
  const tickets = qall<Record<string, unknown>>(`${ticketListSql} WHERE t.product_id = ? ORDER BY t.id`, id).map((row) => ({
    row,
    input: toTicketInput(row),
    code: String(row.code),
    zone_name: row.zone_name ? String(row.zone_name) : "不使用分区",
    shelf: effectiveShelf(toTicketInput(row)),
  }));
  return { product, tickets };
}

export function getTicket(id: number) {
  const row = qget<Record<string, unknown>>(
    `SELECT t.*, p.name AS product_name, p.code AS product_code, p.supplier_phone, p.venue_id, z.name AS zone_name
     FROM tickets t JOIN products p ON p.id = t.product_id LEFT JOIN zones z ON z.id = t.zone_id WHERE t.id = ?`,
    id,
  );
  if (!row) return null;
  const input = toTicketInput(row);
  return {
    row,
    input,
    code: String(row.code),
    product_id: Number(row.product_id),
    product_name: String(row.product_name),
    product_code: String(row.product_code),
    supplier_phone: String(row.supplier_phone ?? ""),
    venue_id: row.venue_id == null ? null : Number(row.venue_id),
    zone_name: row.zone_name ? String(row.zone_name) : "不使用分区",
    summary: ticketWindowSummary(input),
  };
}

export function zonesForVenue(venueId: number | null) {
  if (!venueId) return [];
  return qall<{ id: number; name: string; color: string }>(
    "SELECT id, name, color FROM zones WHERE venue_id = ? ORDER BY sort_order, id",
    venueId,
  );
}

export function priceMap(ticketId: number, month: string) {
  const rows = qall<{
    day: string;
    cost_price: number;
    retail_price: number;
    window_price: number;
    gate_price: number;
    daily_stock: number;
    daily_reserve: number;
    stop_sale: number;
    stop_reserve: number;
  }>("SELECT * FROM price_days WHERE ticket_id = ? AND day LIKE ? ORDER BY day", ticketId, `${month}%`);
  return new Map(rows.map((row) => [row.day, row]));
}

export function settlementMap(ticketId: number, distributorId: number, month: string) {
  const rows = qall<{ day: string; price: number }>(
    "SELECT day, price FROM settlement_days WHERE ticket_id = ? AND distributor_id = ? AND day LIKE ?",
    ticketId,
    distributorId,
    `${month}%`,
  );
  return new Map(rows.map((row) => [row.day, row.price]));
}

export function channelConfig(ticketId: number) {
  const switches = qall<{ channel_id: number; enabled: number }>("SELECT channel_id, enabled FROM channel_switches WHERE ticket_id = ?", ticketId);
  const prices = qall<{ distributor_id: number; enabled: number; downstream: number; settlement: number }>(
    "SELECT * FROM dist_prices WHERE ticket_id = ?",
    ticketId,
  );
  return { switches, prices };
}

export type SessionRow = {
  id: number;
  venue_id: number;
  product_id: number;
  name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  mode: string;
  presale_days: number;
  status: string;
  product_name: string;
  venue_name: string;
  display_mode: string;
  fuzzy_ample: number;
  fuzzy_tight: number;
};

export function listSessions(venueId: number, from: string, to: string) {
  return qall<SessionRow>(
    `SELECT s.*, p.name AS product_name, v.name AS venue_name, v.display_mode, v.fuzzy_ample, v.fuzzy_tight
     FROM sessions s JOIN products p ON p.id = s.product_id JOIN venues v ON v.id = s.venue_id
     WHERE s.venue_id = ? AND s.session_date >= ? AND s.session_date <= ?
     ORDER BY s.session_date, s.start_time`,
    venueId,
    from,
    to,
  );
}

function zoneCapacity(zoneId: number) {
  const row = qget<{ sellable: number; unsellable: number }>(
    `SELECT SUM(CASE WHEN sellable = 1 THEN 1 ELSE 0 END) AS sellable,
            SUM(CASE WHEN sellable = 0 THEN 1 ELSE 0 END) AS unsellable
     FROM seats WHERE zone_id = ?`,
    zoneId,
  );
  return { capacity: row?.sellable ?? 0, unsellable: row?.unsellable ?? 0 };
}

export function sessionOrders(sessionId: number) {
  return qall<OccupyingOrder & { ticket_id: number }>(
    "SELECT zone_id, channel_id, qty, status, ticket_id FROM orders WHERE session_id = ?",
    sessionId,
  );
}

export function zoneStocksForSession(sessionId: number, venueId: number) {
  const zones = qall<{ id: number; name: string; color: string }>(
    "SELECT id, name, color FROM zones WHERE venue_id = ? ORDER BY sort_order, id",
    venueId,
  );
  const reservedRows = qall<{ zone_id: number; reserved: number }>("SELECT zone_id, reserved FROM session_zones WHERE session_id = ?", sessionId);
  const holdRows = qall<{ zone_id: number; channel_id: number; qty: number }>(
    "SELECT zone_id, channel_id, qty FROM session_holds WHERE session_id = ?",
    sessionId,
  );
  const orders = sessionOrders(sessionId);
  return zones.map((zone) => {
    const cap = zoneCapacity(zone.id);
    const stock = stockForZone({
      zoneId: zone.id,
      capacity: cap.capacity,
      unsellable: cap.unsellable,
      reserved: reservedRows.find((row) => row.zone_id === zone.id)?.reserved ?? 0,
      holds: holdRows.filter((row) => row.zone_id === zone.id).map((row) => ({ channelId: row.channel_id, qty: row.qty })),
      orders,
    });
    return { ...zone, ...stock };
  });
}

export function sessionRollup(session: SessionRow) {
  const zones = zoneStocksForSession(session.id, session.venue_id);
  const available = zones.reduce((sum, zone) => sum + zone.available, 0);
  const sold = zones.reduce((sum, zone) => sum + zone.sold, 0);
  const denominator = zones.reduce((sum, zone) => sum + Math.max(zone.capacity - zone.reserved, 0), 0);
  return {
    available,
    sold,
    denominator,
    label: customerStockLabel(available, denominator, session),
  };
}

export function getSession(id: number) {
  const session = qget<SessionRow>(
    `SELECT s.*, p.name AS product_name, v.name AS venue_name, v.display_mode, v.fuzzy_ample, v.fuzzy_tight
     FROM sessions s JOIN products p ON p.id = s.product_id JOIN venues v ON v.id = s.venue_id WHERE s.id = ?`,
    id,
  );
  if (!session) return null;
  const zones = zoneStocksForSession(id, session.venue_id);
  const tickets = qall<Record<string, unknown>>(`${ticketListSql} WHERE t.product_id = ? ORDER BY t.id`, session.product_id).map((row) => {
    const input = toTicketInput(row);
    return { id: input.id, name: input.name, code: String(row.code), zone_id: input.zone_id, zone_name: row.zone_name ? String(row.zone_name) : "不使用分区", summary: ticketWindowSummary(input), input };
  });
  return { session, zones, tickets };
}

export function monthEnd(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthStart.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function calendarBounds(view: string, date: string) {
  if (view === "week") {
    const start = startOfWeek(date);
    return { from: start, to: addDays(start, 6) };
  }
  const start = startOfMonth(date);
  if (view === "list") return { from: start, to: monthEnd(start) };
  const gridStart = startOfWeek(start);
  return { from: gridStart, to: addDays(gridStart, 41) };
}

export type OrderListRow = {
  id: number;
  order_no: string;
  qty: number;
  status: string;
  pay_status: string;
  pay_method: string;
  buyer_name: string;
  buyer_phone: string;
  created_at: string;
  product_name: string;
  ticket_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  session_name: string;
  zone_name: string;
  channel_name: string;
};

export function listOrders(filters: { date?: string; status?: string; keyword?: string; venueId?: number }) {
  const clauses = ["1 = 1"];
  const params: (string | number)[] = [];
  if (filters.date) {
    clauses.push("s.session_date = ?");
    params.push(filters.date);
  }
  if (filters.status) {
    clauses.push("o.status = ?");
    params.push(filters.status);
  }
  if (filters.venueId) {
    clauses.push("s.venue_id = ?");
    params.push(filters.venueId);
  }
  if (filters.keyword) {
    clauses.push("(o.order_no LIKE '%' || ? || '%' OR o.buyer_name LIKE '%' || ? || '%' OR o.buyer_phone LIKE '%' || ? || '%')");
    params.push(filters.keyword, filters.keyword, filters.keyword);
  }
  return qall<OrderListRow>(
    `SELECT o.id, o.order_no, o.qty, o.status, o.pay_status, o.pay_method, o.buyer_name, o.buyer_phone, o.created_at,
            p.name AS product_name, t.name AS ticket_name, s.session_date, s.start_time, s.end_time, s.name AS session_name,
            z.name AS zone_name, c.name AS channel_name
     FROM orders o
     JOIN products p ON p.id = o.product_id
     JOIN tickets t ON t.id = o.ticket_id
     JOIN sessions s ON s.id = o.session_id
     JOIN zones z ON z.id = o.zone_id
     JOIN channels c ON c.id = o.channel_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY s.session_date, s.start_time, o.id`,
    ...params,
  );
}

export function getOrder(id: number) {
  const order = qget<Record<string, unknown>>(
    `SELECT o.*, p.name AS product_name, p.code AS product_code, t.name AS ticket_name, t.code AS ticket_code,
            t.refund_mode, t.refund_days, t.refund_audit, t.pickup_refund, t.verify_before_minutes, t.entry_mode,
            s.session_date, s.start_time, s.end_time, s.name AS session_name, s.venue_id,
            z.name AS zone_name, c.name AS channel_name, v.name AS venue_name,
            d.name AS distributor_name
     FROM orders o
     JOIN products p ON p.id = o.product_id
     JOIN tickets t ON t.id = o.ticket_id
     JOIN sessions s ON s.id = o.session_id
     JOIN zones z ON z.id = o.zone_id
     JOIN channels c ON c.id = o.channel_id
     JOIN venues v ON v.id = s.venue_id
     LEFT JOIN distributors d ON d.id = o.distributor_id
     WHERE o.id = ?`,
    id,
  );
  if (!order) return null;
  const codes = qall<{ id: number; code: string; seat_label: string; status: string }>(
    "SELECT id, code, seat_label, status FROM ticket_codes WHERE order_id = ? ORDER BY id",
    id,
  );
  const notes = qall<{ id: number; author: string; content: string; created_at: string }>(
    "SELECT * FROM order_notes WHERE order_id = ? ORDER BY id",
    id,
  );
  const refunds = qall<Record<string, unknown>>("SELECT * FROM refunds WHERE order_id = ? ORDER BY id DESC", id);
  const resends = qall<{ id: number; actor: string; created_at: string; channel: string }>(
    "SELECT * FROM resend_logs WHERE order_id = ? ORDER BY id DESC",
    id,
  );
  return { order, codes, notes, refunds, resends };
}

export function listRefunds(status = "") {
  const params: string[] = [];
  let where = "1 = 1";
  if (status) {
    where = "r.status = ?";
    params.push(status);
  }
  return qall<{
    id: number;
    order_id: number;
    order_no: string;
    product_name: string;
    ticket_name: string;
    change_type: string;
    after_qty: number;
    applicant: string;
    applied_at: string;
    reason: string;
    refund_serial: string;
    status: string;
    flow_code: string;
    qty: number;
  }>(
    `SELECT r.*, o.order_no, o.qty, p.name AS product_name, t.name AS ticket_name
     FROM refunds r
     JOIN orders o ON o.id = r.order_id
     JOIN products p ON p.id = o.product_id
     JOIN tickets t ON t.id = o.ticket_id
     WHERE ${where}
     ORDER BY CASE r.status WHEN '等待审核' THEN 0 WHEN '同意' THEN 1 ELSE 2 END, r.id DESC`,
    ...params,
  );
}

export type ReportOrder = {
  created_at: string;
  session_date: string;
  qty: number;
  status: string;
  pay_status: string;
  pay_method: string;
  amount: number;
  unit_price: number;
  product_id: number;
  product_name: string;
  ticket_id: number;
  ticket_name: string;
  channel_name: string;
  distributor_name: string | null;
  seller_name: string;
  people_count: number;
  cost_price: number;
};

export function reportOrders(filters: { from: string; to: string; productId?: number; channel?: string; distributor?: string; pay?: string }) {
  const clauses = ["s.session_date >= ?", "s.session_date <= ?"];
  const params: (string | number)[] = [filters.from, filters.to];
  if (filters.productId) {
    clauses.push("o.product_id = ?");
    params.push(filters.productId);
  }
  if (filters.channel) {
    clauses.push("c.name = ?");
    params.push(filters.channel);
  }
  if (filters.distributor) {
    clauses.push("d.name = ?");
    params.push(filters.distributor);
  }
  if (filters.pay) {
    clauses.push("o.pay_method = ?");
    params.push(filters.pay);
  }
  return qall<ReportOrder>(
    `SELECT o.created_at, s.session_date, o.qty, o.status, o.pay_status, o.pay_method, o.amount, o.unit_price,
            o.product_id, p.name AS product_name, o.ticket_id, t.name AS ticket_name, t.people_count, t.cost_price,
            c.name AS channel_name, d.name AS distributor_name, o.seller_name
     FROM orders o
     JOIN sessions s ON s.id = o.session_id
     JOIN products p ON p.id = o.product_id
     JOIN tickets t ON t.id = o.ticket_id
     JOIN channels c ON c.id = o.channel_id
     LEFT JOIN distributors d ON d.id = o.distributor_id
     WHERE ${clauses.join(" AND ")}`,
    ...params,
  );
}

export function orderCost(order: ReportOrder) {
  const day = qget<{ cost_price: number }>("SELECT cost_price FROM price_days WHERE ticket_id = ? AND day = ?", order.ticket_id, order.session_date);
  return day?.cost_price ?? order.cost_price;
}

export function dashboard() {
  const now = shanghaiNow();
  const sessions = qall<SessionRow>(
    `SELECT s.*, p.name AS product_name, v.name AS venue_name, v.display_mode, v.fuzzy_ample, v.fuzzy_tight
     FROM sessions s JOIN products p ON p.id = s.product_id JOIN venues v ON v.id = s.venue_id
     WHERE s.session_date = ? ORDER BY s.start_time`,
    now.date,
  ).map((session) => ({ ...session, rollup: sessionRollup(session) }));
  const waiting = qget<{ n: number }>("SELECT COUNT(*) AS n FROM refunds WHERE status = '等待审核'")?.n ?? 0;
  const from = addDays(now.date, -6);
  const recent = qall<{ qty: number; amount: number; status: string; pay_status: string }>(
    `SELECT o.qty, o.amount, o.status, o.pay_status FROM orders o JOIN sessions s ON s.id = o.session_id
     WHERE s.session_date >= ? AND s.session_date <= ?`,
    from,
    now.date,
  );
  const sold = recent.filter((row) => row.pay_status === "已支付" && ["未使用", "已使用", "部分使用"].includes(row.status));
  return {
    now,
    sessions,
    waiting,
    weekQty: sold.reduce((sum, row) => sum + row.qty, 0),
    weekAmount: sold.reduce((sum, row) => sum + row.amount, 0),
    todayOrders: qget<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders o JOIN sessions s ON s.id = o.session_id WHERE s.session_date = ?",
      now.date,
    )?.n ?? 0,
  };
}

export function saleFormOptions() {
  const sessions = qall<{ id: number; label: string; product_id: number; venue_id: number; session_date: string; start_time: string }>(
    `SELECT s.id, s.product_id, s.venue_id, s.session_date, s.start_time,
            p.name || ' · ' || s.session_date || ' ' || s.start_time || ' ' || s.name AS label
     FROM sessions s JOIN products p ON p.id = s.product_id
     WHERE s.status = '开售' AND s.session_date >= ?
     ORDER BY s.session_date, s.start_time`,
    shanghaiNow().date,
  );
  const tickets = qall<{ id: number; product_id: number; name: string; zone_id: number | null; seating_mode: string }>(
    "SELECT id, product_id, name, zone_id, seating_mode FROM tickets ORDER BY id",
  );
  return { sessions, tickets, channels: listChannels() };
}

export function phoneTicketCount(phone: string, ticketId: number, days: number, now = shanghaiNow()) {
  if (!phone || days <= 0) return 0;
  const from = addDays(now.date, -days);
  const row = qget<{ n: number }>(
    `SELECT COALESCE(SUM(qty), 0) AS n FROM orders
     WHERE buyer_phone = ? AND ticket_id = ? AND status != '被取消' AND substr(created_at, 1, 10) >= ?`,
    phone,
    ticketId,
    from,
  );
  return row?.n ?? 0;
}

export function soldCounters(ticketId: number, sessionDate: string) {
  const today = qget<{ n: number }>(
    `SELECT COALESCE(SUM(o.qty), 0) AS n FROM orders o JOIN sessions s ON s.id = o.session_id
     WHERE o.ticket_id = ? AND s.session_date = ? AND o.status != '被取消'`,
    ticketId,
    sessionDate,
  );
  const total = qget<{ n: number }>(
    "SELECT COALESCE(SUM(qty), 0) AS n FROM orders WHERE ticket_id = ? AND status != '被取消'",
    ticketId,
  );
  return { soldToday: today?.n ?? 0, soldTotal: total?.n ?? 0 };
}

export function channelInventoryRemaining(sessionId: number, venueId: number, zoneId: number | null, channelId: number) {
  if (!zoneId) return null;
  const zones = zoneStocksForSession(sessionId, venueId);
  const zone = zones.find((item) => item.zoneId === zoneId);
  if (!zone) return 0;
  return remainingForChannel(zone, channelId);
}

export function nextCode(kind: "P" | "V" | "T") {
  const table = kind === "P" ? "products" : kind === "V" ? "venues" : "tickets";
  const rows = qall<{ code: string }>(`SELECT code FROM ${table}`);
  let max = 1000;
  for (const row of rows) {
    const digits = Number(row.code.replace(/\D/g, ""));
    if (digits > max) max = digits;
  }
  const prefix = kind === "P" ? "XH-P" : kind === "V" ? "XH-V" : "XH-T";
  return `${prefix}${max + 1}`;
}

export function monthGrid(month: string) {
  const start = startOfWeek(`${month}-01`);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function daysUntilLabel(sessionDate: string) {
  const delta = diffDays(sessionDate, shanghaiNow().date);
  if (delta === 0) return "今天";
  if (delta === 1) return "明天";
  if (delta > 1) return `${delta} 天后`;
  return `${-delta} 天前`;
}

export type { ZoneStock, Sql };
