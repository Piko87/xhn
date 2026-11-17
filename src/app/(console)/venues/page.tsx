import Link from "next/link";
import { can } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { requireAccess } from "@/lib/guard";
import { listVenues } from "@/lib/queries";
import { copyVenue, deleteVenue, saveVenue } from "@/server/show-actions";

export default async function VenuesPage() {
  const user = await requireAccess("venues", "read");
  const editable = can(user.access, "venues", "write");
  const venues = listVenues();
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">演出管理</p>
          <h1>场馆管理</h1>
          <p className="sub">场馆下面是分区和座位图。库存显示规则决定对客看到精确数字还是充足、紧张、少量。</p>
        </div>
      </header>
      <div className="stack">
        {venues.map((venue) => (
          <article className="card" key={venue.id}>
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>{venue.name}</h2>
                <div className="meta">
                  <span>{venue.code}</span>
                  <span>{venue.address}</span>
                  <span>{venue.zone_count} 个分区</span>
                  <span>关联 {venue.product_count} 个产品</span>
                  <span>{venue.display_mode === "fuzzy" ? `模糊显示 · 充足≥${venue.fuzzy_ample}% · 紧张≥${venue.fuzzy_tight}%` : "实时显示"}</span>
                </div>
              </div>
              <div className="legend">
                {venue.zones.map((zone) => <span key={zone.id}><i className="swatch" style={{ background: zone.color }} /> {zone.name}</span>)}
              </div>
            </div>
            <p className="hint">{venue.map_note}</p>
            <div className="actions">
              <Link className="btn small" href={`/venues/${venue.id}`}>编辑</Link>
              <Link className="btn small" href={`/venues/${venue.id}/seats`}>座位图</Link>
              <Link className="btn small" href={`/sessions?venue=${venue.id}`}>场次</Link>
              <Link className="btn small" href={`/orders?venue=${venue.id}`}>订单</Link>
              {editable ? (
                <form action={copyVenue}><input type="hidden" name="id" value={venue.id} /><button className="btn small" type="submit">复制</button></form>
              ) : null}
              {editable ? (
                <ActionForm action={deleteVenue}>
                  <input type="hidden" name="id" value={venue.id} />
                  <button className="btn small danger" type="submit">删除</button>
                </ActionForm>
              ) : null}
            </div>
          </article>
        ))}
        {editable ? (
          <ActionForm action={saveVenue} className="card stack">
            <h2>新增场馆</h2>
            <div className="grid-2">
              <label className="field"><span>名称</span><input name="name" required /></label>
              <label className="field"><span>地址</span><input name="address" required /></label>
              <label className="field"><span>分布说明</span><input name="map_note" /></label>
              <label className="field"><span>库存显示</span>
                <select name="display_mode" defaultValue="fuzzy"><option value="fuzzy">模糊显示</option><option value="realtime">实时显示</option></select>
              </label>
              <label className="field"><span>充足阈值 %</span><input name="fuzzy_ample" type="number" defaultValue={40} /></label>
              <label className="field"><span>紧张阈值 %</span><input name="fuzzy_tight" type="number" defaultValue={15} /></label>
            </div>
            <button className="btn primary" type="submit">保存场馆</button>
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}
