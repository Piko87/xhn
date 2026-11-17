import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AllocationPanel } from "@/components/allocation-panel";
import { can } from "@/lib/auth";
import { isOccupying } from "@/lib/inventory";
import { requireAccess } from "@/lib/guard";
import { getSession, listChannels, listGroups, listLogs, listVenues, qall, qget, sessionOrders } from "@/lib/queries";
import { advanceText } from "@/lib/sale-rules";
import { deleteSession, saveSession } from "@/server/show-actions";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ session?: string; venue?: string; zone?: string; date?: string }> }) {
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
        <label className="field"><span>场馆</span>
          <select name="venue" defaultValue={session.venue_id}>{listVenues().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="field"><span>日期</span><input type="date" name="date" defaultValue={session.session_date} /></label>
        <label className="field"><span>场次</span>
          <select name="session" defaultValue={session.id}>
            {sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="field"><span>分区</span>
          <select name="zone" defaultValue={sp.zone || zones[0]?.id}>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>
        </label>
        <button className="btn" type="submit">打开</button>
        <Link className="btn" href={`/sessions?venue=${session.venue_id}&date=${session.session_date}`}>返回日历</Link>
        <Link className="btn" href={`/inventory-templates?venue=${session.venue_id}`}>模板</Link>
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
      {zones.filter((zone) => !sp.zone || String(zone.id) === sp.zone).map((zone) => {
        const channels = listChannels();
        const groups = listGroups();
        const orders = sessionOrders(session.id).filter((order) => order.zone_id === zone.id && isOccupying(order.status));
        const soldOf = (ids: number[]) => orders.filter((order) => ids.includes(order.channel_id)).reduce((sum, order) => sum + order.qty, 0);
        const grouped = new Set(groups.flatMap((group) => group.channelIds));
        const rows = [
          { key: "reserved", label: "预留", target: "reserved" as const, targetId: 0, mode: "预留" as const, qty: zone.reserved, sold: 0, available: zone.reserved },
          ...channels.filter((channel) => channel.kind === "直销").map((channel) => {
            const hold = zone.holds.find((item) => item.channelId === channel.id);
            const sold = soldOf([channel.id]);
            return { key: `c${channel.id}`, label: `直销 · ${channel.name}`, target: "channel" as const, targetId: channel.id, mode: hold ? "独立" as const : "共享" as const, qty: hold?.qty ?? 0, sold, available: hold ? hold.remaining : zone.sharedRemaining };
          }),
          ...groups.map((group) => {
            const hold = zone.groupHolds.find((item) => item.groupId === group.id);
            const names = channels.filter((channel) => group.channelIds.includes(channel.id)).map((channel) => channel.name).join("、");
            return { key: `g${group.id}`, label: `分组 · ${group.name}${names ? `（${names}）` : ""}`, target: "group" as const, targetId: group.id, mode: hold ? "独立" as const : "共享" as const, qty: hold?.qty ?? 0, sold: hold?.sold ?? soldOf(group.channelIds), available: hold ? hold.remaining : zone.sharedRemaining };
          }),
          ...channels.filter((channel) => channel.kind === "分销" && !grouped.has(channel.id)).map((channel) => {
            const hold = zone.holds.find((item) => item.channelId === channel.id);
            const sold = soldOf([channel.id]);
            return { key: `d${channel.id}`, label: `未分组 · ${channel.name}`, target: "channel" as const, targetId: channel.id, mode: hold ? "独立" as const : "共享" as const, qty: hold?.qty ?? 0, sold, available: hold ? hold.remaining : zone.sharedRemaining };
          }),
        ];
        return (
          <section className="card" key={zone.id}>
            <h2><i className="swatch" style={{ background: zone.color }} /> {zone.name}</h2>
            <p className="hint">{zone.templateName ? `已套用默认模板「${zone.templateName}」。` : "这场次创建时没有默认模板。"} 在这里调整只影响本场。</p>
            <AllocationPanel
              scope="session"
              sessionId={session.id}
              zoneId={zone.id}
              capacity={zone.capacity}
              unsellable={zone.unsellable}
              reserved={zone.reserved}
              exclusive={zone.holds.reduce((sum, hold) => sum + hold.qty, 0) + zone.groupHolds.reduce((sum, hold) => sum + hold.qty, 0)}
              shared={zone.sharedPool}
              sharedRemaining={zone.sharedRemaining}
              rows={rows}
              venue={{ display_mode: session.display_mode, fuzzy_ample: session.fuzzy_ample, fuzzy_tight: session.fuzzy_tight }}
              editable={editable}
            />
          </section>
        );
      })}
      <section className="card">
        <h2>操作记录</h2>
        {listLogs("分销库存", String(session.id)).map((item) => <p key={item.id}><b>{item.actor}</b> <span className="note">{item.created_at}</span> {item.summary}</p>)}
        {listLogs("分销库存", String(session.id)).length === 0 ? <p className="hint">本场还没有库存调整记录。新建时已按默认模板写入。</p> : null}
      </section>
    </div>
  );
}
