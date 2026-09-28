"use client";

import Link from "next/link";
import { useSitio } from "@/lib/sitio-contexto";
import { urlWhatsApp } from "@/lib/whatsapp";

export function Footer() {
  const sitio = useSitio();
  const wa = urlWhatsApp(sitio.whatsapp, `Hola! Tengo una consulta sobre ${sitio.nombre}.`);
  const ig = sitio.instagram ? `https://instagram.com/${sitio.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}` : null;
  return (
    <footer id="contacto" className="mt-auto border-t border-[var(--marca-oscuro)]/15 bg-[var(--marca-oscuro)] text-[var(--crema)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-2xl">{sitio.nombre}</p>
          {sitio.descripcion ? <p className="mt-2 text-sm leading-6 text-[var(--crema)]/80">{sitio.descripcion}</p> : null}
        </div>
        {wa || ig ? (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">Contacto</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {ig ? (
                <a className="hover:text-white" href={ig} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              ) : null}
              {wa ? (
                <a className="hover:text-white" href={wa} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Tienda</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link className="hover:text-white" href="/productos">
              Productos
            </Link>
            <Link className="hover:text-white" href="/#sobre-nosotros">
              Sobre nosotros
            </Link>
          </div>
        </div>
      </div>
      <p className="border-t border-white/10 px-4 py-4 text-center text-sm text-[var(--crema)]/80">{sitio.textoEnvios || `${sitio.nombre} · Tienda online`}</p>
    </footer>
  );
}
