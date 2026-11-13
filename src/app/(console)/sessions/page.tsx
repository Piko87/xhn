import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { calendarBounds, listProducts, listSessions, listVenues, sessionRollup } from "@/lib/queries";
import { addDays, shanghaiNow, startOfWeek, WEEKDAY_LABELS } from "@/lib/time";
import { saveSession } from "@/server/show-actions";

function tone(label: string) {
  if (label === "售罄") return "gone";
  if (label === "少量") return "low";
  if (label === "紧张") return "tight";
  return "";
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; date?: string; view?: string }>;
}) {
  const user = await requireAccess("sessions", "read");
  const editable = can(user.access, "sessions", "write");
  const sp = await searchParams;
  const venues = listVenues();
  const venueId = Number(sp.venue || venues[0]?.id || 0);
  const view = sp.view || "week";
  const date = sp.date || shanghaiNow().date;
  const bounds = calendarBounds(view, date);
  const sessions = venueId ? listSessions(venueId, bounds.from, bounds.to) : [];
  const cards = sessions.map((session) => ({ ...session, rollup: sessionRollup(session) }));
  const products = listProducts("").filter((product) => product.venue_id === venueId);
  const weekStart = startOfWeek(date);
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">演出管理</p>
          <h1>场次日历</h1>
          <p className="sub">场次模式为时段。颜色表示剩余松紧，数字是已售和剩余。</p>
        </div>
      </header>
      <form className="filters" action="/sessions">
        <label className="field"><span>场馆</span>
          <select name="venue" defaultValue={venueId}>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select>
        </label>
        <label className="field"><span>场次模式</span><select name="mode" defaultValue="时段"><option>时段</option></select></label>
        <label className="field"><span>日期</span><input type="date" name="date" defaultValue={date} /></label>
        <input type="hidden" name="view" value={view} />
        <button className="btn" type="submit">查看</button>
        <Link className="btn" href={`/sessions?venue=${venueId}&date=${shanghaiNow().date}&view=week`}>本周</Link>
      </form>
      <div className="tabs">
        <Link className={view === "week" ? "on" : ""} href={`/sessions?venue=${venueId}&date=${date}&view=week`}>周</Link>
        <Link className={view === "month" ? "on" : ""} href={`/sessions?venue=${venueId}&date=${date}&view=month`}>月</Link>
        <Link className={view === "list" ? "on" : ""} href={`/sessions?venue=${venueId}&date=${date}&view=list`}>列表</Link>
        <Link className="btn small" href={`/sessions?venue=${venueId}&date=${addDays(date, view === "month" ? -30 : -7)}&view=${view}`}>上一页</Link>
        <Link className="btn small" href={`/sessions?venue=${venueId}&date=${addDays(date, view === "month" ? 30 : 7)}&view=${view}`}>下一页</Link>
      </div>
      {view === "list" ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>日期</th><th>场次</th><th>时间</th><th>产品</th><th>状态</th><th>预售天数</th><th>已售</th><th>剩余</th><th>对客</th><th></th></tr></thead>
            <tbody>
              {cards.map((session) => (
                <tr key={session.id}>
                  <td>{session.session_date}</td>
                  <td>{session.name}</td>
                  <td>{session.start_time}–{session.end_time}</td>
                  <td>{session.product_name}</td>
                  <td><span className={`badge ${statusTone(session.status)}`}>{session.status}</span></td>
                  <td>{session.presale_days}</td>
                  <td>{session.rollup.sold}</td>
                  <td>{session.rollup.available}</td>
                  <td>{session.rollup.label}</td>
                  <td><Link className="btn small" href={`/inventory?session=${session.id}`}>库存</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={view === "week" ? "week" : "month-grid"}>
          {Array.from({ length: view === "week" ? 7 : 42 }, (_, index) => {
            const day = addDays(view === "week" ? weekStart : bounds.from, index);
            const items = cards.filter((session) => session.session_date === day);
            return (
              <div key={day} className={`day-col ${day === shanghaiNow().date ? "today" : ""}`}>
                <header><span>{view === "week" ? `周${WEEKDAY_LABELS[index]}` : ""}</span><span>{day.slice(5)}</span></header>
                {items.map((session) => (
                  <Link key={session.id} href={`/inventory?session=${session.id}`} className={`session-card ${tone(session.rollup.label)}`}>
                    <b>{session.name} {session.start_time}</b>
                    <span>{session.product_name}</span>
                    <span>剩余 {session.rollup.available} · 已售 {session.rollup.sold}</span>
                    <span>对客 {session.rollup.label}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {editable ? (
        <ActionForm action={saveSession} className="card stack" >
          <h2>安排场次</h2>
          <input type="hidden" name="venue_id" value={venueId} />
          <div className="grid-3">
            <label className="field"><span>产品</span>
              <select name="product_id" defaultValue={products[0]?.id}>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label className="field"><span>名称</span><input name="name" defaultValue="晚场" /></label>
            <label className="field"><span>日期</span><input type="date" name="session_date" defaultValue={date} /></label>
            <label className="field"><span>开始</span><input name="start_time" defaultValue="19:30" placeholder="19:30" /></label>
            <label className="field"><span>结束</span><input name="end_time" defaultValue="21:40" placeholder="21:40" /></label>
            <label className="field"><span>预售天数</span><input type="number" name="presale_days" defaultValue={30} /></label>
            <label className="field"><span>状态</span>
              <select name="status" defaultValue="开售"><option>开售</option><option>停售</option></select>
            </label>
          </div>
          <p className="hint">新建后会套用场馆的默认预留和独立库存，然后进入分销库存页。</p>
          <button className="btn primary" type="submit">创建场次</button>
        </ActionForm>
      ) : null}
    </div>
  );
}
