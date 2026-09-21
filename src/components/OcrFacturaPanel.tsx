import { useRef, useState } from 'react'
import { formatoARS, type ProductoFila } from '../lib/productos'
import {
  archivoABase64,
  fechaFacturaAIso,
  mejorMatchProducto,
  procesarFacturaConIA,
  type DatosFactura,
} from '../lib/ocr'
import { etiquetaProveedor, type ProveedorFila } from '../lib/proveedores'

const inputClass =
  'h-11 w-full rounded-md border border-[#E2E8F0] bg-[#EEF2F6] px-3 text-sm text-[#1A2F4A] outline-none focus:border-[#6366F1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'

export type ItemOcrMapeado = {
  uid: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  productoId: string
  productoNombre: string
}

export type ResultadoOcrCompra = {
  proveedor: string
  proveedorId: string | null
  cuit: string
  fecha: string
  numeroFactura: string
  tipo: string
  iva: number
  total: number
  items: ItemOcrMapeado[]
  archivo: File
}

type Fase = 'inicio' | 'preview' | 'procesando' | 'revision'

export function OcrFacturaPanel({
  catalogo,
  proveedores,
  onAplicar,
}: {
  catalogo: ProductoFila[]
  proveedores: ProveedorFila[]
  onAplicar: (datos: ResultadoOcrCompra, continuarFlujo: boolean) => void
}) {
  const galeriaRef = useRef<HTMLInputElement>(null)
  const camaraRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>('inicio')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [base64, setBase64] = useState('')
  const [mime, setMime] = useState('image/jpeg')
  const [error, setError] = useState<string | null>(null)
  const [proveedor, setProveedor] = useState('')
  const [cuit, setCuit] = useState('')
  const [fecha, setFecha] = useState('')
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState('A')
  const [iva, setIva] = useState('')
  const [total, setTotal] = useState('')
  const [items, setItems] = useState<ItemOcrMapeado[]>([])

  async function elegirArchivo(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const leido = await archivoABase64(file)
      if (preview) URL.revokeObjectURL(preview)
      setArchivo(file)
      setPreview(leido.previewUrl)
      setBase64(leido.base64)
      setMime(leido.mimeType)
      setFase('preview')
    } catch {
      setError('No pude leer la imagen. Probá con otro archivo.')
    }
  }

  function armarItems(datos: DatosFactura): ItemOcrMapeado[] {
    return (datos.items ?? []).map((it) => {
      const match = mejorMatchProducto(it.descripcion, catalogo)
      return {
        uid: crypto.randomUUID(),
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal || it.cantidad * it.precio_unitario,
        productoId: match?.producto.id ?? '',
        productoNombre: match?.producto.nombre ?? '',
      }
    })
  }

  async function procesar() {
    if (!base64) return
    setError(null)
    setFase('procesando')
    try {
      const datos = await procesarFacturaConIA(base64, mime)
      setProveedor(datos.proveedor ?? '')
      setCuit(datos.cuit ?? '')
      setFecha(fechaFacturaAIso(datos.fecha))
      setNumero(datos.numero_factura ?? '')
      const t = (datos.tipo_comprobante ?? 'A').toUpperCase().replace(/[^ABC]/g, '').slice(0, 1) || 'A'
      setTipo(t)
      setIva(datos.iva != null ? String(datos.iva) : '')
      setTotal(datos.total != null ? String(datos.total) : '')
      setItems(armarItems(datos))
      setFase('revision')
    } catch {
      setFase('preview')
      setError('No pude leer la factura. Intentá con mejor iluminación o completá manualmente.')
    }
  }

  function payload(): ResultadoOcrCompra | null {
    if (!archivo) return null
    const q = proveedor.trim().toLowerCase()
    const cuitN = cuit.replace(/\D/g, '')
    const hit =
      proveedores.find((p) => (p.cuit ?? '').replace(/\D/g, '') === cuitN && cuitN.length > 6) ??
      proveedores.find((p) => etiquetaProveedor(p).toLowerCase() === q) ??
      null
    return {
      proveedor: proveedor.trim(),
      proveedorId: hit?.id ?? null,
      cuit: cuit.trim(),
      fecha,
      numeroFactura: numero.trim(),
      tipo,
      iva: Number(iva.replace(',', '.')) || 0,
      total: Number(total.replace(',', '.')) || 0,
      items,
      archivo,
    }
  }

  function aplicar(continuar: boolean) {
    const datos = payload()
    if (!datos) return
    if (datos.items.some((it) => !it.productoId)) {
      setError('Mapeá cada ítem a un producto del catálogo')
      return
    }
    if (datos.items.length === 0) {
      setError('Agregá al menos un ítem')
      return
    }
    onAplicar(datos, continuar)
  }

  return (
    <div className="mb-5 rounded-md border border-[#E2E8F0] p-3">
      <p className="text-sm font-semibold text-[#1A2F4A]">📷 Cargar desde foto</p>
      <p className="mt-1 text-xs text-[#4A5568]">Sacá una foto de la factura y la IA carga los datos automáticamente</p>

      <input
        ref={galeriaRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(ev) => void elegirArchivo(ev.target.files?.[0])}
      />
      <input
        ref={camaraRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(ev) => void elegirArchivo(ev.target.files?.[0])}
      />

      {fase === 'inicio' || fase === 'preview' ? (
        <div className="mt-3 flex gap-2">
          <button
            className="h-10 flex-1 rounded-md border border-[#E2E8F0] text-xs font-semibold text-[#1A2F4A]"
            type="button"
            onClick={() => galeriaRef.current?.click()}
          >
            Seleccionar imagen
          </button>
          <button
            className="h-10 flex-1 rounded-md border border-[#E2E8F0] text-xs font-semibold text-[#1A2F4A]"
            type="button"
            onClick={() => camaraRef.current?.click()}
          >
            Usar cámara
          </button>
        </div>
      ) : null}

      {preview && fase !== 'revision' ? (
        <img src={preview} alt="Factura" className="mt-3 max-h-40 w-full rounded-md object-contain bg-[#EEF2F6]" />
      ) : null}

      {fase === 'preview' ? (
        <button
          className="mt-3 h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
          type="button"
          onClick={() => void procesar()}
        >
          Procesar con IA 🤖
        </button>
      ) : null}

      {fase === 'procesando' ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-sm text-[#1A2F4A]">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#6366F1]" />
          <p>🤖 Analizando factura...</p>
          <p className="text-xs text-[#4A5568]">Leyendo factura...</p>
        </div>
      ) : null}

      {fase === 'revision' ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-[#1A2F4A]">✅ Datos detectados — revisá antes de confirmar</p>
          {preview ? (
            <img src={preview} alt="Factura" className="max-h-28 w-full rounded-md object-contain bg-[#EEF2F6]" />
          ) : null}
          <label className="block text-xs text-[#4A5568]">
            Proveedor
            <input className={`${inputClass} mt-1 h-9`} value={proveedor} onChange={(ev) => setProveedor(ev.target.value)} />
          </label>
          <label className="block text-xs text-[#4A5568]">
            CUIT
            <input className={`${inputClass} mt-1 h-9`} value={cuit} onChange={(ev) => setCuit(ev.target.value)} />
          </label>
          <label className="block text-xs text-[#4A5568]">
            Fecha
            <input className={`${inputClass} mt-1 h-9`} type="date" value={fecha} onChange={(ev) => setFecha(ev.target.value)} />
          </label>
          <label className="block text-xs text-[#4A5568]">
            N° Factura
            <input className={`${inputClass} mt-1 h-9`} value={numero} onChange={(ev) => setNumero(ev.target.value)} />
          </label>
          <label className="block text-xs text-[#4A5568]">
            Tipo
            <select className={`${inputClass} mt-1 h-9`} value={tipo} onChange={(ev) => setTipo(ev.target.value)}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.uid} className="rounded-md border border-[#E2E8F0] p-2">
                <p className="text-xs font-medium text-[#1A2F4A]">{it.descripcion}</p>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  <label className="text-[11px] text-[#4A5568]">
                    Cant.
                    <input
                      className={`${inputClass} mt-0.5 h-8 px-2`}
                      inputMode="numeric"
                      value={it.cantidad}
                      onChange={(ev) => {
                        const n = Number.parseInt(ev.target.value, 10)
                        setItems((prev) =>
                          prev.map((x) =>
                            x.uid === it.uid ? { ...x, cantidad: Number.isFinite(n) ? n : 0 } : x,
                          ),
                        )
                      }}
                    />
                  </label>
                  <label className="text-[11px] text-[#4A5568]">
                    Precio
                    <input
                      className={`${inputClass} mt-0.5 h-8 px-2`}
                      inputMode="decimal"
                      value={it.precio_unitario}
                      onChange={(ev) => {
                        const n = Number(ev.target.value.replace(',', '.'))
                        setItems((prev) =>
                          prev.map((x) =>
                            x.uid === it.uid ? { ...x, precio_unitario: Number.isFinite(n) ? n : 0 } : x,
                          ),
                        )
                      }}
                    />
                  </label>
                  <p className="self-end text-right text-[11px] text-[#1A2F4A]">
                    {formatoARS(it.cantidad * it.precio_unitario)}
                  </p>
                </div>
                <label className="mt-1 block text-[11px] text-[#4A5568]">
                  {it.productoId ? 'Producto del catálogo' : '¿A qué producto corresponde esto?'}
                  <select
                    className={`${inputClass} mt-0.5 h-8`}
                    value={it.productoId}
                    onChange={(ev) => {
                      const id = ev.target.value
                      const p = catalogo.find((c) => c.id === id)
                      setItems((prev) =>
                        prev.map((x) =>
                          x.uid === it.uid
                            ? { ...x, productoId: id, productoNombre: p?.nombre ?? '' }
                            : x,
                        ),
                      )
                    }}
                  >
                    <option value="">Elegí un producto</option>
                    {catalogo.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="mt-1 text-[11px] text-[#DC2626]"
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.uid !== it.uid))}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-xs font-semibold text-[#6366F1]"
            type="button"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                {
                  uid: crypto.randomUUID(),
                  descripcion: '',
                  cantidad: 1,
                  precio_unitario: 0,
                  subtotal: 0,
                  productoId: '',
                  productoNombre: '',
                },
              ])
            }
          >
            + Agregar item manualmente
          </button>
          <label className="block text-xs text-[#4A5568]">
            IVA
            <input className={`${inputClass} mt-1 h-9`} inputMode="decimal" value={iva} onChange={(ev) => setIva(ev.target.value)} />
          </label>
          <label className="block text-xs text-[#4A5568]">
            Total
            <input className={`${inputClass} mt-1 h-9`} inputMode="decimal" value={total} onChange={(ev) => setTotal(ev.target.value)} />
          </label>
          <button
            className="h-11 w-full rounded-md bg-[#6366F1] text-sm font-semibold text-white hover:bg-[#4F46E5]"
            type="button"
            onClick={() => aplicar(true)}
          >
            ✅ Confirmar y continuar
          </button>
          <button
            className="h-11 w-full rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#4A5568]"
            type="button"
            onClick={() => aplicar(false)}
          >
            ✏️ Editar manualmente
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      {fase === 'inicio' ? (
        <p className="mt-4 text-center text-xs font-medium text-[#94A3B8]">─── o completá manualmente ───</p>
      ) : null}
    </div>
  )
}
