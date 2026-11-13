import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { InventoryBoard } from "@/components/inventory-board";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { getSession, listChannels, plain, qall, qget } from "@/lib/queries";
import { advanceText } from "@/lib/sale-rules";
import { deleteSession, saveSession } from "@/server/show-actions";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const user = await requireAccess("inventory", "read");
  const editable = can(user.access, "inventory", "write");
  const windowEditable = can(user.access, "sale_windows", "write");
  const sp = await searchParams;
  const fallback = qget<{ id: number }>(
    "SELECT id FROM sessions WHERE session_date = '2026-11-15' AND start_time = '19:30' AND product_id = 1",
  );
  const data = getSession(Number(sp.session || fallback?.id || 0));
  if (!data) {
    return (
      <div className="card">
        <h1>还没有场次</h1>
        <Link href="/sessions">去场次日历</Link>
      </div>
    );
  }
  const { session, zones, tickets } = data;
  const sessions = qall<{ id: number; label: string }>(
    `SELECT s.id, s.session_date || ' ' || s.start_time || ' ' || s.name || ' · ' || p.name AS label
     FROM sessions s JOIN products p ON p.id = s.product_id
     WHERE s.venue_id = ? ORDER BY s.session_date, s.start_time`,
    session.venue_id,
  );
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{session.venue_name}</p>
          <h1>分销库存 · {session.product_name}</h1>
          <p className="sub">{session.session_date} {session.start_time}–{session.end_time} {session.name}。镜厅池座和侧厢给企业团购留了独立库存，其余渠道共用共享池。</p>
        </div>
      </header>
      <form className="filters" action="/inventory">
        <label className="field"><span>场次</span>
          <select name="session" defaultValue={session.id}>
            {sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button className="btn" type="submit">打开</button>
        <Link className="btn" href={`/sessions?venue=${session.venue_id}&date=${session.session_date}`}>返回日历</Link>
      </form>
      <section className="card" style={{ marginBottom: 14 }}>
        <h2>开售窗口</h2>
        <ActionForm action={saveSession} className="grid-3">
          <input type="hidden" name="id" value={session.id} />
          <input type="hidden" name="venue_id" value={session.venue_id} />
          <input type="hidden" name="product_id" value={session.product_id} />
          <label className="field"><span>场次名称</span><input name="name" defaultValue={session.name} disabled={!windowEditable} /></label>
          <label className="field"><span>日期</span><input type="date" name="session_date" defaultValue={session.session_date} disabled={!windowEditable} /></label>
          <label className="field"><span>开始</span><input name="start_time" defaultValue={session.start_time} disabled={!windowEditable} /></label>
          <label className="field"><span>结束</span><input name="end_time" defaultValue={session.end_time} disabled={!windowEditable} /></label>
          <label className="field"><span>预售天数</span><input type="number" name="presale_days" defaultValue={session.presale_days} disabled={!windowEditable} /></label>
          <label className="field"><span>场次状态</span>
            <select name="status" defaultValue={session.status} disabled={!windowEditable}><option>开售</option><option>停售</option></select>
          </label>
          {windowEditable ? <button className="btn" type="submit">保存开售窗口</button> : null}
        </ActionForm>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>票类</th><th>分区</th><th>预订时间段</th><th>提前预订</th><th>限时售卖</th><th>上下架</th></tr></thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td><Link href={`/tickets/${ticket.id}`}>{ticket.name}</Link></td>
                  <td>{ticket.zone_name}</td>
                  <td>{ticket.summary.booking}</td>
                  <td>{advanceText(ticket.input.advance_mode, ticket.input.advance_value)}</td>
                  <td>{ticket.summary.timed}</td>
                  <td>{ticket.summary.shelf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can(user.access, "sessions", "write") ? (
          <ActionForm action={deleteSession}>
            <input type="hidden" name="id" value={session.id} />
            <button className="btn danger small" type="submit">删除没有订单的场次</button>
          </ActionForm>
        ) : null}
      </section>
      <InventoryBoard
        sessionId={session.id}
        editable={editable}
        channels={plain(listChannels())}
        venue={{ display_mode: session.display_mode, fuzzy_ample: session.fuzzy_ample, fuzzy_tight: session.fuzzy_tight }}
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          color: zone.color,
          capacity: zone.capacity,
          unsellable: zone.unsellable,
          reserved: zone.reserved,
          holds: zone.holds,
          sharedPool: zone.sharedPool,
          sharedSold: zone.sharedSold,
          sharedRemaining: zone.sharedRemaining,
          available: zone.available,
          sold: zone.sold,
        }))}
      />
    </div>
  );
}
