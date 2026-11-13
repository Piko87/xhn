import Link from "next/link";
import { notFound } from "next/navigation";
import { yuan, statusTone } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { getProduct } from "@/lib/queries";
import { customerStockLabel } from "@/lib/inventory";
import { sessionRollup, listSessions } from "@/lib/queries";

export default async function ProductPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAccess("products", "read");
  const { id } = await params;
  const sp = await searchParams;
  const data = getProduct(Number(id));
  if (!data) notFound();
  const product = data.product as {
    id: number;
    code: string;
    name: string;
    address: string;
    venue_id: number | null;
    venue_name: string | null;
    intro: string;
    director: string;
    traffic: string;
    notice: string;
    hue: number;
    display_mode?: string;
    fuzzy_ample?: number;
    fuzzy_tight?: number;
  };
  const tab = sp.tab || "notice";
  const nextSession = product.venue_id
    ? listSessions(product.venue_id, "2026-11-13", "2026-12-31").find((session) => session.product_id === product.id && session.status === "开售")
    : undefined;
  const rollup = nextSession ? sessionRollup(nextSession) : null;
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">产品预览</p>
          <h1>{product.name}</h1>
          <p className="sub">{product.code} · {product.address}</p>
        </div>
        <Link className="btn" href="/products">返回列表</Link>
      </header>
      <div className="split">
        <section className="card">
          <div className="cover" style={{ minHeight: 180, background: `linear-gradient(160deg, hsl(${product.hue} 58% 42%), #241910)` }}>{product.venue_name}</div>
          <div className="tabs" style={{ marginTop: 12 }}>
            <Link className={tab === "notice" ? "on" : ""} href={`/products/${product.id}?tab=notice`}>预订须知</Link>
            <Link className={tab === "intro" ? "on" : ""} href={`/products/${product.id}?tab=intro`}>演出介绍</Link>
            <Link className={tab === "traffic" ? "on" : ""} href={`/products/${product.id}?tab=traffic`}>交通指南</Link>
          </div>
          {tab === "notice" ? <p>{String(product.notice)}</p> : null}
          {tab === "intro" ? <div><p>{String(product.intro)}</p><p>著名导演：{String(product.director)}</p></div> : null}
          {tab === "traffic" ? <p>{String(product.traffic)}</p> : null}
        </section>
        <section className="card">
          <h2>票档</h2>
          <table>
            <thead><tr><th>门票</th><th>建议零售价</th><th>状态</th></tr></thead>
            <tbody>
              {data.tickets.map((ticket) => (
                <tr key={ticket.input.id}>
                  <td>{ticket.input.name}<div className="note">{ticket.zone_name}</div></td>
                  <td>{yuan(ticket.input.retail_price)}</td>
                  <td><span className={`badge ${statusTone(ticket.shelf.label)}`}>{ticket.shelf.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextSession && rollup ? (
            <p className="hint">下一场 {nextSession.session_date} {nextSession.start_time} 剩余 {rollup.available}，对客显示「{customerStockLabel(rollup.available, rollup.denominator, { display_mode: product.display_mode || "realtime", fuzzy_ample: product.fuzzy_ample || 40, fuzzy_tight: product.fuzzy_tight || 15 })}」。</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
