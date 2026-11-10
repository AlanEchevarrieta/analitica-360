"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ItemCarrito } from "./types";

const STORAGE_KEY = "acacia_carrito_v1";

interface CarritoContextType {
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
  subtotal: number;
}

const CarritoContext = createContext<CarritoContextType | null>(null);

let itemsCache: ItemCarrito[] = [];
let isDrawerOpen = false;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function leerAlmacenamiento(): ItemCarrito[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    itemsCache = JSON.parse(raw);
    return itemsCache;
  } catch {
    return [];
  }
}

function guardarAlmacenamiento(items: ItemCarrito[]) {
  itemsCache = items;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  emitChange();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, leerAlmacenamiento, () => []);

  const abrir = useCallback(() => {
    isDrawerOpen = true;
    emitChange();
  }, []);

  const cerrar = useCallback(() => {
    isDrawerOpen = false;
    emitChange();
  }, []);

  const toggle = useCallback(() => {
    isDrawerOpen = !isDrawerOpen;
    emitChange();
  }, []);

  const agregar = useCallback((item: Omit<ItemCarrito, "cantidad">, cantidad = 1) => {
    const actuales = [...leerAlmacenamiento()];
    const indice = actuales.findIndex(
      (it) => it.productoId === item.productoId && (it.varianteId ?? null) === (item.varianteId ?? null)
    );

    if (indice >= 0) {
      actuales[indice] = {
        ...actuales[indice],
        cantidad: actuales[indice].cantidad + cantidad,
      };
    } else {
      actuales.push({ ...item, cantidad });
    }

    guardarAlmacenamiento(actuales);
    isDrawerOpen = true;
  }, []);

  const quitar = useCallback((productoId: string, varianteId: string | null) => {
    const actuales = leerAlmacenamiento().filter(
      (it) => !(it.productoId === productoId && (it.varianteId ?? null) === (varianteId ?? null))
    );
    guardarAlmacenamiento(actuales);
  }, []);

  const setCantidad = useCallback((productoId: string, varianteId: string | null, cantidad: number) => {
    if (cantidad <= 0) {
      quitar(productoId, varianteId);
      return;
    }
    const actuales = leerAlmacenamiento().map((it) => {
      if (it.productoId === productoId && (it.varianteId ?? null) === (varianteId ?? null)) {
        return { ...it, cantidad };
      }
      return it;
    });
    guardarAlmacenamiento(actuales);
  }, [quitar]);

  const vaciar = useCallback(() => {
    guardarAlmacenamiento([]);
  }, []);

  const totalItems = useMemo(() => items.reduce((acc, it) => acc + it.cantidad, 0), [items]);
  const subtotal = useMemo(() => items.reduce((acc, it) => acc + it.precio * it.cantidad, 0), [items]);

  return (
    <CarritoContext.Provider
      value={{
        items,
        abierto: isDrawerOpen,
        abrir,
        cerrar,
        toggle,
        agregar,
        quitar,
        setCantidad,
        vaciar,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CarritoContext.Provider>
  );
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) {
    throw new Error("useCarrito debe usarse dentro de un CarritoProvider");
  }
  return ctx;
}
