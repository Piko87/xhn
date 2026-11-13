import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { yuan, statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { getOrder } from "@/lib/queries";
import { refundHint, withinVerifyWindow } from "@/lib/sale-rules";
import { addNote, requestRefund, resendVoucher, verifyOrder } from "@/server/order-actions";

function val(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? "");
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("orders", "read");
  const { id } = await params;
  const data = getOrder(Number(id));
  if (!data) notFound();
  const order = data.order;
  const status = val(order, "status");
  const inside = withinVerifyWindow({
    sessionDate: val(order, "session_date"),
    start: val(order, "start_time"),
    end: val(order, "end_time"),
    beforeMinutes: Number(order.verify_before_minutes || 0),
  });
  const pending = data.refunds.some((refund) => refund.status === "等待审核");
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">订单详情</p>
          <h1>{val(order, "order_no")}</h1>
          <p className="sub">{val(order, "product_name")} · {val(order, "ticket_name")}</p>
        </div>
        <Link className="btn" href={`/orders?date=${val(order, "session_date")}`}>返回明细</Link>
      </header>
      {!inside && status !== "被取消" ? (
        <p className="warn-box">当前不在建议验证时间（开演前 {String(order.verify_before_minutes)} 分钟至散场）。仍可人工验证，系统会写入备注。</p>
      ) : null}
      <div className="split">
        <section className="card">
          <h2>订单信息</h2>
          <dl className="defs">
            <dt>凭证码</dt><dd>{val(order, "voucher_code")}</dd>
            <dt>下单时间</dt><dd>{val(order, "created_at")}</dd>
            <dt>渠道</dt><dd>{val(order, "channel_name")}</dd>
            <dt>分销商</dt><dd>{val(order, "distributor_name") || "直销"}</dd>
            <dt>供应商</dt><dd>{val(order, "supplier_name")}</dd>
            <dt>售票员</dt><dd>{val(order, "seller_name")}</dd>
            <dt>取票人</dt><dd>{val(order, "buyer_name")}</dd>
            <dt>手机</dt><dd>{val(order, "buyer_phone")}</dd>
            <dt>证件</dt><dd>{val(order, "id_type")} {val(order, "id_no")}</dd>
            <dt>数量 / 金额</dt><dd>{val(order, "qty")} 张 · {yuan(Number(order.amount))}（单价 {yuan(Number(order.unit_price))}）</dd>
            <dt>支付</dt><dd><span className={`badge ${statusTone(val(order, "pay_status"))}`}>{val(order, "pay_status")}</span> {val(order, "pay_method")}</dd>
            <dt>票状态</dt><dd><span className={`badge ${statusTone(status)}`}>{status}</span> · 已验证 {val(order, "verified_count")}</dd>
            <dt>场馆 / 分区</dt><dd>{val(order, "venue_name")} / {val(order, "zone_name")}</dd>
            <dt>场次</dt><dd>{val(order, "session_date")} {val(order, "start_time")}–{val(order, "end_time")} {val(order, "session_name")}</dd>
            <dt>入场方式</dt><dd>{val(order, "entry_mode")}</dd>
          </dl>
          <h2 style={{ marginTop: 16 }}>座位与票码</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>票码</th><th>座位</th><th>状态</th><th></th></tr></thead>
              <tbody>
                {data.codes.map((code) => (
                  <tr key={code.id}>
                    <td>{code.code}</td>
                    <td>{code.seat_label}</td>
                    <td><span className={`badge ${statusTone(code.status)}`}>{code.status}</span></td>
                    <td>
                      {can(user.access, "verification", "write") && code.status === "未使用" ? (
                        <ActionForm action={verifyOrder}>
                          <input type="hidden" name="order_id" value={val(order, "id")} />
                          <input type="hidden" name="code_id" value={code.id} />
                          <button className="btn small" type="submit">验证</button>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="stack">
          <section className="card">
            <h2>订单备注</h2>
            {data.notes.length === 0 ? <p className="hint">暂无备注。</p> : null}
            {data.notes.map((note) => (
              <p key={note.id}><b>{note.author}</b> <span className="note">{note.created_at}</span><br />{note.content}</p>
            ))}
            {can(user.access, "notes", "write") ? (
              <ActionForm action={addNote} className="stack">
                <input type="hidden" name="order_id" value={val(order, "id")} />
                <label className="field"><span>新增备注</span><textarea name="content" /></label>
                <button className="btn" type="submit">保存备注</button>
              </ActionForm>
            ) : null}
          </section>
          <section className="card stack">
            <h2>客服操作</h2>
            <p className="hint">退改规则：{refundHint({
              refund_mode: val(order, "refund_mode"),
              refund_days: Number(order.refund_days || 0),
              refund_audit: Number(order.refund_audit || 0),
              pickup_refund: val(order, "pickup_refund"),
            })}</p>
            {can(user.access, "verification", "write") && status !== "被取消" && status !== "已使用" ? (
              <ActionForm action={verifyOrder}>
                <input type="hidden" name="order_id" value={val(order, "id")} />
                <button className="btn primary" type="submit">整单验证</button>
              </ActionForm>
            ) : null}
            {status !== "被取消" ? (
              <ActionForm action={resendVoucher}>
                <input type="hidden" name="order_id" value={val(order, "id")} />
                <button className="btn" type="submit">重发凭证</button>
              </ActionForm>
            ) : null}
            {data.resends[0] ? <p className="note">最近登记重发：{data.resends[0].created_at} · {data.resends[0].channel}</p> : null}
            {can(user.access, "refunds", "write") && !pending && status !== "被取消" ? (
              <ActionForm action={requestRefund} className="stack">
                <input type="hidden" name="order_id" value={val(order, "id")} />
                <label className="field"><span>退票理由</span><textarea name="reason" placeholder="行程变更" /></label>
                <button className="btn danger" type="submit">发起退票审核</button>
              </ActionForm>
            ) : null}
            {pending ? <p className="warn-box">已有退票正在等待审核。<Link href="/refunds?status=等待审核">去处理</Link></p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
