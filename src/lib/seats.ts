import type { Numbering } from "./constants";

export function seatSequence(cols: number, mode: Numbering) {
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
