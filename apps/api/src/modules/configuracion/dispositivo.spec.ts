import { describe, expect, it } from 'vitest';
import { detectarDispositivo } from '../../../../web/src/lib/dispositivo.js';

describe('detectarDispositivo (web)', () => {
  it('detecta iPhone con Safari y con Chrome (CriOS)', () => {
    expect(
      detectarDispositivo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Version/17.4 Mobile/15E148 Safari/604.1',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'ios', navegador: 'safari', instalada: false });

    expect(
      detectarDispositivo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'ios', navegador: 'chrome', instalada: false });
  });

  it('detecta iPad con iPadOS (Macintosh + maxTouchPoints > 1)', () => {
    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.4 Safari/605.1.15',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'ios', navegador: 'safari', instalada: false });
  });

  it('detecta Android con Chrome y Samsung Internet', () => {
    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/123.0.0.0 Mobile Safari/537.36',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'android', navegador: 'chrome', instalada: false });

    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'android', navegador: 'samsung', instalada: false });
  });

  it('detecta navegadores internos (Instagram, WhatsApp, Android WebView)', () => {
    expect(
      detectarDispositivo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Instagram 324.0',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'ios', navegador: 'interno', instalada: false });

    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) Version/4.0 Chrome/123.0 Mobile Safari/537.36 Instagram 324.0',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'android', navegador: 'interno', instalada: false });

    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1',
        5,
        false,
      ),
    ).toEqual({ plataforma: 'android', navegador: 'interno', instalada: false });
  });

  it('detecta Mac Safari, Windows Chrome, Windows Firefox y modo standalone', () => {
    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.4 Safari/605.1.15',
        0,
        false,
      ),
    ).toEqual({ plataforma: 'mac', navegador: 'safari', instalada: false });

    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0 Safari/537.36',
        0,
        false,
      ),
    ).toEqual({ plataforma: 'compu', navegador: 'chrome', instalada: false });

    expect(
      detectarDispositivo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
        0,
        true,
      ),
    ).toEqual({ plataforma: 'compu', navegador: 'firefox', instalada: true });
  });
});
