"use client";

import { useState } from "react";
import { customerStockLabel } from "@/lib/inventory";
import type { ZoneAllocationInput } from "@/lib/types";
import { saveAllocation } from "@/server/show-actions";

type Channel = { id: number; name: string; kind: string };
type Zone = {
  id: number;
  name: string;
  color: string;
  capacity: number;
  unsellable: number;
  reserved: number;
  holds: { channelId: number; qty: number; sold: number; remaining: number }[];
  sharedPool: number;
  sharedSold: number;
  sharedRemaining: number;
  available: number;
  sold: number;
};
type VenueRule = { display_mode: string; fuzzy_ample: number; fuzzy_tight: number };

export function InventoryBoard({
  sessionId,
  zones,
  channels,
  venue,
  editable,
}: {
  sessionId: number;
  zones: Zone[];
  channels: Channel[];
  venue: VenueRule;
  editable: boolean;
}) {
  const [view, setView] = useState<"分配视图" | "销售视图">("分配视图");
  const [draft, setDraft] = useState<ZoneAllocationInput[]>(
    zones.map((zone) => ({
      zoneId: zone.id,
      reserved: zone.reserved,
      holds: channels.map((channel) => ({
        channelId: channel.id,
        qty: zone.holds.find((hold) => hold.channelId === channel.id)?.qty ?? 0,
      })),
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(zoneId: number, recipe: (zone: ZoneAllocationInput) => ZoneAllocationInput) {
    setDraft((current) => current.map((zone) => (zone.zoneId === zoneId ? recipe(zone) : zone)));
  }

  async function onSave() {
    setPending(true);
    const result = await saveAllocation({
      sessionId,
      zones: draft.map((zone) => ({
        ...zone,
        holds: zone.holds.filter((hold) => hold.qty > 0),
      })),
    });
    setPending(false);
    setMessage(result?.message ?? "保存失败");
  }

  return (
    <div className="stack">
      <div className="actions">
        {(["分配视图", "销售视图"] as const).map((item) => (
          <button key={item} type="button" className={`btn ${view === item ? "primary" : ""}`} onClick={() => setView(item)}>{item}</button>
        ))}
        {view === "分配视图" && editable ? (
          <button className="btn primary" type="button" disabled={pending} onClick={onSave}>{pending ? "保存中…" : "保存分销库存"}</button>
        ) : null}
      </div>
      {message ? <p className="form-ok">{message}</p> : null}
      <p className="hint">共享库存给所有未单独占位的渠道一起卖。独立库存是某个渠道的独占数量，不和别人混用。预留库存不进入任何渠道。独立库存按数量占用，不预先绑到具体座位。</p>
      {zones.map((zone) => {
        const local = draft.find((item) => item.zoneId === zone.id)!;
        const exclusive = local.holds.reduce((sum, hold) => sum + Math.max(0, hold.qty), 0);
        const sharedPool = zone.capacity - local.reserved - exclusive;
        const sharedChannels = channels.filter((channel) => (local.holds.find((hold) => hold.channelId === channel.id)?.qty ?? 0) <= 0);
        return (
          <section className="card" key={zone.id}>
            <h2><i className="swatch" style={{ background: zone.color }} /> {zone.name}</h2>
            <div className="chips">
              <span className="chip">可售座位 {zone.capacity}</span>
              <span className="chip">不可售 {zone.unsellable}</span>
              <span className="chip">已售 {zone.sold}</span>
              <span className="chip">当前可售剩余 {zone.available}</span>
            </div>
            {view === "分配视图" ? (
              <div className="stack">
                <label className="field" style={{ maxWidth: 220 }}>
                  <span>预留库存</span>
                  <input type="number" min={0} value={local.reserved} disabled={!editable} onChange={(event) => update(zone.id, (item) => ({ ...item, reserved: Number(event.target.value) }))} />
                </label>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>渠道</th><th>类型</th><th>方式</th><th>独立数量</th><th>已售</th></tr></thead>
                    <tbody>
                      {channels.map((channel) => {
                        const qty = local.holds.find((hold) => hold.channelId === channel.id)?.qty ?? 0;
                        const sold = zone.holds.find((hold) => hold.channelId === channel.id)?.sold ?? 0;
                        return (
                          <tr key={channel.id}>
                            <td>{channel.name}</td>
                            <td>{channel.kind}</td>
                            <td>
                              <select
                                value={qty > 0 ? "独立" : "共享"}
                                disabled={!editable}
                                onChange={(event) => {
                                  const next = event.target.value === "独立" ? Math.max(qty, 1) : 0;
                                  update(zone.id, (item) => ({
                                    ...item,
                                    holds: item.holds.map((hold) => hold.channelId === channel.id ? { ...hold, qty: next } : hold),
                                  }));
                                }}
                              >
                                <option value="共享">共享库存</option>
                                <option value="独立">独立库存</option>
                              </select>
                            </td>
                            <td>
                              {qty > 0 ? (
                                <input className="inline-input" style={{ width: 90 }} type="number" min={0} value={qty} disabled={!editable} onChange={(event) => update(zone.id, (item) => ({
                                  ...item,
                                  holds: item.holds.map((hold) => hold.channelId === channel.id ? { ...hold, qty: Number(event.target.value) } : hold),
                                }))} />
                              ) : "—"}
                            </td>
                            <td>{qty > 0 ? sold : "计入共享"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="hint">按当前填写，共享池 {sharedPool} 张。{sharedPool < 0 ? "已经超过可售座位。" : `共享渠道：${sharedChannels.map((channel) => channel.name).join("、") || "无"}。`}</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>去向</th><th>分配</th><th>已售</th><th>剩余</th><th>对客显示</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>预留</td><td>{zone.reserved}</td><td>—</td><td>—</td><td>不对客销售</td>
                    </tr>
                    <tr>
                      <td>共享池（{sharedChannels.map((channel) => channel.name).join("、") || "无"}）</td>
                      <td>{zone.sharedPool}</td>
                      <td>{zone.sharedSold}</td>
                      <td>{zone.sharedRemaining}</td>
                      <td>{customerStockLabel(zone.sharedRemaining, zone.sharedPool, venue)}</td>
                    </tr>
                    {zone.holds.map((hold) => {
                      const channel = channels.find((item) => item.id === hold.channelId);
                      return (
                        <tr key={hold.channelId}>
                          <td>独立 · {channel?.name}</td>
                          <td>{hold.qty}</td>
                          <td>{hold.sold}</td>
                          <td>{hold.remaining}</td>
                          <td>{customerStockLabel(hold.remaining, hold.qty, venue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
