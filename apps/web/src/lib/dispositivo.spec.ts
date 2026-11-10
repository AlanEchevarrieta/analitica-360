import { describe, expect, it } from "vitest";
import { detectarDispositivo } from "./dispositivo";

describe("detectarDispositivo", () => {
  it("detecta iPhone con Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(detectarDispositivo(ua, 5, false)).toEqual({
      plataforma: "ios",
      navegador: "safari",
      instalada: false,
    });
  });

  it("detecta iPhone con Chrome (CriOS)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1";
    expect(detectarDispositivo(ua, 5, false)).toEqual({
      plataforma: "ios",
      navegador: "chrome",
      instalada: false,
    });
  });

  it("detecta iPad con iPadOS (Macintosh + maxTouchPoints > 1)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
    expect(detectarDispositivo(ua, 5, false)).toEqual({
      plataforma: "ios",
      navegador: "safari",
      instalada: false,
    });
  });

  it("detecta Android con Chrome y con Samsung Internet", () => {
    const chromeUa =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
    expect(detectarDispositivo(chromeUa, 5, false)).toEqual({
      plataforma: "android",
      navegador: "chrome",
      instalada: false,
    });

    const samsungUa =
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36";
    expect(detectarDispositivo(samsungUa, 5, false)).toEqual({
      plataforma: "android",
      navegador: "samsung",
      instalada: false,
    });
  });

  it("detecta navegadores internos (Instagram, WhatsApp, WebView)", () => {
    const igIphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 Instagram 324.0.0.21.92";
    expect(detectarDispositivo(igIphone, 5, false)).toEqual({
      plataforma: "ios",
      navegador: "interno",
      instalada: false,
    });

    const igAndroid =
      "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.99 Mobile Safari/537.36 Instagram 324.0.0.0.0 Android";
    expect(detectarDispositivo(igAndroid, 5, false)).toEqual({
      plataforma: "android",
      navegador: "interno",
      instalada: false,
    });

    const whatsapp =
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1";
    expect(detectarDispositivo(whatsapp, 5, false)).toEqual({
      plataforma: "android",
      navegador: "interno",
      instalada: false,
    });
  });

  it("detecta Mac Safari, Windows Chrome y Firefox, y modo standalone", () => {
    const macSafari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
    expect(detectarDispositivo(macSafari, 0, false)).toEqual({
      plataforma: "mac",
      navegador: "safari",
      instalada: false,
    });

    const winChrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
    expect(detectarDispositivo(winChrome, 0, false)).toEqual({
      plataforma: "compu",
      navegador: "chrome",
      instalada: false,
    });

    const winFirefox =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";
    expect(detectarDispositivo(winFirefox, 0, true)).toEqual({
      plataforma: "compu",
      navegador: "firefox",
      instalada: true,
    });
  });
});
