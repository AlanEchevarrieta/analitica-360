/** CSV para Excel en español: separador ";", BOM UTF-8 (tildes) y CRLF. */
export function aCsv(filas: Record<string, unknown>[]) {
  if (filas.length === 0) return "";
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const celda = (v: unknown) => {
    const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  return "﻿" + [columnas.join(";"), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(";"))].join("\r\n");
}

/** Descarga las filas como archivo .csv desde el navegador. */
export function descargarCsv(nombre: string, filas: Record<string, unknown>[]) {
  const url = URL.createObjectURL(new Blob([aCsv(filas)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${nombre}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
