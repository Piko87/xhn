import Link from "next/link";
import { can } from "@/lib/auth";
import { yuan, statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { listProducts } from "@/lib/queries";
import { addTicket } from "@/server/catalog-actions";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const user = await requireAccess("products", "read");
  const canTickets = can(user.access, "ticket_rules", "write");
  const sp = await searchParams;
  const products = listProducts(sp.q ?? "");
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">产品</p>
          <h1>出售中产品</h1>
          <p className="sub">本期只有剧场演出。票价在票类上，不写在座位图里。</p>
        </div>
        <Link className="btn primary" href="/products/new">新建演出</Link>
      </header>
      <form className="filters" action="/products">
        <label className="field"><span>产品类型</span>
          <select name="type" defaultValue="演出"><option>演出</option></select>
        </label>
        <label className="field"><span>名称或编号</span><input name="q" defaultValue={sp.q ?? ""} placeholder="江城夜航" /></label>
        <button className="btn" type="submit">查询</button>
      </form>
      <div className="stack">
        {products.map((product) => (
          <article className="card product" key={product.id}>
            <div className="cover" style={{ background: `linear-gradient(160deg, hsl(${product.hue} 58% 42%), hsl(${(product.hue + 28) % 360} 32% 20%))` }}>{product.name.replace(/[《》]/g, "").slice(0, 4)}</div>
            <div>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>{product.name}</h2>
                  <div className="meta">
                    <span>{product.code}</span>
                    <span>{product.area}</span>
                    <span>终端 {product.terminal_no}</span>
                    <span>{product.address}</span>
                    <span>发布 {product.published_at}</span>
                  </div>
                  {product.remark ? <p className="hint">{product.remark}</p> : null}
                </div>
              </div>
              <div className="actions" style={{ margin: "8px 0 12px" }}>
                <Link className="btn small" href={`/products/${product.id}`}>预览</Link>
                <Link className="btn small" href={`/products/${product.id}/edit`}>编辑产品</Link>
                {product.venue_id ? <Link className="btn small" href={`/venues/${product.venue_id}`}>场馆管理</Link> : null}
                {product.venue_id ? <Link className="btn small" href={`/sessions?venue=${product.venue_id}`}>场次管理</Link> : null}
                <Link className="btn small" href="/inventory">分销库存</Link>
                {product.tickets[0] ? <Link className="btn small" href={`/tickets/${product.tickets[0].id}/calendar`}>价格设置</Link> : null}
                {canTickets ? (
                  <form action={addTicket}>
                    <input type="hidden" name="product_id" value={product.id} />
                    <button className="btn small" type="submit">添加票类</button>
                  </form>
                ) : null}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>票 ID</th><th>票名称</th><th>分区</th><th>成本 / 零售 / 窗口 / 门市</th><th>到期</th><th>状态</th><th></th></tr>
                  </thead>
                  <tbody>
                    {product.tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>{ticket.code}</td>
                        <td>{ticket.name}</td>
                        <td>{ticket.zone_name}</td>
                        <td>{yuan(ticket.cost_price)} / {yuan(ticket.retail_price)} / {yuan(ticket.window_price)} / {yuan(ticket.gate_price)}</td>
                        <td>{ticket.book_end}</td>
                        <td><span className={`badge ${statusTone(ticket.shelf)}`}>{ticket.shelf}</span></td>
                        <td className="actions">
                          <Link className="btn small" href={`/tickets/${ticket.id}`}>规则</Link>
                          <Link className="btn small" href={`/tickets/${ticket.id}/calendar`}>价格</Link>
                          <Link className="btn small" href={`/tickets/${ticket.id}/channels`}>渠道</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
