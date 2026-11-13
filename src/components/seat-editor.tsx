"use client";

import { useMemo, useState } from "react";
import { saveSeats } from "@/server/show-actions";

type Seat = { id: number; zone_id: number; row_no: number; col_no: number; row_label: string; seat_no: number; sellable: number };
type Zone = { id: number; name: string; color: string; numbering: string };

export function SeatEditor({ venueId, zones, seats, editable }: { venueId: number; zones: Zone[]; seats: Seat[]; editable: boolean }) {
  const [rows, setRows] = useState(seats);
  const [tool, setTool] = useState<"sell" | "zone">("sell");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? 0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = zones.find((zone) => zone.id === zoneId);

  const grouped = useMemo(() => {
    return zones.map((zone) => {
      const mine = rows.filter((seat) => seat.zone_id === zone.id);
      const rowNos = [...new Set(mine.map((seat) => seat.row_no))].sort((a, b) => a - b);
      return { zone, rowNos, mine };
    });
  }, [rows, zones]);

  function clickSeat(seat: Seat) {
    if (!editable) return;
    setRows((current) =>
      current.map((item) => {
        if (item.id !== seat.id) return item;
        if (tool === "zone") return { ...item, zone_id: zoneId };
        return { ...item, sellable: item.sellable ? 0 : 1 };
      }),
    );
  }

  async function onSave() {
    setPending(true);
    const result = await saveSeats({
      venueId,
      seats: rows.map((seat) => ({ id: seat.id, zoneId: seat.zone_id, sellable: seat.sellable })),
    });
    setPending(false);
    setMessage(result?.message ?? "保存失败");
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="actions">
          <label className="choice">
            <input type="radio" checked={tool === "sell"} onChange={() => setTool("sell")} />
            点击切换可售
          </label>
          <label className="choice">
            <input type="radio" checked={tool === "zone"} onChange={() => setTool("zone")} />
            点击划入分区
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span>当前分区</span>
            <select value={zoneId} onChange={(event) => setZoneId(Number(event.target.value))}>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name} · {zone.numbering}</option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="button" disabled={!editable || pending} onClick={onSave}>{pending ? "保存中…" : "保存座位图"}</button>
        </div>
        {message ? <p className="form-ok">{message}</p> : null}
        <p className="hint">座位图只表达分区、编号和是否可售，不标价格，也不标渠道。编号含义：正序从左到右递增；倒序从左到右递减；奇数在左时左半为奇数、右半为偶数。</p>
      </div>
      <div className="card seat-map">
        <div className="stage">舞台</div>
        {grouped.map(({ zone, rowNos, mine }) => (
          <section key={zone.id} className="zone-block" style={{ outline: active?.id === zone.id ? "1px dashed #e4d3c0" : "none", padding: 8 }}>
            <h3><i className="swatch" style={{ background: zone.color }} />{zone.name}<span className="note">可售 {mine.filter((seat) => seat.sellable).length} / {mine.length}</span></h3>
            {rowNos.length === 0 ? <p className="hint">这个分区还没有座位。</p> : null}
            {rowNos.map((rowNo) => {
              const line = mine.filter((seat) => seat.row_no === rowNo).sort((a, b) => a.col_no - b.col_no);
              return (
                <div className="seat-row" key={rowNo}>
                  <span className="row-label">{line[0]?.row_label}</span>
                  {line.map((seat) => (
                    <button
                      key={seat.id}
                      type="button"
                      className={`seat ${seat.sellable ? "" : "off"}`}
                      style={{ background: seat.sellable ? zone.color : undefined }}
                      onClick={() => clickSeat(seat)}
                      title={`${zone.name} ${seat.row_label}${seat.seat_no}号`}
                    >
                      {seat.seat_no}
                    </button>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
