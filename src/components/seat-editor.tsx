"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Numbering } from "@/lib/constants";
import { NUMBERINGS } from "@/lib/constants";
import { numberCells, type CellKind } from "@/lib/seats";
import { saveSeats } from "@/server/show-actions";

type Zone = { id: number; name: string; color: string; numbering: Numbering };
type Cell = { row: number; col: number; kind: CellKind; zoneId: number | null; sellable: number };

const TOOLS = [
  { id: "zone", label: "划入分区" },
  { id: "sell", label: "标为可售" },
  { id: "unsell", label: "标为不可售" },
  { id: "aisle", label: "标为过道" },
  { id: "empty", label: "清空" },
] as const;

type Tool = (typeof TOOLS)[number]["id"];

function keyOf(row: number, col: number) {
  return `${row}:${col}`;
}

export function SeatEditor({
  venueId,
  initialRows,
  initialCols,
  zones,
  seats,
  editable,
}: {
  venueId: number;
  initialRows: number;
  initialCols: number;
  zones: Zone[];
  seats: { row_no: number; col_no: number; zone_id: number | null; kind: string; sellable: number }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const [draftRows, setDraftRows] = useState(initialRows);
  const [draftCols, setDraftCols] = useState(initialCols);
  const [zoneState, setZoneState] = useState(zones);
  const [cells, setCells] = useState<Cell[]>(() =>
    seats
      .filter((seat) => seat.kind === "seat" || seat.kind === "aisle")
      .map((seat) => ({
        row: seat.row_no,
        col: seat.col_no,
        kind: seat.kind as CellKind,
        zoneId: seat.zone_id,
        sellable: seat.sellable,
      })),
  );
  const [tool, setTool] = useState<Tool>("zone");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? 0);
  const [defaultSellable, setDefaultSellable] = useState(true);
  const [anchor, setAnchor] = useState<{ row: number; col: number } | null>(null);
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(null);
  const drag = useRef<{ row: number; col: number; shift: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const map = useMemo(() => new Map(cells.map((cell) => [keyOf(cell.row, cell.col), cell])), [cells]);
  const numbers = useMemo(
    () => numberCells(cells.map((cell) => ({ row: cell.row, col: cell.col, kind: cell.kind, zoneId: cell.zoneId })), zoneState),
    [cells, zoneState],
  );

  function paint(target: { row: number; col: number }, mode: Tool): Cell | null {
    const current = map.get(keyOf(target.row, target.col));
    if (mode === "empty") return null;
    if (mode === "aisle") return { row: target.row, col: target.col, kind: "aisle", zoneId: null, sellable: 0 };
    if (mode === "sell" || mode === "unsell") {
      if (!current || current.kind !== "seat") return current ?? null;
      return { ...current, sellable: mode === "sell" ? 1 : 0 };
    }
    return { row: target.row, col: target.col, kind: "seat", zoneId, sellable: defaultSellable ? 1 : 0 };
  }

  function writeCells(next: Map<string, Cell | null>) {
    setCells((current) => {
      const merged = new Map(current.map((cell) => [keyOf(cell.row, cell.col), cell]));
      for (const [key, value] of next) {
        if (value) merged.set(key, value);
        else merged.delete(key);
      }
      return [...merged.values()];
    });
  }

  function applyRange(from: { row: number; col: number }, to: { row: number; col: number }, mode: Tool) {
    const next = new Map<string, Cell | null>();
    const rowStart = Math.min(from.row, to.row);
    const rowEnd = Math.max(from.row, to.row);
    const colStart = Math.min(from.col, to.col);
    const colEnd = Math.max(from.col, to.col);
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let col = colStart; col <= colEnd; col += 1) next.set(keyOf(row, col), paint({ row, col }, mode));
    }
    writeCells(next);
  }

  function toggleOne(pos: { row: number; col: number }) {
    const current = map.get(keyOf(pos.row, pos.col));
    if (tool === "sell" || tool === "unsell") {
      if (!current || current.kind !== "seat") return;
      writeCells(new Map([[keyOf(pos.row, pos.col), { ...current, sellable: current.sellable ? 0 : 1 }]]));
      return;
    }
    if (tool === "aisle") {
      writeCells(new Map([[keyOf(pos.row, pos.col), current?.kind === "aisle" ? null : paint(pos, "aisle")]]));
      return;
    }
    if (tool === "zone") {
      const same = current?.kind === "seat" && current.zoneId === zoneId;
      writeCells(new Map([[keyOf(pos.row, pos.col), same ? null : paint(pos, "zone")]]));
    }
  }

  function resize() {
    const nextRows = Math.max(1, Math.min(40, draftRows));
    const nextCols = Math.max(1, Math.min(60, draftCols));
    setRows(nextRows);
    setCols(nextCols);
    setCells((current) => current.filter((cell) => cell.row <= nextRows && cell.col < nextCols));
  }

  async function onSave() {
    setPending(true);
    const result = await saveSeats({
      venueId,
      rows,
      cols,
      zones: zoneState.map((zone) => ({ id: zone.id, numbering: zone.numbering })),
      cells: cells.filter((cell) => cell.kind === "seat" || cell.kind === "aisle").map((cell) => ({
        row: cell.row,
        col: cell.col,
        kind: cell.kind as "seat" | "aisle",
        zoneId: cell.zoneId,
        sellable: cell.sellable,
      })),
    });
    setPending(false);
    setMessage(result?.message ?? "保存失败");
    if (result?.ok) router.refresh();
  }

  const range = drag.current && cursor
    ? {
        rowStart: Math.min(drag.current.shift && anchor ? anchor.row : drag.current.row, cursor.row),
        rowEnd: Math.max(drag.current.shift && anchor ? anchor.row : drag.current.row, cursor.row),
        colStart: Math.min(drag.current.shift && anchor ? anchor.col : drag.current.col, cursor.col),
        colEnd: Math.max(drag.current.shift && anchor ? anchor.col : drag.current.col, cursor.col),
      }
    : null;

  return (
    <div className="stack">
      <section className="card stack">
        <div className="grid-3">
          <label className="field"><span>行数</span><input type="number" min={1} max={40} value={draftRows} onChange={(event) => setDraftRows(Number(event.target.value))} /></label>
          <label className="field"><span>列数</span><input type="number" min={1} max={60} value={draftCols} onChange={(event) => setDraftCols(Number(event.target.value))} /></label>
          <button className="btn" type="button" disabled={!editable} onClick={resize}>调整画布</button>
        </div>
        <p className="hint">加大画布会补上空白格，缩小只去掉范围外的格子，不会把某个分区整块删掉再生成。</p>
        <div className="choice-row">
          {TOOLS.map((item) => (
            <label key={item.id} className={`choice ${tool === item.id ? "on" : ""}`}>
              <input type="radio" checked={tool === item.id} onChange={() => setTool(item.id)} />
              {item.label}
            </label>
          ))}
        </div>
        <div className="actions">
          <label className="field" style={{ minWidth: 180 }}>
            <span>当前分区</span>
            <select value={zoneId} onChange={(event) => setZoneId(Number(event.target.value))}>
              {zoneState.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>编号</span>
            <select
              value={zoneState.find((zone) => zone.id === zoneId)?.numbering ?? "正序"}
              onChange={(event) => setZoneState((current) => current.map((zone) => zone.id === zoneId ? { ...zone, numbering: event.target.value as Numbering } : zone))}
            >
              {NUMBERINGS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className={`choice ${defaultSellable ? "on" : ""}`}>
            <input type="radio" checked={defaultSellable} onChange={() => setDefaultSellable(true)} /> 默认可售
          </label>
          <label className={`choice ${!defaultSellable ? "on" : ""}`}>
            <input type="radio" checked={!defaultSellable} onChange={() => setDefaultSellable(false)} /> 默认不可售
          </label>
          <button className="btn primary" type="button" disabled={!editable || pending} onClick={onSave}>{pending ? "保存中…" : "保存座位图"}</button>
        </div>
        <p className="hint">按住拖动或按住 Shift 划选一片；按住 Ctrl 或 Command 再点，可切换当前格子。过道和空白不进入库存，不可售座位留在分区里但不进入分销池。座位图不标价格和渠道。</p>
        {message ? <p className={message.includes("失败") || message.includes("请") ? "form-err" : "form-ok"}>{message}</p> : null}
      </section>
      <section className="card seat-map">
        <div className="stage">舞台</div>
        <div className="legend">
          {zoneState.map((zone) => {
            const count = cells.filter((cell) => cell.kind === "seat" && cell.zoneId === zone.id && cell.sellable).length;
            return <span key={zone.id}><i className="swatch" style={{ background: zone.color }} /> {zone.name} 可售 {count}</span>;
          })}
          <span>过道 {cells.filter((cell) => cell.kind === "aisle").length}</span>
        </div>
        <div
          className="canvas"
          onPointerDown={(event) => {
            if (!editable) return;
            const pos = readCell(event.target);
            if (!pos) return;
            if (event.ctrlKey || event.metaKey) {
              toggleOne(pos);
              setAnchor(pos);
              return;
            }
            drag.current = { ...pos, shift: event.shiftKey };
            setCursor(pos);
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const pos = readCell(document.elementFromPoint(event.clientX, event.clientY)) ?? cursor;
            if (pos) setCursor(pos);
          }}
          onPointerUp={(event) => {
            if (!drag.current) return;
            const pos = readCell(document.elementFromPoint(event.clientX, event.clientY)) ?? cursor ?? drag.current;
            const from = drag.current.shift && anchor ? anchor : drag.current;
            applyRange(from, pos, tool);
            setAnchor(pos);
            drag.current = null;
            setCursor(null);
          }}
        >
          {Array.from({ length: rows }, (_, index) => {
            const row = index + 1;
            return (
              <div className="seat-row" key={row}>
                <span className="row-label">{row}排</span>
                {Array.from({ length: cols }, (_, col) => {
                  const cell = map.get(keyOf(row, col));
                  const zone = zoneState.find((item) => item.id === cell?.zoneId);
                  const selected = range && row >= range.rowStart && row <= range.rowEnd && col >= range.colStart && col <= range.colEnd;
                  const label = cell?.kind === "seat" ? numbers.get(keyOf(row, col)) : "";
                  return (
                    <button
                      key={col}
                      type="button"
                      data-row={row}
                      data-col={col}
                      className={`seat ${cell?.kind === "aisle" ? "aisle" : ""} ${cell?.kind === "seat" && !cell.sellable ? "off" : ""} ${!cell ? "blank" : ""} ${selected ? "picked" : ""}`}
                      style={cell?.kind === "seat" && cell.sellable ? { background: zone?.color } : undefined}
                      title={cell?.kind === "aisle" ? "过道" : cell?.kind === "seat" ? `${zone?.name ?? ""} ${row}排${label}号` : "空白"}
                    >
                      {cell?.kind === "aisle" ? "" : label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function readCell(target: EventTarget | null) {
  const element = (target as HTMLElement | null)?.closest?.("[data-row]");
  if (!element) return null;
  return { row: Number((element as HTMLElement).dataset.row), col: Number((element as HTMLElement).dataset.col) };
}
