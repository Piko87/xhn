import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { listOrders, listVenues, saleFormOptions } from "@/lib/queries";
import { shanghaiNow } from "@/lib/time";
import { createOrder } from "@/server/order-actions";

const STATUSES = ["", "未使用", "已使用", "部分使用", "被取消", "待确认"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string; venue?: string }>;
}) {
  const user = await requireAccess("orders", "read");
  const writable = can(user.access, "orders", "write");
  const sp = await searchParams;
  const date = sp.date === undefined ? shanghaiNow().date : sp.date;
  const orders = listOrders({
    date: date || undefined,
    status: sp.status || undefined,
    keyword: sp.q || undefined,
    venueId: sp.venue ? Number(sp.venue) : undefined,
  });
  const options = saleFormOptions();
  const venues = listVenues();
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">演出管理</p>
          <h1>订单明细</h1>
          <p className="sub">按场次日期查看座位、票状态和取票人。补录会校验开售窗口、渠道资格和分区库存。</p>
        </div>
      </header>
      <form className="filters" action="/orders">
        <label className="field"><span>场次日期</span><input type="date" name="date" defaultValue={date} /></label>
        <label className="field"><span>场馆</span>
          <select name="venue" defaultValue={sp.venue || ""}>
            <option value="">全部</option>
            {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
        </label>
        <label className="field"><span>状态</span>
          <select name="status" defaultValue={sp.status || ""}>
            {STATUSES.map((status) => <option key={status || "all"} value={status}>{status || "全部"}</option>)}
          </select>
        </label>
        <label className="field"><span>订单号 / 姓名 / 手机</span><input name="q" defaultValue={sp.q || ""} /></label>
        <button className="btn" type="submit">查询</button>
        <Link className="btn" href="/orders?date=2026-11-15">11 月 15 日晚场</Link>
        <Link className="btn" href="/orders?date=">全部日期</Link>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>场次日期</th><th>场次时间</th><th>订单号</th><th>产品及票种</th><th>数量</th><th>状态</th><th>取票人</th><th>手机</th><th>下单时间</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.session_date}</td>
                <td>{order.start_time}–{order.end_time} {order.session_name}</td>
                <td>{order.order_no}</td>
                <td>{order.product_name}<div className="note">{order.ticket_name} · {order.zone_name} · {order.channel_name}</div></td>
                <td>{order.qty}</td>
                <td><span className={`badge ${statusTone(order.status)}`}>{order.status}</span></td>
                <td>{order.buyer_name}</td>
                <td>{order.buyer_phone}</td>
                <td>{order.created_at}</td>
                <td><Link className="btn small" href={`/orders/${order.id}`}>查看</Link></td>
              </tr>
            ))}
            {orders.length === 0 ? <tr><td colSpan={10}>这个条件下没有订单。</td></tr> : null}
          </tbody>
        </table>
      </div>
      {writable ? (
        <ActionForm action={createOrder} className="card stack">
          <h2>补录订单</h2>
          <div className="grid-3">
            <label className="field"><span>场次</span>
              <select name="session_id" defaultValue={options.sessions[0]?.id}>
                {options.sessions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}
              </select>
            </label>
            <label className="field"><span>票类</span>
              <select name="ticket_id" defaultValue={options.tickets[0]?.id}>
                {options.tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.name}</option>)}
              </select>
            </label>
            <label className="field"><span>渠道</span>
              <select name="channel_id" defaultValue={options.channels[0]?.id}>
                {options.channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.kind} · {channel.name}</option>)}
              </select>
            </label>
            <label className="field"><span>数量</span><input name="qty" type="number" defaultValue={1} /></label>
            <label className="field"><span>支付方式</span>
              <select name="pay_method" defaultValue="微信支付">
                {["微信支付", "支付宝", "窗口现金", "对公转账"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field"><span>取票人</span><input name="buyer_name" placeholder="演示姓名" /></label>
            <label className="field"><span>手机</span><input name="buyer_phone" placeholder="13800001099" /></label>
            <label className="field"><span>证件号</span><input name="id_no" placeholder="演示证件-00099" /></label>
            <label className="field"><span>座位号</span><input name="seats" placeholder="池座 8排1号、池座 8排2号" /></label>
          </div>
          <p className="hint">按号入座时，座位号数量要和张数一致，用顿号分隔。企业团购走独立库存，其他已开通渠道走共享池。</p>
          <button className="btn primary" type="submit">提交补录</button>
        </ActionForm>
      ) : null}
    </div>
  );
}
