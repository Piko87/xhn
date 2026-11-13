import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { can } from "@/lib/auth";
import { requireAccess } from "@/lib/guard";
import { getVenue, listChannels } from "@/lib/queries";
import { deleteZone, saveDefaultHold, saveVenue, saveZone } from "@/server/show-actions";

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("venues", "read");
  const editable = can(user.access, "venues", "write");
  const inventory = can(user.access, "inventory", "write");
  const { id } = await params;
  const venue = getVenue(Number(id));
  if (!venue) notFound();
  const channels = listChannels().filter((channel) => channel.kind === "分销");
  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{venue.code}</p>
          <h1>{venue.name}</h1>
        </div>
        <div className="actions">
          <Link className="btn" href={`/venues/${venue.id}/seats`}>打开座位图</Link>
          <Link className="btn" href={`/sessions?venue=${venue.id}`}>场次日历</Link>
        </div>
      </header>
      <div className="split">
        <ActionForm action={saveVenue} className="card stack">
          <h2>场馆与库存显示</h2>
          <input type="hidden" name="id" value={venue.id} />
          <label className="field"><span>名称</span><input name="name" defaultValue={venue.name} disabled={!editable} /></label>
          <label className="field"><span>地址</span><input name="address" defaultValue={venue.address} disabled={!editable} /></label>
          <label className="field"><span>分布说明</span><textarea name="map_note" defaultValue={venue.map_note} disabled={!editable} /></label>
          <label className="field"><span>库存显示规则</span>
            <select name="display_mode" defaultValue={venue.display_mode} disabled={!editable}>
              <option value="fuzzy">模糊显示</option>
              <option value="realtime">实时显示</option>
            </select>
          </label>
          <div className="grid-2">
            <label className="field"><span>充足：剩余比例 ≥</span><input name="fuzzy_ample" type="number" defaultValue={venue.fuzzy_ample} disabled={!editable} /></label>
            <label className="field"><span>紧张：剩余比例 ≥</span><input name="fuzzy_tight" type="number" defaultValue={venue.fuzzy_tight} disabled={!editable} /></label>
          </div>
          <p className="hint">低于紧张阈值显示「少量」，剩余为 0 显示「售罄」。工作台仍会同时给出准确张数。</p>
          {editable ? <button className="btn primary" type="submit">保存场馆</button> : null}
        </ActionForm>
        <div className="stack">
          {venue.zones.map((zone) => (
            <section className="card stack" key={zone.id}>
              <h2><i className="swatch" style={{ background: zone.color }} /> {zone.name}</h2>
              <ActionForm action={saveZone} className="grid-2">
                <input type="hidden" name="id" value={zone.id} />
                <input type="hidden" name="venue_id" value={venue.id} />
                <label className="field"><span>名称</span><input name="name" defaultValue={zone.name} disabled={!editable} /></label>
                <label className="field"><span>颜色</span><input name="color" defaultValue={zone.color} disabled={!editable} /></label>
                <label className="field"><span>默认预留</span><input name="reserved" type="number" defaultValue={zone.reserved} disabled={!editable} /></label>
                {editable ? <button className="btn" type="submit">保存分区</button> : null}
              </ActionForm>
              <p className="hint">编号 {zone.numbering} · {zone.rows_n} 排 × {zone.cols_n} 座。默认预留会套用到新建场次。</p>
              {inventory ? (
                <ActionForm action={saveDefaultHold} className="grid-3">
                  <input type="hidden" name="venue_id" value={venue.id} />
                  <input type="hidden" name="zone_id" value={zone.id} />
                  <label className="field"><span>默认独立渠道</span>
                    <select name="channel_id" defaultValue={channels[0]?.id}>
                      {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>数量（0 为取消）</span><input name="qty" type="number" defaultValue={0} /></label>
                  <button className="btn" type="submit">写入默认分配</button>
                </ActionForm>
              ) : null}
              <p className="note">已有默认独立库存：{venue.holds.filter((hold) => hold.zone_id === zone.id).map((hold) => `${hold.channel_name} ${hold.qty}`).join("、") || "无"}</p>
              {editable ? (
                <ActionForm action={deleteZone}>
                  <input type="hidden" name="id" value={zone.id} />
                  <input type="hidden" name="venue_id" value={venue.id} />
                  <button className="btn danger small" type="submit">删除分区</button>
                </ActionForm>
              ) : null}
            </section>
          ))}
          {editable ? (
            <ActionForm action={saveZone} className="card stack">
              <h2>新增分区</h2>
              <input type="hidden" name="venue_id" value={venue.id} />
              <label className="field"><span>名称</span><input name="name" required /></label>
              <label className="field"><span>颜色</span><input name="color" defaultValue="#c4552a" /></label>
              <label className="field"><span>默认预留</span><input name="reserved" type="number" defaultValue={0} /></label>
              <button className="btn primary" type="submit">添加分区</button>
            </ActionForm>
          ) : null}
        </div>
      </div>
    </div>
  );
}
