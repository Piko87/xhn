"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireAccess, requireUser } from "@/lib/guard";
import {
  channelInventoryRemaining,
  getTicket,
  phoneTicketCount,
  qget,
  soldCounters,
} from "@/lib/queries";
import { evaluateSale, refundHint, withinVerifyWindow } from "@/lib/sale-rules";
import { shanghaiNow } from "@/lib/time";
import type { ActionState } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function stamp() {
  const now = shanghaiNow();
  return `${now.date} ${now.time}`;
}

export async function createOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("orders", "write");
  const sessionId = Number(formData.get("session_id") || 0);
  const ticketId = Number(formData.get("ticket_id") || 0);
  const channelId = Number(formData.get("channel_id") || 0);
  const qty = Number(formData.get("qty") || 0);
  const buyer = text(formData, "buyer_name");
  const phone = text(formData, "buyer_phone");
  const idNo = text(formData, "id_no");
  const seats = text(formData, "seats");
  const payMethod = text(formData, "pay_method") || "微信支付";
  const ticket = getTicket(ticketId);
  const session = qget<{
    id: number;
    product_id: number;
    venue_id: number;
    session_date: string;
    start_time: string;
    end_time: string;
    status: string;
    presale_days: number;
  }>("SELECT * FROM sessions WHERE id = ?", sessionId);
  const channel = qget<{ id: number; kind: string; distributor_id: number | null; name: string }>("SELECT * FROM channels WHERE id = ?", channelId);
  if (!ticket || !session || !channel) return { ok: false, message: "请选择场次、票类和渠道" };
  if (session.product_id !== ticket.product_id) return { ok: false, message: "票类不属于该场次的产品" };
  if (ticket.input.zone_id && session.venue_id !== ticket.venue_id) return { ok: false, message: "票类分区不属于该场馆" };
  const direct = qget<{ enabled: number }>("SELECT enabled FROM channel_switches WHERE ticket_id = ? AND channel_id = ?", ticketId, channelId);
  const dist = channel.distributor_id
    ? qget<{ enabled: number; settlement: number }>(
        "SELECT enabled, settlement FROM dist_prices WHERE ticket_id = ? AND distributor_id = ?",
        ticketId,
        channel.distributor_id,
      )
    : undefined;
  const priceDay = qget<{ stop_sale: number; daily_stock: number; retail_price: number }>(
    "SELECT stop_sale, daily_stock, retail_price FROM price_days WHERE ticket_id = ? AND day = ?",
    ticketId,
    session.session_date,
  );
  const counters = soldCounters(ticketId, session.session_date);
  const settlementDay = channel.distributor_id
    ? qget<{ price: number }>(
        "SELECT price FROM settlement_days WHERE ticket_id = ? AND distributor_id = ? AND day = ?",
        ticketId,
        channel.distributor_id,
        session.session_date,
      )
    : undefined;
  const unit = channel.kind === "分销" ? (settlementDay?.price ?? dist?.settlement ?? ticket.input.retail_price) : (priceDay?.retail_price ?? ticket.input.retail_price);
  const check = evaluateSale({
    ticket: { ...ticket.input, id: ticketId },
    session,
    channel,
    directEnabled: !!direct?.enabled,
    distEnabled: !!dist?.enabled,
    qty,
    buyerName: buyer,
    buyerPhone: phone,
    idNo,
    seatText: seats,
    priceDay,
    soldToday: counters.soldToday,
    soldTotal: counters.soldTotal,
    phoneTicketsInWindow: phoneTicketCount(phone, ticketId, ticket.input.limit_days),
    inventoryRemaining: channelInventoryRemaining(sessionId, session.venue_id, ticket.input.zone_id, channelId),
  });
  if (!check.ok) return { ok: false, message: check.reasons.join("；") };
  const db = getDb();
  const count = qget<{ n: number }>("SELECT COUNT(*) AS n FROM orders")?.n ?? 0;
  const orderNo = `XH${session.session_date.replaceAll("-", "")}${String(count + 1).padStart(3, "0")}`;
  const labels = ticket.input.seating_mode === "按号入座" ? seats.split(/[、,，\s]+/).filter(Boolean) : Array.from({ length: qty }, () => "自由入座");
  const info = db
    .prepare(
      `INSERT INTO orders (
        order_no, product_id, ticket_id, session_id, zone_id, channel_id, distributor_id, qty, status, pay_status, pay_method,
        buyer_name, buyer_phone, id_type, id_no, amount, unit_price, verified_count, seller_name, supplier_name, voucher_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '未使用', '已支付', ?, ?, ?, '其他', ?, ?, ?, 0, ?, '江城大剧院票务（演示）', ?, ?)`,
    )
    .run(
      orderNo,
      ticket.product_id,
      ticketId,
      sessionId,
      ticket.input.zone_id,
      channelId,
      channel.distributor_id,
      qty,
      payMethod,
      buyer,
      phone,
      idNo || `演示证件-${String(count + 40).padStart(5, "0")}`,
      unit * qty,
      unit,
      user.name,
      `VX${orderNo.slice(-6)}`,
      stamp(),
    );
  const orderId = Number(info.lastInsertRowid);
  labels.forEach((label, index) => {
    db.prepare("INSERT INTO ticket_codes (order_id, code, seat_label, status) VALUES (?, ?, ?, '未使用')").run(
      orderId,
      `TP${orderNo.slice(2)}${String(index + 1).padStart(2, "0")}`,
      label,
    );
  });
  revalidatePath("/orders");
  revalidatePath("/inventory");
  revalidatePath("/reports");
  redirect(`/orders/${orderId}`);
}

function refreshOrderStatus(orderId: number) {
  const db = getDb();
  const codes = db.prepare("SELECT status FROM ticket_codes WHERE order_id = ?").all(orderId) as { status: string }[];
  const used = codes.filter((code) => code.status === "已使用").length;
  let status = "未使用";
  if (codes.every((code) => code.status === "被取消")) status = "被取消";
  else if (used === codes.length && used > 0) status = "已使用";
  else if (used > 0) status = "部分使用";
  else if (codes.some((code) => code.status === "待确认")) status = "待确认";
  db.prepare("UPDATE orders SET status = ?, verified_count = ? WHERE id = ?").run(status, used, orderId);
}

export async function verifyOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("verification", "write");
  const orderId = Number(formData.get("order_id"));
  const codeId = Number(formData.get("code_id") || 0);
  const order = qget<{ status: string; session_date: string; start_time: string; end_time: string; verify_before_minutes: number }>(
    `SELECT o.status, s.session_date, s.start_time, s.end_time, t.verify_before_minutes
     FROM orders o JOIN sessions s ON s.id = o.session_id JOIN tickets t ON t.id = o.ticket_id WHERE o.id = ?`,
    orderId,
  );
  if (!order) return { ok: false, message: "订单不存在" };
  if (order.status === "被取消") return { ok: false, message: "已取消的订单不能验证" };
  const db = getDb();
  if (codeId) {
    db.prepare("UPDATE ticket_codes SET status = '已使用' WHERE id = ? AND order_id = ? AND status != '被取消'").run(codeId, orderId);
  } else {
    db.prepare("UPDATE ticket_codes SET status = '已使用' WHERE order_id = ? AND status NOT IN ('被取消')").run(orderId);
  }
  refreshOrderStatus(orderId);
  const inside = withinVerifyWindow({
    sessionDate: order.session_date,
    start: order.start_time,
    end: order.end_time,
    beforeMinutes: order.verify_before_minutes,
  });
  if (!inside) {
    db.prepare("INSERT INTO order_notes (order_id, author, content, created_at) VALUES (?, ?, ?, ?)").run(
      orderId,
      user.name,
      `人工验证。操作时不在建议验证时间内（开演前 ${order.verify_before_minutes} 分钟至散场）。`,
      stamp(),
    );
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, message: inside ? "已验证" : "已人工验证，并记入备注：当前不在建议验证时间" };
}

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("notes", "write");
  const orderId = Number(formData.get("order_id"));
  const content = text(formData, "content");
  if (!content) return { ok: false, message: "请填写备注" };
  getDb().prepare("INSERT INTO order_notes (order_id, author, content, created_at) VALUES (?, ?, ?, ?)").run(orderId, user.name, content, stamp());
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "备注已保存" };
}

export async function resendVoucher(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.access, "orders", "write")) return { ok: false, message: "没有订单操作权限" };
  const orderId = Number(formData.get("order_id"));
  const order = qget<{ status: string }>("SELECT status FROM orders WHERE id = ?", orderId);
  if (!order) return { ok: false, message: "订单不存在" };
  if (order.status === "被取消") return { ok: false, message: "已取消的订单不能重发" };
  const db = getDb();
  db.prepare("INSERT INTO resend_logs (order_id, actor, created_at, channel) VALUES (?, ?, ?, '短信（未接通）')").run(orderId, user.name, stamp());
  db.prepare("INSERT INTO order_notes (order_id, author, content, created_at) VALUES (?, ?, ?, ?)").run(
    orderId,
    user.name,
    "已登记重发凭证。短信通道未接通，只写入本地记录。",
    stamp(),
  );
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "已登记重发。短信未实际发送。" };
}

export async function requestRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("refunds", "write");
  const orderId = Number(formData.get("order_id"));
  const reason = text(formData, "reason");
  if (!reason) return { ok: false, message: "请填写申请理由" };
  const order = qget<{ status: string; qty: number; buyer_name: string; refund_mode: string; refund_days: number; refund_audit: number; pickup_refund: string }>(
    `SELECT o.status, o.qty, o.buyer_name, t.refund_mode, t.refund_days, t.refund_audit, t.pickup_refund
     FROM orders o JOIN tickets t ON t.id = o.ticket_id WHERE o.id = ?`,
    orderId,
  );
  if (!order) return { ok: false, message: "订单不存在" };
  if (order.status === "被取消") return { ok: false, message: "订单已取消" };
  const pending = qget<{ n: number }>("SELECT COUNT(*) AS n FROM refunds WHERE order_id = ? AND status = '等待审核'", orderId);
  if ((pending?.n ?? 0) > 0) return { ok: false, message: "已有等待审核的退票" };
  const count = qget<{ n: number }>("SELECT COUNT(*) AS n FROM refunds")?.n ?? 0;
  getDb()
    .prepare(
      `INSERT INTO refunds (order_id, change_type, after_qty, applicant, applied_at, reason, refund_serial, status, flow_code, reviewer, reviewed_at, review_note)
       VALUES (?, '退票', 0, ?, ?, ?, '', '等待审核', ?, '', '', ?)`,
    )
    .run(orderId, user.name, stamp(), reason, `FL-${String(7000 + count)}`, `规则提示：${refundHint(order)}`);
  revalidatePath("/refunds");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "已提交退票审核" };
}

export async function reviewRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccess("refunds", "write");
  const id = Number(formData.get("id"));
  const decision = text(formData, "decision");
  const note = text(formData, "review_note");
  const refund = qget<{ id: number; order_id: number; status: string }>("SELECT * FROM refunds WHERE id = ?", id);
  if (!refund) return { ok: false, message: "审核单不存在" };
  if (refund.status !== "等待审核") return { ok: false, message: "该单已审核" };
  if (decision !== "同意" && decision !== "拒绝") return { ok: false, message: "请选择同意或拒绝" };
  const db = getDb();
  const serial = decision === "同意" ? `RF${stamp().replace(/\D/g, "").slice(0, 12)}` : "";
  db.prepare(
    "UPDATE refunds SET status = ?, reviewer = ?, reviewed_at = ?, review_note = ?, refund_serial = ? WHERE id = ?",
  ).run(decision, user.name, stamp(), note, serial, id);
  if (decision === "同意") {
    db.prepare("UPDATE orders SET status = '被取消', pay_status = '已退款', verified_count = 0 WHERE id = ?").run(refund.order_id);
    db.prepare("UPDATE ticket_codes SET status = '被取消' WHERE order_id = ?").run(refund.order_id);
    db.prepare("INSERT INTO order_notes (order_id, author, content, created_at) VALUES (?, ?, ?, ?)").run(
      refund.order_id,
      user.name,
      `退票审核同意。${note || "库存已释放。"}`,
      stamp(),
    );
  }
  revalidatePath("/refunds");
  revalidatePath(`/orders/${refund.order_id}`);
  revalidatePath("/inventory");
  revalidatePath("/reports");
  return { ok: true, message: decision === "同意" ? "已同意退票，订单改为被取消" : "已拒绝退票" };
}
