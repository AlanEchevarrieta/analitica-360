"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CLAVE_STORAGE_PALETA, PALETA_DEFAULT, esPaleta, type ClavePaleta } from "@/lib/paletas";

// La fuente de verdad es el atributo data-paleta de <html> (lo pone el script
// del <head> al cargar); se observa con un MutationObserver para que todos los
// selectores abiertos se enteren del cambio.
function suscribir(aviso: () => void) {
  const observer = new MutationObserver(aviso);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-paleta"] });
  return () => observer.disconnect();
}

function leer(): ClavePaleta {
  const actual = document.documentElement.dataset.paleta;
  return esPaleta(actual) ? actual : PALETA_DEFAULT;
}

export function usePaleta() {
  const paleta = useSyncExternalStore(suscribir, leer, () => PALETA_DEFAULT);

  const setPaleta = useCallback((nueva: ClavePaleta) => {
    document.documentElement.dataset.paleta = nueva;
    try {
      localStorage.setItem(CLAVE_STORAGE_PALETA, nueva);
    } catch {
      // Navegación privada / almacenamiento bloqueado: se aplica igual, solo no se recuerda.
    }
  }, []);

  return { paleta, setPaleta };
}
