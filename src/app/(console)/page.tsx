import Link from "next/link";
import { redirect } from "next/navigation";
import { NAV } from "@/lib/constants";
import { can } from "@/lib/auth";
import { yuan, statusTone } from "@/lib/format";
import { requireUser } from "@/lib/guard";
import { dashboard } from "@/lib/queries";

export default async function OverviewPage() {
  const user = await requireUser();
  if (!can(user.access, "overview", "read")) {
    const first = NAV.flatMap((group) => group.items).find((item) => user.access[item.module] !== "none");
    redirect(first?.href ?? "/forbidden");
  }
  const data = dashboard();
  const readable = NAV.flatMap((group) => group.items).filter((item) => user.access[item.module] !== "none");
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">工作台</p>
          <h1>{user.name}，今天是 {data.now.date}</h1>
          <p className="sub">你以「{user.role_name}」进入。菜单只显示被授权的模块，权限在角色页调整后重新登录即可生效。</p>
        </div>
      </header>
      <div className="grid-4">
        <article className="card stat"><span>今日场次</span><b>{data.sessions.length}</b></article>
        <article className="card stat"><span>今日订单</span><b>{data.todayOrders}</b></article>
        <article className="card stat"><span>待审退票</span><b>{data.waiting}</b></article>
        <article className="card stat"><span>近 7 日实售</span><b>{data.weekQty} 张 · {yuan(data.weekAmount)}</b></article>
      </div>
      <section className="card">
        <h2>今日场次</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>时间</th><th>场馆</th><th>产品</th><th>场次</th><th>已售</th><th>剩余</th><th>对客显示</th></tr></thead>
            <tbody>
              {data.sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.start_time}–{session.end_time}</td>
                  <td>{session.venue_name}</td>
                  <td>{session.product_name}</td>
                  <td>{session.name}</td>
                  <td>{session.rollup.sold}</td>
                  <td>{session.rollup.available}</td>
                  <td><span className={`badge ${statusTone(session.rollup.label)}`}>{session.rollup.label}</span></td>
                </tr>
              ))}
              {data.sessions.length === 0 ? <tr><td colSpan={7}>今天没有场次。</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>当前角色可进入</h2>
        <div className="actions">
          {readable.map((item) => <Link key={item.href} className="btn" href={item.href}>{item.label}</Link>)}
        </div>
      </section>
    </div>
  );
}
