"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiFetch } from "@/hooks/use-api";
import { descargarCsv } from "@/lib/csv";

type Celda = string | number | null;
const COLUMNAS = ["Nombre", "Categoría", "Precio de venta", "Costo", "Stock inicial"];
/** La API acepta hasta 5000 filas por pedido; se manda de a 1000 para mostrar avance. */
const TANDA = 1000;

/** CSV simple: detecta ; o , y respeta comillas. */
function leerCsv(texto: string): Celda[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: Celda[][] = [];
  let fila: Celda[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda || fila.length) filas.push([...fila, celda]);
  return filas.filter((f) => f.some((x) => String(x ?? "").trim() !== ""));
}

async function leerArchivo(archivo: File): Promise<Celda[][]> {
  if (/\.csv$/i.test(archivo.name)) return leerCsv(await archivo.text());
  const { readSheet } = await import("read-excel-file/browser");
  const hoja = await readSheet(archivo);
  return hoja.map((fila) => fila.map((v) => (v == null ? null : typeof v === "number" ? v : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))));
}

/** Carga masiva de productos desde una planilla (Excel o CSV). */
export function ImportarProductosVista() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<Celda[][]>([]);
  const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<{ importados: number; saltados: string[] } | null>(null);

  async function elegir(f: File | undefined) {
    setResultado(null);
    if (!f) return;
    try {
      const datos = await leerArchivo(f);
      if (datos.length < 2) return toast.error("La planilla no tiene productos (la primera fila son los títulos).");
      setArchivo(f.name);
      setFilas(datos);
    } catch {
      toast.error("No pudimos leer el archivo. Guardalo como .xlsx o .csv y probá de nuevo.");
    }
  }

  async function importar() {
    const [titulos, ...datos] = filas;
    const total = datos.length;
    let importados = 0;
    const saltados: string[] = [];
    setAvance({ hechas: 0, total });
    try {
      for (let i = 0; i < total; i += TANDA) {
        const r = await api<{ importados: number; saltados: string[] }>("/import-export/productos", {
          method: "POST",
          body: JSON.stringify({ filas: [titulos, ...datos.slice(i, i + TANDA)] }),
        });
        importados += r.importados;
        saltados.push(...r.saltados);
        setAvance({ hechas: Math.min(i + TANDA, total), total });
      }
      setResultado({ importados, saltados });
      for (const k of ["productos", "categorias", "dashboard"]) void queryClient.invalidateQueries({ queryKey: [k] });
      toast.success(`${importados} productos importados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
      if (importados) setResultado({ importados, saltados });
    } finally {
      setAvance(null);
    }
  }

  const titulos = filas[0] ?? [];
  const datos = filas.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Prepará la planilla</CardTitle>
          <CardDescription>
            Una fila por producto. Columnas: {COLUMNAS.join(", ")}. Solo el nombre es obligatorio; el orden no importa si los títulos se llaman así. Los productos que ya existen (mismo nombre) no se
            duplican.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() =>
              descargarCsv("plantilla-productos", [
                { Nombre: "Mate imperial", Categoría: "Mates", "Precio de venta": 15000, Costo: 8000, "Stock inicial": 10 },
                { Nombre: "Bombilla pico de loro", Categoría: "Bombillas", "Precio de venta": 4500, Costo: 2000, "Stock inicial": 25 },
              ])
            }
          >
            <Download aria-hidden /> Descargar plantilla
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Subí el archivo</CardTitle>
          <CardDescription>Excel (.xlsx) o CSV. Se lee en tu compu: nada se guarda hasta que tocás Importar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className={buttonVariants({ variant: "outline", className: "cursor-pointer self-start" })}>
            <FileSpreadsheet aria-hidden /> {archivo ? "Elegir otro archivo" : "Elegir archivo"}
            <input type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Archivo de productos" onChange={(e) => void elegir(e.target.files?.[0])} />
          </label>
          {archivo && (
            <>
              <p className="text-sm">
                <b>{archivo}</b>: {datos.length} {datos.length === 1 ? "fila" : "filas"}
                {datos.length > 8 && " (se muestran las primeras 8)"}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    {titulos.map((t, i) => (
                      <TableHead key={i}>{String(t ?? "")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.slice(0, 8).map((f, i) => (
                    <TableRow key={i}>
                      {titulos.map((_, j) => (
                        <TableCell key={j} className="tabular-nums">
                          {String(f[j] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="self-start" onClick={() => void importar()} disabled={Boolean(avance) || datos.length > 20_000}>
                {avance ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                {avance ? `Importando ${avance.hechas} de ${avance.total}…` : `Importar ${datos.length} productos`}
              </Button>
              {datos.length > 20_000 && <p className="text-sm text-destructive">Máximo 20.000 productos por archivo: partilo en varios.</p>}
            </>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>
              Listo: {resultado.importados} {resultado.importados === 1 ? "producto importado" : "productos importados"}
            </CardTitle>
            {resultado.saltados.length > 0 && <CardDescription>{resultado.saltados.length} no se importaron (ya existían o tenían un dato inválido):</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {resultado.saltados.length > 0 && (
              <ul className="max-h-48 list-disc overflow-auto pl-5 text-sm text-muted-foreground">
                {resultado.saltados.slice(0, 200).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            <Link href="/productos" className={buttonVariants({ className: "self-start" })}>
              Ver mis productos
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
