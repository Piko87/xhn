"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAccess } from "@/lib/guard";
import { validateStockDelta } from "@/lib/inventory";
import { qall, qget } from "@/lib/queries";
import { isOccupying } from "@/lib/inventory";
import { shanghaiNow } from "@/lib/time";
import type { ActionState } from "@/lib/types";

function stamp() {
  const now = shanghaiNow();
  return `${now.date} ${now.time}`;
}

function log(area: string, target: string, actor: string, summary: string) {
  getDb().prepare("INSERT INTO operation_logs (area, target, actor, summary, created_at) VALUES (?, ?, ?, ?, ?)").run(area, target, actor, summary, stamp());
}

export async function createTemplate(formData: FormData) {
  const user = await requireAccess("inventory", "write");
  const venueId = Number(formData.get("venue_id"));
  const zoneId = Number(formData.get("zone_id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const zone = qget<{ venue_id: number }>("SELECT venue_id FROM zones WHERE id = ?", zoneId);
  if (!zone || zone.venue_id !== venueId) return;
  const existing = qget<{ n: number }>("SELECT COUNT(*) AS n FROM inventory_templates WHERE zone_id = ?", zoneId)?.n ?? 0;
  const info = getDb()
    .prepare("INSERT INTO inventory_templates (venue_id, zone_id, name, is_default, reserved, created_at) VALUES (?, ?, ?, ?, 0, ?)")
    .run(venueId, zoneId, name, existing === 0 ? 1 : 0, stamp());
  log("分销库存模板", String(info.lastInsertRowid), user.name, `新建模板「${name}」`);
  revalidatePath("/inventory-templates");
  redirect(`/inventory-templates/${Number(info.lastInsertRowid)}`);
}

export async function copyTemplate(formData: FormData) {
  const user = await requireAccess("inventory", "write");
  const id = Number(formData.get("id"));
  const source = qget<{ venue_id: number; zone_id: number; name: string; reserved: number }>("SELECT * FROM inventory_templates WHERE id = ?", id);
  if (!source) redirect("/inventory-templates");
  const db = getDb();
  const info = db
    .prepare("INSERT INTO inventory_templates (venue_id, zone_id, name, is_default, reserved, created_at) VALUES (?, ?, ?, 0, ?, ?)")
    .run(source!.venue_id, source!.zone_id, `${source!.name} 副本`, source!.reserved, stamp());
  const nextId = Number(info.lastInsertRowid);
  const channels = qall<{ channel_id: number; qty: number }>("SELECT channel_id, qty FROM template_channel_holds WHERE template_id = ?", id);
  for (const hold of channels) db.prepare("INSERT INTO template_channel_holds (template_id, channel_id, qty) VALUES (?, ?, ?)").run(nextId, hold.channel_id, hold.qty);
  const groups = qall<{ group_id: number; qty: number }>("SELECT group_id, qty FROM template_group_holds WHERE template_id = ?", id);
  for (const hold of groups) db.prepare("INSERT INTO template_group_holds (template_id, group_id, qty) VALUES (?, ?, ?)").run(nextId, hold.group_id, hold.qty);
  log("分销库存模板", String(nextId), user.name, `从「${source!.name}」复制`);
  revalidatePath("/inventory-templates");
  redirect(`/inventory-templates/${nextId}`);
}

export async function deleteTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("inventory", "write");
  const id = Number(formData.get("id"));
  const row = qget<{ name: string }>("SELECT name FROM inventory_templates WHERE id = ?", id);
  if (!row) return { ok: false, message: "模板不存在" };
  const db = getDb();
  db.prepare("DELETE FROM template_channel_holds WHERE template_id = ?").run(id);
  db.prepare("DELETE FROM template_group_holds WHERE template_id = ?").run(id);
  db.prepare("DELETE FROM inventory_templates WHERE id = ?").run(id);
  log("分销库存模板", String(id), user.name, `删除模板「${row.name}」。已生成的场次不会被改写。`);
  revalidatePath("/inventory-templates");
  return { ok: true, message: "模板已删除。已有场次保持原分配。" };
}

export async function setDefaultTemplate(formData: FormData) {
  const user = await requireAccess("inventory", "write");
  const id = Number(formData.get("id"));
  const row = qget<{ venue_id: number; zone_id: number; name: string }>("SELECT venue_id, zone_id, name FROM inventory_templates WHERE id = ?", id);
  if (!row) return;
  const db = getDb();
  db.prepare("UPDATE inventory_templates SET is_default = 0 WHERE venue_id = ? AND zone_id = ?").run(row.venue_id, row.zone_id);
  db.prepare("UPDATE inventory_templates SET is_default = 1 WHERE id = ?").run(id);
  log("分销库存模板", String(id), user.name, `把「${row.name}」设为该分区的默认模板。之后新建的场次会套用它。`);
  revalidatePath("/inventory-templates");
  revalidatePath(`/inventory-templates/${id}`);
}

export async function renameTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAccess("inventory", "write");
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, message: "请填写模板名称" };
  getDb().prepare("UPDATE inventory_templates SET name = ? WHERE id = ?").run(name, id);
  revalidatePath(`/inventory-templates/${id}`);
  return { ok: true, message: "名称已保存。保存模板不会改写已有场次。" };
}

export async function createGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("inventory", "write");
  const name = String(formData.get("name") || "").trim();
  const channelId = Number(formData.get("channel_id") || 0);
  if (!name) return { ok: false, message: "请填写分组名称" };
  const db = getDb();
  const info = db.prepare("INSERT INTO dist_groups (name) VALUES (?)").run(name);
  const groupId = Number(info.lastInsertRowid);
  if (channelId) {
    db.prepare("DELETE FROM dist_group_channels WHERE channel_id = ?").run(channelId);
    db.prepare("INSERT INTO dist_group_channels (group_id, channel_id) VALUES (?, ?)").run(groupId, channelId);
  }
  log("分销库存模板", "groups", user.name, `新建分组「${name}」`);
  revalidatePath("/inventory-templates");
  return { ok: true, message: "分组已创建。分销商可以在库存设置里归入这一组。" };
}

function soldFor(sessionId: number, zoneId: number, channelIds: number[]) {
  if (!channelIds.length) return 0;
  const orders = qall<{ channel_id: number; qty: number; status: string }>(
    "SELECT channel_id, qty, status FROM orders WHERE session_id = ? AND zone_id = ?",
    sessionId,
    zoneId,
  );
  return orders.filter((order) => isOccupying(order.status) && channelIds.includes(order.channel_id)).reduce((sum, order) => sum + order.qty, 0);
}

export async function adjustAllocation(input: {
  scope: "template" | "session";
  templateId?: number;
  sessionId?: number;
  zoneId: number;
  target: "reserved" | "channel" | "group";
  targetId: number;
  mode: "独立" | "共享";
  delta: number;
  applyUnsold?: boolean;
}): Promise<ActionState> {
  const user = await requireAccess("inventory", "write");
  const templateId = input.templateId ?? 0;
  const sessionId = input.sessionId ?? 0;
  if (input.scope === "template" && !templateId) return { ok: false, message: "模板不存在" };
  if (input.scope === "session" && !sessionId) return { ok: false, message: "场次不存在" };
  const db = getDb();
  const capacity = qget<{ n: number }>("SELECT COUNT(*) AS n FROM seats WHERE zone_id = ? AND kind = 'seat' AND sellable = 1", input.zoneId)?.n ?? 0;
  let reserved = 0;
  let channelHolds: { id: number; qty: number }[] = [];
  let groupHolds: { id: number; qty: number }[] = [];
  if (input.scope === "template") {
    const template = qget<{ reserved: number; venue_id: number }>("SELECT reserved, venue_id FROM inventory_templates WHERE id = ?", input.templateId ?? 0);
    if (!template) return { ok: false, message: "模板不存在" };
    reserved = template.reserved;
    channelHolds = qall<{ channel_id: number; qty: number }>("SELECT channel_id, qty FROM template_channel_holds WHERE template_id = ?", input.templateId!).map((row) => ({ id: row.channel_id, qty: row.qty }));
    groupHolds = qall<{ group_id: number; qty: number }>("SELECT group_id, qty FROM template_group_holds WHERE template_id = ?", input.templateId!).map((row) => ({ id: row.group_id, qty: row.qty }));
  } else {
    reserved = qget<{ reserved: number }>("SELECT reserved FROM session_zones WHERE session_id = ? AND zone_id = ?", sessionId, input.zoneId)?.reserved ?? 0;
    channelHolds = qall<{ channel_id: number; qty: number }>("SELECT channel_id, qty FROM session_holds WHERE session_id = ? AND zone_id = ?", sessionId, input.zoneId).map((row) => ({ id: row.channel_id, qty: row.qty }));
    groupHolds = qall<{ group_id: number; qty: number }>("SELECT group_id, qty FROM session_group_holds WHERE session_id = ? AND zone_id = ?", sessionId, input.zoneId).map((row) => ({ id: row.group_id, qty: row.qty }));
  }
  const exclusive = channelHolds.reduce((sum, hold) => sum + hold.qty, 0) + groupHolds.reduce((sum, hold) => sum + hold.qty, 0);
  const sharedRemaining = capacity - reserved - exclusive;
  const members = input.target === "group"
    ? qall<{ channel_id: number }>("SELECT channel_id FROM dist_group_channels WHERE group_id = ?", input.targetId).map((row) => row.channel_id)
    : input.target === "channel" ? [input.targetId] : [];
  const sold = input.scope === "session" ? soldFor(sessionId, input.zoneId, members) : 0;
  const current = input.target === "reserved"
    ? reserved
    : input.target === "channel"
      ? channelHolds.find((hold) => hold.id === input.targetId)?.qty ?? 0
      : groupHolds.find((hold) => hold.id === input.targetId)?.qty ?? 0;
  let next = current;
  if (input.target !== "reserved" && input.mode === "共享") {
    if (sold > 0) return { ok: false, message: "这项已有售出，不能改回共享库存" };
    next = 0;
  } else {
    const message = validateStockDelta({ delta: input.delta, sharedRemaining, available: Math.max(current - sold, 0) });
    if (message) return { ok: false, message };
    next = current + input.delta;
  }
  if (next < sold) return { ok: false, message: "不能减到已售数量以下" };

  db.exec("BEGIN");
  try {
    if (input.scope === "template") {
      if (input.target === "reserved") db.prepare("UPDATE inventory_templates SET reserved = ? WHERE id = ?").run(next, templateId);
      else if (input.target === "channel") {
        db.prepare("DELETE FROM template_channel_holds WHERE template_id = ? AND channel_id = ?").run(templateId, input.targetId);
        if (next > 0) db.prepare("INSERT INTO template_channel_holds (template_id, channel_id, qty) VALUES (?, ?, ?)").run(templateId, input.targetId, next);
      } else {
        db.prepare("DELETE FROM template_group_holds WHERE template_id = ? AND group_id = ?").run(templateId, input.targetId);
        if (next > 0) db.prepare("INSERT INTO template_group_holds (template_id, group_id, qty) VALUES (?, ?, ?)").run(templateId, input.targetId, next);
      }
    } else if (input.target === "reserved") {
      db.prepare(
        `INSERT INTO session_zones (session_id, zone_id, reserved, template_name) VALUES (?, ?, ?, '')
         ON CONFLICT(session_id, zone_id) DO UPDATE SET reserved = excluded.reserved`,
      ).run(sessionId, input.zoneId, next);
    } else if (input.target === "channel") {
      db.prepare("DELETE FROM session_holds WHERE session_id = ? AND zone_id = ? AND channel_id = ?").run(sessionId, input.zoneId, input.targetId);
      if (next > 0) db.prepare("INSERT INTO session_holds (session_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)").run(sessionId, input.zoneId, input.targetId, next);
    } else {
      db.prepare("DELETE FROM session_group_holds WHERE session_id = ? AND zone_id = ? AND group_id = ?").run(sessionId, input.zoneId, input.targetId);
      if (next > 0) db.prepare("INSERT INTO session_group_holds (session_id, zone_id, group_id, qty) VALUES (?, ?, ?, ?)").run(sessionId, input.zoneId, input.targetId, next);
    }
    const summary = `${input.target === "reserved" ? "预留" : input.mode} ${current} → ${next}`;
    log(input.scope === "template" ? "分销库存模板" : "分销库存", String(input.scope === "template" ? templateId : sessionId), user.name, summary);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  if (input.scope === "template" && input.applyUnsold && input.templateId) {
    const template = qget<{ venue_id: number; zone_id: number; name: string; reserved: number }>("SELECT * FROM inventory_templates WHERE id = ?", input.templateId);
    if (template) {
      const sessions = qall<{ id: number }>("SELECT id FROM sessions WHERE venue_id = ?", template.venue_id);
      for (const session of sessions) {
        const used = qget<{ n: number }>(
          "SELECT COUNT(*) AS n FROM orders WHERE session_id = ? AND zone_id = ? AND status != '被取消'",
          session.id,
          template.zone_id,
        )?.n ?? 0;
        if (used > 0) continue;
        db.prepare("DELETE FROM session_holds WHERE session_id = ? AND zone_id = ?").run(session.id, template.zone_id);
        db.prepare("DELETE FROM session_group_holds WHERE session_id = ? AND zone_id = ?").run(session.id, template.zone_id);
        db.prepare(
          `INSERT INTO session_zones (session_id, zone_id, reserved, template_name) VALUES (?, ?, ?, ?)
           ON CONFLICT(session_id, zone_id) DO UPDATE SET reserved = excluded.reserved, template_name = excluded.template_name`,
        ).run(session.id, template.zone_id, template.reserved, template.name);
        const channels = qall<{ channel_id: number; qty: number }>("SELECT channel_id, qty FROM template_channel_holds WHERE template_id = ?", input.templateId);
        for (const hold of channels) db.prepare("INSERT INTO session_holds (session_id, zone_id, channel_id, qty) VALUES (?, ?, ?, ?)").run(session.id, template.zone_id, hold.channel_id, hold.qty);
        const groups = qall<{ group_id: number; qty: number }>("SELECT group_id, qty FROM template_group_holds WHERE template_id = ?", input.templateId);
        for (const hold of groups) db.prepare("INSERT INTO session_group_holds (session_id, zone_id, group_id, qty) VALUES (?, ?, ?, ?)").run(session.id, template.zone_id, hold.group_id, hold.qty);
      }
    }
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory-templates");
  if (input.templateId) revalidatePath(`/inventory-templates/${input.templateId}`);
  return { ok: true, message: input.applyUnsold ? "已保存，并套用到该分区还没有订单的场次" : "已保存。已有场次不会被静默改写。" };
}
