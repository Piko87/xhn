import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { yuan, stockLabel } from "@/lib/format";
import { requireAccess } from "@/lib/guard";
import { getTicket, listDistributors, monthGrid, priceMap, settlementMap, soldCounters } from "@/lib/queries";
import { WEEKDAY_LABELS } from "@/lib/time";
import { applyBasePrices, clearPriceDay, savePriceDay, saveSettlementDay, saveTotalStock } from "@/server/catalog-actions";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; day?: string; tab?: string; distributor?: string }>;
}) {
  const user = await requireAccess("price_calendar", "read");
  const editable = can(user.access, "price_calendar", "write");
  const { id } = await params;
  const sp = await searchParams;
  const ticket = getTicket(Number(id));
  if (!ticket) notFound();
  const month = sp.month || "2026-11";
  const day = sp.day || `${month}-15`;
  const tab = sp.tab || "price";
  const distributors = listDistributors();
  const distributorId = Number(sp.distributor || distributors[0]?.id || 0);
  const days = monthGrid(month);
  const prices = priceMap(ticket.input.id, month);
  const settlements = settlementMap(ticket.input.id, distributorId, month);
  const selected = prices.get(day);
  const counters = soldCounters(ticket.input.id, day);
  const [year, mon] = month.split("-").map(Number);
  const prev = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, "0")}`;
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{ticket.product_name}</p>
          <h1>价格日历 · {ticket.input.name}</h1>
          <p className="sub">日库存和总库存是票类上限，和场次座位库存分开。没单独定价的日期沿用票面价。</p>
        </div>
        <Link className="btn" href={`/tickets/${ticket.input.id}`}>返回规则</Link>
      </header>
      <div className="tabs">
        <Link className={tab === "price" ? "on" : ""} href={`/tickets/${ticket.input.id}/calendar?month=${month}&day=${day}&tab=price`}>价格日历</Link>
        <Link className={tab === "settle" ? "on" : ""} href={`/tickets/${ticket.input.id}/calendar?month=${month}&day=${day}&tab=settle&distributor=${distributorId}`}>结算价日历</Link>
      </div>
      <div className="actions" style={{ marginBottom: 12 }}>
        <Link className="btn" href={`?month=${prev}&tab=${tab}&distributor=${distributorId}`}>上个月</Link>
        <strong>{month}</strong>
        <Link className="btn" href={`?month=${next}&tab=${tab}&distributor=${distributorId}`}>下个月</Link>
      </div>
      {tab === "settle" ? (
        <form className="filters" action={`/tickets/${ticket.input.id}/calendar`}>
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="tab" value="settle" />
          <label className="field"><span>分销商</span>
            <select name="distributor" defaultValue={distributorId}>
              {distributors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">切换</button>
        </form>
      ) : null}
      <div className="split">
        <div>
          <div className="month-grid" style={{ marginBottom: 6 }}>
            {WEEKDAY_LABELS.map((label) => <strong key={label} className="note">周{label}</strong>)}
          </div>
          <div className="month-grid">
            {days.map((date) => {
              const inMonth = date.startsWith(month);
              const price = prices.get(date);
              const settle = settlements.get(date);
              return (
                <Link key={date} href={`?month=${month}&day=${date}&tab=${tab}&distributor=${distributorId}`} className={`month-cell ${inMonth ? "" : "off"} ${date === day ? "today" : ""}`}>
                  <strong>{date.slice(-2)}</strong>
                  {tab === "price" ? (
                    <span className="price-cell">
                      <em>{price ? yuan(price.retail_price) : yuan(ticket.input.retail_price)}</em>
                      <span className="note">{price?.stop_sale ? "停售" : `库存 ${stockLabel(price?.daily_stock ?? ticket.input.daily_stock)}`}</span>
                    </span>
                  ) : (
                    <span className="price-cell"><em>{settle ? yuan(settle) : "—"}</em></span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="stack">
          {editable ? (
            <ActionForm action={saveTotalStock} className="card stack">
              <h2>总库存</h2>
              <input type="hidden" name="ticket_id" value={ticket.input.id} />
              <label className="field"><span>总库存（-1 不限）</span><input name="total_stock" type="number" defaultValue={ticket.input.total_stock} /></label>
              <p className="hint">该票已占用 {counters.soldTotal} 张（不含取消）。</p>
              <button className="btn" type="submit">保存总库存</button>
            </ActionForm>
          ) : null}
          {tab === "price" ? (
            <ActionForm action={savePriceDay} className="card stack">
              <h2>{day}</h2>
              <input type="hidden" name="ticket_id" value={ticket.input.id} />
              <input type="hidden" name="day" value={day} />
              <label className="field"><span>成本价</span><input name="cost_price" type="number" defaultValue={selected?.cost_price ?? ticket.input.cost_price} /></label>
              <label className="field"><span>零售价</span><input name="retail_price" type="number" defaultValue={selected?.retail_price ?? ticket.input.retail_price} /></label>
              <label className="field"><span>窗口价</span><input name="window_price" type="number" defaultValue={selected?.window_price ?? ticket.input.window_price} /></label>
              <label className="field"><span>门市价</span><input name="gate_price" type="number" defaultValue={selected?.gate_price ?? ticket.input.gate_price} /></label>
              <label className="field"><span>日库存</span><input name="daily_stock" type="number" defaultValue={selected?.daily_stock ?? ticket.input.daily_stock} /></label>
              <label className="field"><span>日预约</span><input name="daily_reserve" type="number" defaultValue={selected?.daily_reserve ?? 0} /></label>
              <label className="check"><input type="checkbox" name="stop_sale" defaultChecked={!!selected?.stop_sale} /> 停止售卖</label>
              <label className="check"><input type="checkbox" name="stop_reserve" defaultChecked={!!selected?.stop_reserve} /> 停止预约</label>
              <p className="hint">当日该票已售 {counters.soldToday}。</p>
              {editable ? <button className="btn primary" type="submit">写入这一天</button> : <p>只读</p>}
            </ActionForm>
          ) : (
            <ActionForm action={saveSettlementDay} className="card stack">
              <h2>{day} 结算价</h2>
              <input type="hidden" name="ticket_id" value={ticket.input.id} />
              <input type="hidden" name="distributor_id" value={distributorId} />
              <input type="hidden" name="day" value={day} />
              <label className="field"><span>结算价</span><input name="price" type="number" defaultValue={settlements.get(day) ?? 0} /></label>
              {editable ? <button className="btn primary" type="submit">保存结算价</button> : null}
            </ActionForm>
          )}
          {editable && tab === "price" ? (
            <>
              <ActionForm action={clearPriceDay} className="card">
                <input type="hidden" name="ticket_id" value={ticket.input.id} />
                <input type="hidden" name="day" value={day} />
                <button className="btn" type="submit">这一天恢复票面价</button>
              </ActionForm>
              <ActionForm action={applyBasePrices} className="card stack">
                <h2>按票面价覆盖</h2>
                <input type="hidden" name="ticket_id" value={ticket.input.id} />
                <input type="hidden" name="month" value={month} />
                <div className="check-row">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <label key={label} className="check"><input type="checkbox" name="weekday" value={index + 1} />周{label}</label>
                  ))}
                </div>
                <button className="btn" type="submit">覆盖所选星期</button>
              </ActionForm>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
