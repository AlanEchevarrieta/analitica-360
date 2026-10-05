"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * El código de un link de recomendación (/sign-up?codigo=X) se guarda en el navegador
 * para completarlo solo en la bienvenida, después de crear la cuenta en Clerk.
 */
const CLAVE = "a360-codigo-registro";

export function GuardarCodigoDelLink() {
  const codigo = useSearchParams().get("codigo");
  useEffect(() => {
    if (!codigo) return;
    try {
      localStorage.setItem(CLAVE, codigo.slice(0, 40));
    } catch {
      /* sin almacenamiento: lo escribe a mano */
    }
  }, [codigo]);
  return null;
}

export function codigoGuardado(): string {
  try {
    return localStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

export function olvidarCodigo() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}
