"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ItemCarrito = {
  productoId: string;
  varianteId: string | null;
  nombre: string;
  varianteEtiqueta: string;
  precio: number;
  cantidad: number;
  slug: string;
};

type CarritoContextValue = {
  items: ItemCarrito[];
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  toggle: () => void;
  agregar: (item: Omit<ItemCarrito, "cantidad">, cantidad?: number) => void;
  quitar: (productoId: string, varianteId: string | null) => void;
  setCantidad: (productoId: string, varianteId: string | null, cantidad: number) => void;
  vaciar: () => void;
  totalItems: number;
  total: number;
};

const STORAGE_KEY = "tienda-carrito";

const CarritoContext = createContext<CarritoContextValue | null>(null);

function mismaLinea(a: ItemCarrito, productoId: string, varianteId: string | null) {
  return a.productoId === productoId && (a.varianteId ?? null) === (varianteId ?? null);
}

// Store externo respaldado en localStorage, leído con useSyncExternalStore
// para evitar setState dentro de efectos y mismatches de hidratación.
const SIN_ITEMS: ItemCarrito[] = [];
let cache: ItemCarrito[] | null = null;
const listeners = new Set<() => void>();

function leerItems(): ItemCarrito[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    cache = Array.isArray(parsed) ? (parsed as ItemCarrito[]) : SIN_ITEMS;
  } catch {
    cache = SIN_ITEMS;
  }
  return cache;
}

function escribirItems(next: ItemCarrito[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function suscribir(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setItems(update: (prev: ItemCarrito[]) => ItemCarrito[]) {
  escribirItems(update(leerItems()));
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(suscribir, leerItems, () => SIN_ITEMS);
  const [abierto, setAbierto] = useState(false);

  const agregar = useCallback((item: Omit<ItemCarrito, "cantidad">, cantidad = 1) => {
    const qty = Math.max(1, cantidad);
    setItems((prev) => {
      const idx = prev.findIndex((p) => mismaLinea(p, item.productoId, item.varianteId));
      if (idx === -1) return [...prev, { ...item, cantidad: qty }];
      return prev.map((p, i) => (i === idx ? { ...p, cantidad: p.cantidad + qty } : p));
    });
    setAbierto(true);
  }, []);

  const quitar = useCallback((productoId: string, varianteId: string | null) => {
    setItems((prev) => prev.filter((p) => !mismaLinea(p, productoId, varianteId)));
  }, []);

  const setCantidad = useCallback(
    (productoId: string, varianteId: string | null, cantidad: number) => {
      const qty = Math.floor(cantidad);
      if (qty <= 0) {
        quitar(productoId, varianteId);
        return;
      }
      setItems((prev) =>
        prev.map((p) => (mismaLinea(p, productoId, varianteId) ? { ...p, cantidad: qty } : p)),
      );
    },
    [quitar],
  );

  const vaciar = useCallback(() => escribirItems(SIN_ITEMS), []);

  const value = useMemo<CarritoContextValue>(() => {
    const totalItems = items.reduce((acc, i) => acc + i.cantidad, 0);
    const total = items.reduce((acc, i) => acc + i.cantidad * i.precio, 0);
    return {
      items,
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      toggle: () => setAbierto((v) => !v),
      agregar,
      quitar,
      setCantidad,
      vaciar,
      totalItems,
      total,
    };
  }, [abierto, agregar, items, quitar, setCantidad, vaciar]);

  return createElement(CarritoContext.Provider, { value }, children);
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error("useCarrito debe usarse dentro de CarritoProvider");
  return ctx;
}
