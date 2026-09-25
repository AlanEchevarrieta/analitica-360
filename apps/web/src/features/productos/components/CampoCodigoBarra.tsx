"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EscanerCamara } from "./EscanerCamara";

/** Código de barras: a mano, con el lector USB (escribe y manda Enter) o con la cámara. */
export function CampoCodigoBarra({ valor, onCambiar }: { valor: string; onCambiar: (valor: string) => void }) {
  const [camara, setCamara] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id="producto-codigo"
          placeholder="Escaneá o escribí el código"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          onKeyDown={(e) => {
            // El lector USB manda Enter al final: que no envíe el formulario.
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        {!camara && (
          <Button variant="outline" onClick={() => setCamara(true)}>
            <Camera aria-hidden /> Escanear
          </Button>
        )}
      </div>
      {camara && (
        <EscanerCamara
          onCodigo={(codigo) => {
            onCambiar(codigo);
            setCamara(false);
          }}
          onCerrar={() => setCamara(false)}
        />
      )}
    </div>
  );
}
