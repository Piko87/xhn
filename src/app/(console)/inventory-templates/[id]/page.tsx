import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AllocationPanel } from "@/components/allocation-panel";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { listChannels, listGroups, listLogs, qget, templateHolds } from "@/lib/queries";
import { createGroup, renameTemplate, setDefaultTemplate } from "@/server/template-actions";

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("inventory", "read");
  const editable = can(user.access, "inventory", "write");
  const { id } = await params;
  const template = qget<{ id: number; venue_id: number; zone_id: number; name: string; is_default: number; reserved: number; venue_name: string; zone_name: string }>(
    `SELECT t.*, v.name AS venue_name, z.name AS zone_name
     FROM inventory_templates t JOIN venues v ON v.id = t.venue_id JOIN zones z ON z.id = t.zone_id WHERE t.id = ?`,
    Number(id),
  );
  if (!template) notFound();
  const holds = templateHolds(template.id);
  const channels = listChannels();
  const groups = listGroups();
  const capacity = qget<{ n: number }>("SELECT COUNT(*) AS n FROM seats WHERE zone_id = ? AND kind = 'seat' AND sellable = 1", template.zone_id)?.n ?? 0;
  const unsellable = qget<{ n: number }>("SELECT COUNT(*) AS n FROM seats WHERE zone_id = ? AND kind = 'seat' AND sellable = 0", template.zone_id)?.n ?? 0;
  const grouped = new Set(groups.flatMap((group) => group.channelIds));
  const exclusive = holds.channels.reduce((sum, hold) => sum + hold.qty, 0) + holds.groups.reduce((sum, hold) => sum + hold.qty, 0);
  const shared = capacity - template.reserved - exclusive;
  const rows = [
    { key: "reserved", label: "预留", target: "reserved" as const, targetId: 0, mode: "预留" as const, qty: template.reserved, sold: 0, available: template.reserved },
    ...channels.filter((channel) => channel.kind === "直销").map((channel) => {
      const qty = holds.channels.find((hold) => hold.channel_id === channel.id)?.qty ?? 0;
      return { key: `c${channel.id}`, label: `直销 · ${channel.name}`, target: "channel" as const, targetId: channel.id, mode: qty > 0 ? "独立" as const : "共享" as const, qty, sold: 0, available: qty > 0 ? qty : shared };
    }),
    ...groups.map((group) => {
      const qty = holds.groups.find((hold) => hold.group_id === group.id)?.qty ?? 0;
      const names = channels.filter((channel) => group.channelIds.includes(channel.id)).map((channel) => channel.name).join("、");
      return { key: `g${group.id}`, label: `分组 · ${group.name}${names ? `（${names}）` : ""}`, target: "group" as const, targetId: group.id, mode: qty > 0 ? "独立" as const : "共享" as const, qty, sold: 0, available: qty > 0 ? qty : shared };
    }),
    ...channels.filter((channel) => channel.kind === "分销" && !grouped.has(channel.id)).map((channel) => {
      const qty = holds.channels.find((hold) => hold.channel_id === channel.id)?.qty ?? 0;
      return { key: `d${channel.id}`, label: `未分组 · ${channel.name}`, target: "channel" as const, targetId: channel.id, mode: qty > 0 ? "独立" as const : "共享" as const, qty, sold: 0, available: qty > 0 ? qty : shared };
    }),
  ];
  const logs = listLogs("分销库存模板", String(template.id));
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{template.venue_name} · {template.zone_name}</p>
          <h1>{template.name}</h1>
          <p className="sub">{template.is_default ? "这是该分区的默认模板，新建场次会套用。" : "还不是默认模板。"} 保存这里的分配不会改写已经卖过票的场次。</p>
        </div>
        <Link className="btn" href={`/inventory-templates?venue=${template.venue_id}&zone=${template.zone_id}`}>返回列表</Link>
      </header>
      <div className="card actions">
        <ActionForm action={renameTemplate} className="actions">
          <input type="hidden" name="id" value={template.id} />
          <label className="field"><span>模板名称</span><input name="name" defaultValue={template.name} disabled={!editable} /></label>
          {editable ? <button className="btn" type="submit">保存名称</button> : null}
        </ActionForm>
        {editable && !template.is_default ? (
          <form action={setDefaultTemplate}><input type="hidden" name="id" value={template.id} /><button className="btn" type="submit">设为默认</button></form>
        ) : null}
      </div>
      <section className="card">
        <AllocationPanel
          scope="template"
          templateId={template.id}
          zoneId={template.zone_id}
          capacity={capacity}
          unsellable={unsellable}
          reserved={template.reserved}
          exclusive={exclusive}
          shared={shared}
          sharedRemaining={shared}
          rows={rows}
          editable={editable}
        />
      </section>
      {editable ? (
        <ActionForm action={createGroup} className="card actions">
          <h2>新建分组</h2>
          <label className="field"><span>分组名称</span><input name="name" placeholder="例如 协议客户" /></label>
          <label className="field"><span>先放入的分销渠道</span>
            <select name="channel_id" defaultValue="">
              <option value="">稍后再加</option>
              {channels.filter((channel) => channel.kind === "分销").map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">创建分组</button>
        </ActionForm>
      ) : null}
      <section className="card">
        <h2>操作记录</h2>
        {logs.length === 0 ? <p className="hint">还没有调整记录。</p> : logs.map((item) => <p key={item.id}><b>{item.actor}</b> <span className="note">{item.created_at}</span> {item.summary}</p>)}
      </section>
    </div>
  );
}
