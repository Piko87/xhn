import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketEditor } from "@/components/ticket-editor";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { getTicket, listChannels, plain, zonesForVenue } from "@/lib/queries";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("ticket_rules", "read");
  const { id } = await params;
  const ticket = getTicket(Number(id));
  if (!ticket) notFound();
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{ticket.product_name} · {ticket.code}</p>
          <h1>票类规则 · {ticket.input.name}</h1>
          <p className="sub">分区：{ticket.zone_name}。谁能卖看白名单和渠道开关，能卖多少看分销库存。</p>
        </div>
        <div className="actions">
          <Link className="btn" href={`/tickets/${ticket.input.id}/calendar`}>价格日历</Link>
          <Link className="btn" href={`/tickets/${ticket.input.id}/channels`}>渠道销售配置</Link>
          <Link className="btn" href={`/products`}>返回产品</Link>
        </div>
      </header>
      <TicketEditor
        ticket={ticket.input}
        zones={plain(zonesForVenue(ticket.venue_id))}
        channels={plain(listChannels())}
        supplierPhone={ticket.supplier_phone}
        summary={ticket.summary}
        editable={can(user.access, "ticket_rules", "write")}
      />
    </div>
  );
}
