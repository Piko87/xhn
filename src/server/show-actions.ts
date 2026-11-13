"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Numbering } from "@/lib/constants";
import { can } from "@/lib/auth";
import { applyVenueDefaults, getDb } from "@/lib/db";
import { requireAccess } from "@/lib/guard";
import { nextCode, qall, qget } from "@/lib/queries";
import { seatSequence } from "@/lib/seats";
import type { ActionState, ZoneAllocationInput } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("venues", "write");
  const id = Number(formData.get("id") || 0);
  const name = text(formData, "name");
  const address = text(formData, "address");
  const ample = Number(formData.get("fuzzy_ample") || 40);
  const tight = Number(formData.get("fuzzy_tight") || 15);
  if (!name || !address) return { ok: false, message: "请填写场馆名称和地址" };
  if (ample <= tight) return { ok: false, message: "充足阈值需要高于紧张阈值" };
  const display = text(formData, "display_mode") === "realtime" ? "realtime" : "fuzzy";
  const db = getDb();
  const values = [name, address, text(formData, "map_note"), display, ample, tight];
  if (id) {
    db.prepare(
      "UPDATE venues SET name=?, address=?, map_note=?, display_mode=?, fuzzy_ample=?, fuzzy_tight=? WHERE id=?",
    ).run(...values, id);
    revalidatePath(`/venues/${id}`);
    revalidatePath("/venues");
    return { ok: true, message: "场馆已保存" };
  }
  const info = db
    .prepare(
      "INSERT INTO venues (code, name, address, map_note, display_mode, fuzzy_ample, fuzzy_tight) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(nextCode("V"), ...values);
  const venueId = Number(info.lastInsertRowid);
  revalidatePath("/venues");
  redirect(`/venues/${venueId}`);
}

export async function saveZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("venues", "write");
  const venueId = Number(formData.get("venue_id"));
  const id = Number(formData.get("id") || 0);
  const name = text(formData, "name");
  const color = text(formData, "color") || "#c4552a";
  const reserved = Math.max(0, Number(formData.get("reserved") || 0));
  if (!name) return { ok: false, message: "请填写分区名称" };
  const db = getDb();
  let zoneId = id;
  if (id) {
    db.prepare("UPDATE zones SET name=?, color=? WHERE id=? AND venue_id=?").run(name, color, id, venueId);
  } else {
    const count = qget<{ n: number }>("SELECT COUNT(*) AS n FROM zones WHERE venue_id = ?", venueId)?.n ?? 0;
    const info = db
      .prepare(
        "INSERT INTO zones (venue_id, name, color, rows_n, cols_n, numbering, sort_order) VALUES (?, ?, ?, 0, 0, '正序', ?)",
      )
      .run(venueId, name, color, count + 1);
    zoneId = Number(info.lastInsertRowid);
  }
  db.prepare(
    `INSERT INTO inventory_defaults (venue_id, zone_id, reserved) VALUES (?, ?, ?)
     ON CONFLICT(venue_id, zone_id) DO UPDATE SET reserved=excluded.reserved`,
  ).run(venueId, zoneId, reserved);
  revalidatePath(`/venues/${venueId}`);
  return { ok: true, message: id ? "分区已保存" : "分区已添加。请到座位图按模板生成座位。" };
}

export async function deleteZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("venues", "write");
  const id = Number(formData.get("id"));
  const venueId = Number(formData.get("venue_id"));
  const used = qget<{ n: number }>("SELECT COUNT(*) AS n FROM tickets WHERE zone_id = ?", id)?.n ?? 0;
  if (used) return { ok: false, message: "已有票类绑定该分区，不能删除" };
  const db = getDb();
  db.prepare("DELETE FROM seats WHERE zone_id = ?").run(id);
  db.prepare("DELETE FROM inventory_default_holds WHERE zone_id = ?").run(id);
  db.prepare("DELETE FROM inventory_defaults WHERE zone_id = ?").run(id);
  db.prepare("DELETE FROM zones WHERE id = ?").run(id);
  revalidatePath(`/venues/${venueId}`);
  return { ok: true, message: "分区已删除" };
}

export async function saveDefaultHold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("inventory", "write");
  const venueId = Number(formData.get("venue_id"));
  const zoneId = Number(formData.get("zone_id"));
  const channelId = Number(formData.get("channel_id"));
  const qty = Number(formData.get("qty") || 0);
  const db = getDb();
  if (qty <= 0) db.prepare("DELETE FROM inventory_default_holds WHERE venue_id=? AND zone_id=? AND channel_id=?").run(venueId, zoneId, channelId);
  else {
    db.prepare(
      `INSERT INTO inventory_default_holds (venue_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)
       ON CONFLICT(venue_id, zone_id, channel_id) DO UPDATE SET qty=excluded.qty`,
    ).run(venueId, zoneId, channelId, qty);
  }
  revalidatePath(`/venues/${venueId}`);
  return { ok: true, message: "默认独立库存已更新。只影响之后新建的场次。" };
}

export async function copyVenue(formData: FormData) {
  await requireAccess("venues", "write");
  const venueId = Number(formData.get("id"));
  const db = getDb();
  const venue = qget<{ name: string; address: string; map_note: string; display_mode: string; fuzzy_ample: number; fuzzy_tight: number }>(
    "SELECT * FROM venues WHERE id = ?",
    venueId,
  );
  if (!venue) redirect("/venues");
  const info = db
    .prepare(
      "INSERT INTO venues (code, name, address, map_note, display_mode, fuzzy_ample, fuzzy_tight) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(nextCode("V"), `${venue.name} 副本`, venue.address, venue.map_note, venue.display_mode, venue.fuzzy_ample, venue.fuzzy_tight);
  const nextId = Number(info.lastInsertRowid);
  const zones = qall<{ id: number; name: string; color: string; rows_n: number; cols_n: number; numbering: string; sort_order: number }>(
    "SELECT * FROM zones WHERE venue_id = ? ORDER BY id",
    venueId,
  );
  const map = new Map<number, number>();
  for (const zone of zones) {
    const created = db
      .prepare("INSERT INTO zones (venue_id, name, color, rows_n, cols_n, numbering, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(nextId, zone.name, zone.color, zone.rows_n, zone.cols_n, zone.numbering, zone.sort_order);
    map.set(zone.id, Number(created.lastInsertRowid));
  }
  const seats = qall<{ zone_id: number; row_no: number; col_no: number; row_label: string; seat_no: number; sellable: number }>(
    "SELECT * FROM seats WHERE venue_id = ?",
    venueId,
  );
  const insertSeat = db.prepare(
    "INSERT INTO seats (venue_id, zone_id, row_no, col_no, row_label, seat_no, sellable) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const seat of seats) {
    insertSeat.run(nextId, map.get(seat.zone_id) ?? 0, seat.row_no, seat.col_no, seat.row_label, seat.seat_no, seat.sellable);
  }
  const defaults = qall<{ zone_id: number; reserved: number }>("SELECT zone_id, reserved FROM inventory_defaults WHERE venue_id = ?", venueId);
  for (const item of defaults) {
    db.prepare("INSERT INTO inventory_defaults (venue_id, zone_id, reserved) VALUES (?, ?, ?)").run(nextId, map.get(item.zone_id) ?? 0, item.reserved);
  }
  const holds = qall<{ zone_id: number; channel_id: number; qty: number }>(
    "SELECT zone_id, channel_id, qty FROM inventory_default_holds WHERE venue_id = ?",
    venueId,
  );
  for (const hold of holds) {
    db.prepare("INSERT INTO inventory_default_holds (venue_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)").run(
      nextId,
      map.get(hold.zone_id) ?? 0,
      hold.channel_id,
      hold.qty,
    );
  }
  revalidatePath("/venues");
  redirect(`/venues/${nextId}`);
}

export async function deleteVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("venues", "write");
  const id = Number(formData.get("id"));
  const sessions = qget<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE venue_id = ?", id)?.n ?? 0;
  if (sessions) return { ok: false, message: "场馆仍有场次，不能删除" };
  const products = qget<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE venue_id = ?", id)?.n ?? 0;
  if (products) return { ok: false, message: "场馆仍关联产品，不能删除" };
  const db = getDb();
  db.prepare("DELETE FROM seats WHERE venue_id = ?").run(id);
  db.prepare("DELETE FROM inventory_default_holds WHERE venue_id = ?").run(id);
  db.prepare("DELETE FROM inventory_defaults WHERE venue_id = ?").run(id);
  db.prepare("DELETE FROM zones WHERE venue_id = ?").run(id);
  db.prepare("DELETE FROM venues WHERE id = ?").run(id);
  revalidatePath("/venues");
  return { ok: true, message: "场馆已删除" };
}

export async function saveSeats(input: { venueId: number; seats: { id: number; zoneId: number; sellable: number }[] }): Promise<ActionState> {
  await requireAccess("seatmaps", "write");
  const db = getDb();
  const update = db.prepare("UPDATE seats SET zone_id = ?, sellable = ? WHERE id = ? AND venue_id = ?");
  db.exec("BEGIN");
  try {
    for (const seat of input.seats) update.run(seat.zoneId, seat.sellable ? 1 : 0, seat.id, input.venueId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  revalidatePath(`/venues/${input.venueId}/seats`);
  revalidatePath("/inventory");
  return { ok: true, message: "座位图已保存" };
}

export async function regenerateZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("seatmaps", "write");
  const venueId = Number(formData.get("venue_id"));
  const zoneId = Number(formData.get("zone_id"));
  const rows = Number(formData.get("rows") || 0);
  const cols = Number(formData.get("cols") || 0);
  const mode = text(formData, "numbering") as Numbering;
  const sellable = formData.get("default_sellable") ? 1 : 0;
  if (rows < 1 || cols < 1 || rows > 30 || cols > 40) return { ok: false, message: "排数 1–30，列数 1–40" };
  const sequence = seatSequence(cols, mode);
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM seats WHERE zone_id = ?").run(zoneId);
    const insert = db.prepare(
      "INSERT INTO seats (venue_id, zone_id, row_no, col_no, row_label, seat_no, sellable) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (let row = 1; row <= rows; row += 1) {
      for (let col = 0; col < cols; col += 1) insert.run(venueId, zoneId, row, col, `${row}排`, sequence[col], sellable);
    }
    db.prepare("UPDATE zones SET rows_n = ?, cols_n = ?, numbering = ? WHERE id = ?").run(rows, cols, mode, zoneId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  revalidatePath(`/venues/${venueId}/seats`);
  return { ok: true, message: "已按模板重排该分区。原座位号会被替换。" };
}

export async function saveSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("sessions", "write");
  const id = Number(formData.get("id") || 0);
  const venueId = Number(formData.get("venue_id"));
  const productId = Number(formData.get("product_id"));
  const name = text(formData, "name");
  const date = text(formData, "session_date");
  const start = text(formData, "start_time");
  const end = text(formData, "end_time");
  const presale = Number(formData.get("presale_days") || 0);
  const status = text(formData, "status") === "停售" ? "停售" : "开售";
  if (!name || !date || !start || !end) return { ok: false, message: "请填写场次名称、日期和起止时间" };
  if (end <= start) return { ok: false, message: "结束时间需晚于开始时间" };
  const product = qget<{ venue_id: number }>("SELECT venue_id FROM products WHERE id = ?", productId);
  if (!product || product.venue_id !== venueId) return { ok: false, message: "产品场馆与所选场馆不一致" };
  const db = getDb();
  if (id) {
    if (!can(user.access, "sale_windows", "write")) {
      return { ok: false, message: "没有开售窗口的修改权限" };
    }
    db.prepare(
      "UPDATE sessions SET name=?, session_date=?, start_time=?, end_time=?, presale_days=?, status=? WHERE id=?",
    ).run(name, date, start, end, presale, status, id);
    revalidatePath("/sessions");
    revalidatePath("/inventory");
    return { ok: true, message: "场次与开售窗口已保存" };
  }
  const info = db
    .prepare(
      `INSERT INTO sessions (venue_id, product_id, name, session_date, start_time, end_time, mode, presale_days, status)
       VALUES (?, ?, ?, ?, ?, ?, '时段', ?, ?)`,
    )
    .run(venueId, productId, name, date, start, end, presale, status);
  const sessionId = Number(info.lastInsertRowid);
  applyVenueDefaults(sessionId, venueId);
  revalidatePath("/sessions");
  redirect(`/inventory?session=${sessionId}`);
}

export async function deleteSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("sessions", "write");
  const id = Number(formData.get("id"));
  const used = qget<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE session_id = ?", id)?.n ?? 0;
  if (used) return { ok: false, message: "场次已有订单，不能删除" };
  const db = getDb();
  db.prepare("DELETE FROM session_holds WHERE session_id = ?").run(id);
  db.prepare("DELETE FROM session_zones WHERE session_id = ?").run(id);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  revalidatePath("/sessions");
  revalidatePath("/inventory");
  return { ok: true, message: "场次已删除" };
}

export async function saveAllocation(input: { sessionId: number; zones: ZoneAllocationInput[] }): Promise<ActionState> {
  await requireAccess("inventory", "write");
  const session = qget<{ venue_id: number }>("SELECT venue_id FROM sessions WHERE id = ?", input.sessionId);
  if (!session) return { ok: false, message: "场次不存在" };
  const db = getDb();
  for (const zone of input.zones) {
    const cap = qget<{ n: number }>("SELECT COUNT(*) AS n FROM seats WHERE zone_id = ? AND sellable = 1", zone.zoneId);
    const capacity = cap?.n ?? 0;
    const exclusive = zone.holds.reduce((sum, hold) => sum + Math.max(0, hold.qty), 0);
    if (zone.reserved < 0 || exclusive < 0) return { ok: false, message: "库存不能为负数" };
    if (zone.reserved + exclusive > capacity) {
      return { ok: false, message: "预留加独立库存不能超过该分区可售座位数" };
    }
    for (const hold of zone.holds) {
      const sold = qget<{ n: number }>(
        `SELECT COALESCE(SUM(qty), 0) AS n FROM orders
         WHERE session_id = ? AND zone_id = ? AND channel_id = ? AND status != '被取消'`,
        input.sessionId,
        zone.zoneId,
        hold.channelId,
      );
      if (hold.qty < (sold?.n ?? 0)) return { ok: false, message: "独立库存不能小于该渠道已售数量" };
    }
  }
  db.exec("BEGIN");
  try {
    for (const zone of input.zones) {
      db.prepare(
        `INSERT INTO session_zones (session_id, zone_id, reserved) VALUES (?, ?, ?)
         ON CONFLICT(session_id, zone_id) DO UPDATE SET reserved=excluded.reserved`,
      ).run(input.sessionId, zone.zoneId, zone.reserved);
      db.prepare("DELETE FROM session_holds WHERE session_id = ? AND zone_id = ?").run(input.sessionId, zone.zoneId);
      for (const hold of zone.holds) {
        if (hold.qty <= 0) continue;
        db.prepare("INSERT INTO session_holds (session_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)").run(
          input.sessionId,
          zone.zoneId,
          hold.channelId,
          hold.qty,
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  revalidatePath("/inventory");
  revalidatePath("/sessions");
  return { ok: true, message: "分销库存已保存" };
}
