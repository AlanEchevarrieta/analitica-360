"use client";

import { useCallback, useSyncExternalStore } from "react";
import { COOKIE_PALETA, PALETA_DEFAULT, esPaleta, type ClavePaleta } from "@/lib/paletas";

// La fuente de verdad es el atributo data-paleta de <html> (lo pone el root
// layout leyendo la cookie); se observa con un MutationObserver para que todos los
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
    // Un año; la lee el root layout en el servidor.
    document.cookie = `${COOKIE_PALETA}=${nueva}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return { paleta, setPaleta };
}
