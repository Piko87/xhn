import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { listRefunds } from "@/lib/queries";
import { reviewRefund } from "@/server/order-actions";

const BUCKETS = ["", "等待审核", "同意", "拒绝"];

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ status?: string; tab?: string }> }) {
  const user = await requireAccess("refunds", "read");
  const editable = can(user.access, "refunds", "write");
  const sp = await searchParams;
  const tab = sp.tab || "refund";
  const status = sp.status ?? "等待审核";
  const rows = tab === "refund" ? listRefunds(status) : [];
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">订单</p>
          <h1>退票审核</h1>
          <p className="sub">同意后订单变为被取消，支付状态改为已退款，座位库存释放。拒绝不改订单。</p>
        </div>
      </header>
      <div className="tabs">
        <Link className={tab === "refund" ? "on" : ""} href="/refunds?tab=refund">退票审核</Link>
        <Link className={tab === "return" ? "on" : ""} href="/refunds?tab=return">退货审核</Link>
      </div>
      {tab === "return" ? (
        <section className="card">
          <h2>退货审核未启用</h2>
          <p>一期只有剧场演出退票，没有实物退货。</p>
        </section>
      ) : (
        <>
          <div className="tabs">
            {BUCKETS.map((bucket) => (
              <Link key={bucket || "all"} className={status === bucket ? "on" : ""} href={`/refunds?status=${encodeURIComponent(bucket)}`}>
                {bucket || "全部"}
              </Link>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>订单号</th><th>产品门票</th><th>变更类型</th><th>变更后票数</th><th>申请人</th><th>申请时间</th><th>申请理由</th><th>退款流水号</th><th>状态</th><th>流程编码</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><Link href={`/orders/${row.order_id}`}>{row.order_no}</Link></td>
                    <td>{row.product_name}<div className="note">{row.ticket_name} · 原 {row.qty} 张</div></td>
                    <td>{row.change_type}</td>
                    <td>{row.after_qty}</td>
                    <td>{row.applicant}</td>
                    <td>{row.applied_at}</td>
                    <td>{row.reason}</td>
                    <td>{row.refund_serial || "—"}</td>
                    <td><span className={`badge ${statusTone(row.status)}`}>{row.status}</span></td>
                    <td>{row.flow_code}</td>
                    <td>
                      {editable && row.status === "等待审核" ? (
                        <ActionForm action={reviewRefund} className="stack">
                          <input type="hidden" name="id" value={row.id} />
                          <input name="review_note" placeholder="审核说明" />
                          <div className="choice-row">
                            <label className="choice"><input type="radio" name="decision" value="同意" required /> 同意</label>
                            <label className="choice"><input type="radio" name="decision" value="拒绝" /> 拒绝</label>
                          </div>
                          <button className="btn small primary" type="submit">提交审核</button>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={11}>没有符合条件的审核单。</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
