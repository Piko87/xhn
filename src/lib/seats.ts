import type { Numbering } from "./constants";

export type CellKind = "seat" | "aisle" | "empty";

export function seatSequence(cols: number, mode: Numbering) {
  if (cols <= 0) return [];
  if (mode === "正序") return Array.from({ length: cols }, (_, index) => index + 1);
  if (mode === "倒序") return Array.from({ length: cols }, (_, index) => cols - index);
  const odds: number[] = [];
  const evens: number[] = [];
  for (let number = 1; number <= cols; number += 1) {
    if (number % 2) odds.push(number);
    else evens.push(number);
  }
  if (mode === "奇数在左") return [...odds.reverse(), ...evens];
  return [...evens.reverse(), ...odds];
}

export function seatLabel(zoneName: string, rowLabel: string, seatNo: number) {
  return `${zoneName} ${rowLabel}${seatNo}号`;
}

export type NumberedCell = {
  row: number;
  col: number;
  kind: CellKind;
  zoneId: number | null;
};

export function numberCells(cells: NumberedCell[], zones: { id: number; numbering: Numbering }[]) {
  const numbers = new Map<string, number>();
  for (const zone of zones) {
    const mine = cells.filter((cell) => cell.kind === "seat" && cell.zoneId === zone.id);
    const rows = [...new Set(mine.map((cell) => cell.row))].sort((a, b) => a - b);
    for (const row of rows) {
      const line = mine.filter((cell) => cell.row === row).sort((a, b) => a.col - b.col);
      const sequence = seatSequence(line.length, zone.numbering);
      line.forEach((cell, index) => numbers.set(`${cell.row}:${cell.col}`, sequence[index] ?? index + 1));
    }
  }
  return numbers;
}
