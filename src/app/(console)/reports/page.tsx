import Link from "next/link";
import { yuan } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { listChannels, listDistributors, listProducts, orderCost, reportOrders, type ReportOrder } from "@/lib/queries";

const TEMPLATES = [
  { key: "ticket", label: "票类销售日(月)报表" },
  { key: "distributor", label: "分销商日(月)销售报表" },
  { key: "channel", label: "渠道销售日(月)报表" },
  { key: "payment", label: "支付方式日(月)销售报表" },
];

const REAL = new Set(["未使用", "已使用", "部分使用"]);

function grainOf(date: string, grain: string) {
  if (grain === "year") return date.slice(0, 4);
  if (grain === "month") return date.slice(0, 7);
  return date;
}

function dimension(order: ReportOrder, template: string) {
  if (template === "distributor") return order.distributor_name || "直销";
  if (template === "channel") return order.channel_name;
  if (template === "payment") return order.pay_method;
  return order.ticket_name;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tpl?: string; grain?: string; from?: string; to?: string; product?: string; channel?: string; distributor?: string; pay?: string }>;
}) {
  await requireAccess("reports", "read");
  const sp = await searchParams;
  const template = TEMPLATES.some((item) => item.key === sp.tpl) ? sp.tpl! : "ticket";
  const grain = sp.grain || "day";
  const from = sp.from || "2026-11-01";
  const to = sp.to || "2026-11-30";
  const productId = sp.product ? Number(sp.product) : undefined;
  const orders = reportOrders({
    from,
    to,
    productId,
    channel: sp.channel || undefined,
    distributor: sp.distributor || undefined,
    pay: sp.pay || undefined,
  });
  const buckets = new Map<string, {
    date: string;
    name: string;
    product: string;
    sellers: Set<string>;
    booked: number;
    cancelled: number;
    soldQty: number;
    soldAmount: number;
    costSum: number;
    people: number;
  }>();
  for (const order of orders) {
    const date = grainOf(order.session_date, grain);
    const name = dimension(order, template);
    const product = template === "ticket" ? order.product_name : "";
    const key = `${date}|${name}|${product}`;
    const bucket = buckets.get(key) ?? { date, name, product, sellers: new Set<string>(), booked: 0, cancelled: 0, soldQty: 0, soldAmount: 0, costSum: 0, people: 0 };
    bucket.booked += order.qty;
    bucket.sellers.add(order.seller_name);
    if (order.status === "被取消") bucket.cancelled += order.qty;
    if (order.pay_status === "已支付" && REAL.has(order.status)) {
      bucket.soldQty += order.qty;
      bucket.soldAmount += order.amount;
      bucket.costSum += orderCost(order) * order.qty;
      bucket.people += order.qty * order.people_count;
    }
    buckets.set(key, bucket);
  }
  const rows = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "zh"));
  const totals = rows.reduce(
    (sum, row) => ({
      booked: sum.booked + row.booked,
      cancelled: sum.cancelled + row.cancelled,
      soldQty: sum.soldQty + row.soldQty,
      soldAmount: sum.soldAmount + row.soldAmount,
      people: sum.people + row.people,
    }),
    { booked: 0, cancelled: 0, soldQty: 0, soldAmount: 0, people: 0 },
  );
  const products = listProducts("");
  const channels = listChannels();
  const distributors = listDistributors();
  const query = (next: Record<string, string>) => {
    const params = new URLSearchParams({ tpl: template, grain, from, to, product: sp.product || "", channel: sp.channel || "", distributor: sp.distributor || "", pay: sp.pay || "", ...next });
    return `/reports?${params.toString()}`;
  };
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">报表</p>
          <h1>{TEMPLATES.find((item) => item.key === template)?.label}</h1>
          <p className="sub">按演出日期汇总。预订含全部下单张数，取消是被取消的张数，实售是已支付且未取消的张数。采购单价按实售加权。</p>
        </div>
      </header>
      <div className="tabs">
        {TEMPLATES.map((item) => <Link key={item.key} className={template === item.key ? "on" : ""} href={query({ tpl: item.key })}>{item.label}</Link>)}
      </div>
      <div className="tabs">
        <Link className={grain === "day" ? "on" : ""} href={query({ grain: "day" })}>按天</Link>
        <Link className={grain === "month" ? "on" : ""} href={query({ grain: "month" })}>按月</Link>
        <Link className={grain === "year" ? "on" : ""} href={query({ grain: "year" })}>按年</Link>
      </div>
      <form className="filters" action="/reports">
        <input type="hidden" name="tpl" value={template} />
        <input type="hidden" name="grain" value={grain} />
        <label className="field"><span>开始</span><input type="date" name="from" defaultValue={from} /></label>
        <label className="field"><span>结束</span><input type="date" name="to" defaultValue={to} /></label>
        <label className="field"><span>产品</span>
          <select name="product" defaultValue={sp.product || ""}>
            <option value="">全部</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="field"><span>渠道</span>
          <select name="channel" defaultValue={sp.channel || ""}>
            <option value="">全部</option>
            {channels.map((channel) => <option key={channel.id}>{channel.name}</option>)}
          </select>
        </label>
        <label className="field"><span>分销商</span>
          <select name="distributor" defaultValue={sp.distributor || ""}>
            <option value="">全部</option>
            {distributors.map((item) => <option key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field"><span>支付方式</span>
          <select name="pay" defaultValue={sp.pay || ""}>
            <option value="">全部</option>
            {["微信支付", "支付宝", "窗口现金", "对公转账"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="btn" type="submit">查询</button>
      </form>
      <div className="grid-4">
        <article className="card stat"><span>预订数量</span><b>{totals.booked}</b></article>
        <article className="card stat"><span>取消数量</span><b>{totals.cancelled}</b></article>
        <article className="card stat"><span>实售数量</span><b>{totals.soldQty}</b></article>
        <article className="card stat"><span>实售金额</span><b>{yuan(totals.soldAmount)}</b></article>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              {template === "ticket" ? <th>产品</th> : null}
              <th>{template === "ticket" ? "票类" : template === "distributor" ? "分销商" : template === "channel" ? "渠道" : "支付方式"}</th>
              {template === "ticket" ? <th>售票员</th> : null}
              <th>预订数量</th>
              <th>取消数量</th>
              <th>采购单价</th>
              <th>实售数量</th>
              <th>实售金额</th>
              {template === "ticket" ? <th>订单人数</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.date}-${row.name}-${row.product}`}>
                <td>{row.date}</td>
                {template === "ticket" ? <td>{row.product}</td> : null}
                <td>{row.name}</td>
                {template === "ticket" ? <td>{[...row.sellers].join("、")}</td> : null}
                <td>{row.booked}</td>
                <td>{row.cancelled}</td>
                <td>{row.soldQty ? yuan(Math.round(row.costSum / row.soldQty)) : "—"}</td>
                <td>{row.soldQty}</td>
                <td>{yuan(row.soldAmount)}</td>
                {template === "ticket" ? <td>{row.people}</td> : null}
              </tr>
            ))}
            <tr>
              <td>合计</td>
              {template === "ticket" ? <td /> : null}
              <td />
              {template === "ticket" ? <td /> : null}
              <td>{totals.booked}</td>
              <td>{totals.cancelled}</td>
              <td />
              <td>{totals.soldQty}</td>
              <td>{yuan(totals.soldAmount)}</td>
              {template === "ticket" ? <td>{totals.people}</td> : null}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
