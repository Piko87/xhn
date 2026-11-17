"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerStockLabel } from "@/lib/inventory";
import { adjustAllocation } from "@/server/template-actions";
import { StockBar } from "./stock-bar";

type Row = {
  key: string;
  label: string;
  target: "reserved" | "channel" | "group";
  targetId: number;
  mode: "独立" | "共享" | "预留";
  qty: number;
  sold: number;
  available: number;
};

export function AllocationPanel({
  scope,
  templateId,
  sessionId,
  zoneId,
  capacity,
  unsellable,
  reserved,
  exclusive,
  shared,
  sharedRemaining,
  rows,
  venue,
  editable,
  showSales,
}: {
  scope: "template" | "session";
  templateId?: number;
  sessionId?: number;
  zoneId: number;
  capacity: number;
  unsellable: number;
  reserved: number;
  exclusive: number;
  shared: number;
  sharedRemaining: number;
  rows: Row[];
  venue?: { display_mode: string; fuzzy_ample: number; fuzzy_tight: number };
  editable: boolean;
  showSales?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"分配视图" | "销售视图">(showSales ? "销售视图" : "分配视图");
  const [open, setOpen] = useState<Row | null>(null);
  const [mode, setMode] = useState<"独立" | "共享">("独立");
  const [delta, setDelta] = useState(0);
  const [applyUnsold, setApplyUnsold] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function save() {
    if (!open) return;
    setPending(true);
    const result = await adjustAllocation({
      scope,
      templateId,
      sessionId,
      zoneId,
      target: open.target,
      targetId: open.targetId,
      mode: open.target === "reserved" ? "独立" : mode,
      delta: open.target !== "reserved" && mode === "共享" ? 0 : delta,
      applyUnsold: scope === "template" && applyUnsold,
    });
    setPending(false);
    setMessage(result?.message ?? "保存失败");
    if (result?.ok) {
      setOpen(null);
      router.refresh();
    }
  }

  return (
    <div className="stack">
      {scope === "session" ? (
        <div className="tabs">
          <button type="button" className={view === "分配视图" ? "on" : ""} onClick={() => setView("分配视图")}>分配视图</button>
          <button type="button" className={view === "销售视图" ? "on" : ""} onClick={() => setView("销售视图")}>销售视图</button>
        </div>
      ) : null}
      <StockBar capacity={capacity} exclusive={exclusive} shared={shared} reserved={reserved} unsellable={unsellable} />
      <p className="hint">不可售不进池。预留不对任何渠道。独立库存从共享剩余里划出，按数量占用，不绑定到具体座位。输入负数是减少；增加不能超过共享剩余，减少不能低于当前可用。</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>对象</th><th>模式</th><th>分配</th>
              {scope === "session" ? <th>已售</th> : null}
              <th>{view === "销售视图" ? "剩余 / 对客" : "当前可用"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = venue && view === "销售视图" && row.mode !== "预留"
                ? customerStockLabel(row.available, row.mode === "共享" ? Math.max(shared, 1) : Math.max(row.qty, 1), venue)
                : String(Math.max(row.available, 0));
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{row.mode === "预留" ? "预留" : row.mode === "独立" ? "独立库存" : "共享库存"}</td>
                  <td>{row.mode === "共享" ? "—" : row.qty}</td>
                  {scope === "session" ? <td>{row.mode === "预留" ? "—" : row.sold}</td> : null}
                  <td>{row.mode === "预留" ? "不对客销售" : view === "销售视图" ? `${row.available} · ${label}` : row.available}</td>
                  <td>{editable ? <button className="btn small" type="button" onClick={() => { setOpen(row); setMode(row.mode === "共享" ? "共享" : "独立"); setDelta(0); setMessage(null); }}>库存设置</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {message && !open ? <p className={message.startsWith("已") ? "form-ok" : "form-err"}>{message}</p> : null}
      {open ? (
        <div className="modal-back" role="presentation">
          <div className="modal stack" role="dialog" aria-label="库存设置">
            <h2>库存设置</h2>
            <p>设置对象：{open.label}</p>
            {open.target !== "reserved" ? (
              <div className="choice-row">
                <label className={`choice ${mode === "独立" ? "on" : ""}`}><input type="radio" checked={mode === "独立"} onChange={() => setMode("独立")} /> 独立库存</label>
                <label className={`choice ${mode === "共享" ? "on" : ""}`}><input type="radio" checked={mode === "共享"} onChange={() => setMode("共享")} /> 共享库存</label>
              </div>
            ) : <p className="hint">预留从共享池划出，任何渠道都不能卖。</p>}
            <p>当前可用库存：{open.available}</p>
            <p>当前共享剩余：{sharedRemaining}</p>
            {mode === "共享" && open.target !== "reserved" ? <p className="hint">改回共享会把尚未售出的独立数量退回共享池。已有售出时不能改回。</p> : (
              <label className="field"><span>增加库存（负数为减少）</span><input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} /></label>
            )}
            <p className="hint">1. 输入负数为减少库存。2. 最大可增加库存为当前共享剩余。3. 最小可减少到当前可用，不能动到已售。</p>
            {scope === "template" ? (
              <label className="check"><input type="checkbox" checked={applyUnsold} onChange={(event) => setApplyUnsold(event.target.checked)} /> 同时套用到该分区还没有订单的场次</label>
            ) : null}
            {message ? <p className="form-err">{message}</p> : null}
            <div className="actions">
              <button className="btn" type="button" onClick={() => setOpen(null)}>取消</button>
              <button className="btn primary" type="button" disabled={pending} onClick={save}>{pending ? "保存中…" : "保存"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
