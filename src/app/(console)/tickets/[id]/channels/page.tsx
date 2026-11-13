import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { channelConfig, getTicket, listChannels, listDistributors } from "@/lib/queries";
import { saveChannelSales } from "@/server/catalog-actions";

export default async function ChannelsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("channel_sales", "read");
  const editable = can(user.access, "channel_sales", "write");
  const { id } = await params;
  const ticket = getTicket(Number(id));
  if (!ticket) notFound();
  const channels = listChannels();
  const distributors = listDistributors();
  const config = channelConfig(ticket.input.id);
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{ticket.product_name}</p>
          <h1>渠道销售配置 · {ticket.input.name}</h1>
          <p className="sub">直销开关和票类白名单一起决定能不能卖。分销价格决定结算价。卖多少张看分销库存。</p>
        </div>
        <Link className="btn" href={`/tickets/${ticket.input.id}`}>返回规则</Link>
      </header>
      <ActionForm action={saveChannelSales} className="stack">
        <input type="hidden" name="ticket_id" value={ticket.input.id} />
        <section className="card">
          <h2>直销渠道</h2>
          <div className="check-row">
            {channels.filter((channel) => channel.kind === "直销").map((channel) => {
              const enabled = config.switches.find((item) => item.channel_id === channel.id)?.enabled ?? 0;
              const allowed = ticket.input.sale_channels.includes(channel.id);
              return (
                <label key={channel.id} className={`check ${enabled ? "on" : ""}`}>
                  <input type="checkbox" name={`direct_${channel.id}`} defaultChecked={!!enabled} disabled={!editable} />
                  {channel.name}{allowed ? "" : "（白名单未包含）"}
                </label>
              );
            })}
          </div>
        </section>
        <section className="card">
          <h2>分销价格配置</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>分销商</th><th>分组</th><th>是否分销</th><th>向下分销</th><th>结算价</th><th>白名单</th></tr></thead>
              <tbody>
                {distributors.map((distributor) => {
                  const row = config.prices.find((item) => item.distributor_id === distributor.id);
                  const channel = channels.find((item) => item.distributor_id === distributor.id);
                  const allowed = channel ? ticket.input.sale_channels.includes(channel.id) : false;
                  return (
                    <tr key={distributor.id}>
                      <td>{distributor.name}</td>
                      <td>{distributor.group_name}</td>
                      <td><input type="checkbox" name={`dist_${distributor.id}`} defaultChecked={!!row?.enabled} disabled={!editable} /></td>
                      <td><input type="checkbox" name={`down_${distributor.id}`} defaultChecked={!!row?.downstream} disabled={!editable} /></td>
                      <td><input className="inline-input" style={{ width: 100 }} name={`price_${distributor.id}`} type="number" defaultValue={row?.settlement ?? 0} disabled={!editable} /></td>
                      <td>{allowed ? "已包含" : "未包含"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {editable ? <button className="btn primary" type="submit">保存渠道配置</button> : <p>当前角色只读。</p>}
      </ActionForm>
    </div>
  );
}
