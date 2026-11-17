import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { listTemplates, listVenues } from "@/lib/queries";
import { copyTemplate, createTemplate, deleteTemplate, setDefaultTemplate } from "@/server/template-actions";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ venue?: string; zone?: string }> }) {
  const user = await requireAccess("inventory", "read");
  const editable = can(user.access, "inventory", "write");
  const sp = await searchParams;
  const venues = listVenues();
  const venueId = Number(sp.venue || venues[0]?.id || 0);
  const venue = venues.find((item) => item.id === venueId) ?? venues[0];
  const zoneId = Number(sp.zone || venue?.zones[0]?.id || 0);
  const templates = listTemplates(venueId || undefined, zoneId || undefined);
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">演出管理</p>
          <h1>分销库存模板</h1>
          <p className="sub">按场馆和分区保存可复用的分配。设为默认后，新建场次会套用。改模板不会改写已经卖过票的场次。</p>
        </div>
      </header>
      <form className="filters" action="/inventory-templates">
        <label className="field"><span>场馆</span>
          <select name="venue" defaultValue={venueId}>{venues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="field"><span>分区</span>
          <select name="zone" defaultValue={zoneId}>{venue?.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select>
        </label>
        <button className="btn" type="submit">查询</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>模板</th><th>场馆</th><th>分区</th><th>默认</th><th></th></tr></thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td><Link href={`/inventory-templates/${template.id}`}>{template.name}</Link></td>
                <td>{template.venue_name}</td>
                <td><i className="swatch" style={{ background: template.zone_color }} /> {template.zone_name}</td>
                <td>{template.is_default ? "默认" : "—"}</td>
                <td className="actions">
                  <Link className="btn small" href={`/inventory-templates/${template.id}`}>编辑</Link>
                  {editable ? <form action={copyTemplate}><input type="hidden" name="id" value={template.id} /><button className="btn small" type="submit">复制</button></form> : null}
                  {editable && !template.is_default ? <form action={setDefaultTemplate}><input type="hidden" name="id" value={template.id} /><button className="btn small" type="submit">设为默认</button></form> : null}
                  {editable ? (
                    <ActionForm action={deleteTemplate}><input type="hidden" name="id" value={template.id} /><button className="btn small danger" type="submit">删除</button></ActionForm>
                  ) : null}
                </td>
              </tr>
            ))}
            {templates.length === 0 ? <tr><td colSpan={5}>这个分区还没有模板。</td></tr> : null}
          </tbody>
        </table>
      </div>
      {editable && venue ? (
        <form action={createTemplate} className="card actions">
          <label className="field"><span>新模板名称</span><input name="name" placeholder="例如 周末加场" required /></label>
          <input type="hidden" name="venue_id" value={venue.id} />
          <input type="hidden" name="zone_id" value={zoneId} />
          <button className="btn primary" type="submit">新建模板</button>
        </form>
      ) : null}
    </div>
  );
}
