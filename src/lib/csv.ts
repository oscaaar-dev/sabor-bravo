/**
 * CSV seguro para Excel/Google Sheets: UTF-8 con BOM, comillas siempre, y protección contra INYECCIÓN DE FÓRMULAS
 * (una celda que empiece por = + - @ o tabulación/retorno se interpretaría como fórmula al abrir el archivo; se le antepone
 * un apóstrofo para que se lea como texto). Los datos de clientes (nombre, notas, dirección) son texto no confiable.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = typeof value === "number" ? String(value) : value;
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Céntimos → "12.50" (decimal con punto, sin símbolo, para que las hojas de cálculo lo traten como número). */
export function centsToDecimal(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
