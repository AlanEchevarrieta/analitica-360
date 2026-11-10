export type Plataforma = "android" | "ios" | "mac" | "compu";
export type Navegador = "safari" | "chrome" | "edge" | "samsung" | "firefox" | "interno" | "otro";

export interface Dispositivo {
  plataforma: Plataforma;
  navegador: Navegador;
  instalada: boolean;
}

/**
 * Detecta plataforma, navegador y si la PWA ya corre instalada (`standalone`),
 * de forma pura y testeable sin tocar `window` ni `navigator`.
 */
export function detectarDispositivo(
  ua: string,
  maxTouchPoints: number,
  standalone: boolean,
): Dispositivo {
  const u = ua || "";

  // 1. Plataforma
  let plataforma: Plataforma = "compu";
  if (/Android/i.test(u)) {
    plataforma = "android";
  } else if (/iPhone|iPad|iPod/i.test(u) || (/Macintosh/i.test(u) && maxTouchPoints > 1)) {
    // iPad con iPadOS se reporta como Macintosh pero tiene pantalla táctil (>1 punto).
    plataforma = "ios";
  } else if (/Macintosh|Mac OS X/i.test(u)) {
    plataforma = "mac";
  }

  // 2. Navegador interno (Instagram, Facebook, WhatsApp, TikTok, Line, Android WebView)
  const esInterno =
    /Instagram|FBAN|FBAV|WhatsApp|TikTok|musical_ly|Line\/|; wv\)/i.test(u);

  let navegador: Navegador = "otro";
  if (esInterno) {
    navegador = "interno";
  } else if (plataforma === "ios") {
    if (/CriOS/i.test(u)) navegador = "chrome";
    else if (/EdgiOS/i.test(u)) navegador = "edge";
    else if (/FxiOS/i.test(u)) navegador = "firefox";
    else if (/Safari/i.test(u)) navegador = "safari";
  } else if (plataforma === "android") {
    if (/SamsungBrowser/i.test(u)) navegador = "samsung";
    else if (/EdgA/i.test(u)) navegador = "edge";
    else if (/Firefox|FxiOS/i.test(u)) navegador = "firefox";
    else if (/Chrome/i.test(u)) navegador = "chrome";
  } else {
    // Mac o compu
    if (/Edg\//i.test(u)) navegador = "edge";
    else if (/Firefox\//i.test(u)) navegador = "firefox";
    else if (/Chrome\//i.test(u) && !/Edg\//i.test(u)) navegador = "chrome";
    else if (/Safari\//i.test(u) && !/Chrome\//i.test(u)) navegador = "safari";
  }

  return {
    plataforma,
    navegador,
    instalada: Boolean(standalone),
  };
}
