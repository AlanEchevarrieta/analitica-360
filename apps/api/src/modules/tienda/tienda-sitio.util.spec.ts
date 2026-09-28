import { normalizarDominio, problemaSubdominio, sitioDesdeHost, sugerirSubdominio, tipoImagen } from './tienda-sitio.util.js';

describe('dirección de la tienda', () => {
  it('sugiere un subdominio prolijo', () => {
    expect(sugerirSubdominio('Acacia Mates')).toBe('acacia-mates');
    expect(sugerirSubdominio('  Dietética "La Ñata" & Cía. ')).toBe('dietetica-la-nata-cia');
  });

  it('valida subdominios', () => {
    expect(problemaSubdominio('acacia')).toBeNull();
    expect(problemaSubdominio('acacia-mates-2')).toBeNull();
    expect(problemaSubdominio('ac')).toMatch(/3 letras/);
    expect(problemaSubdominio('Acacia')).toMatch(/minúsculas/);
    expect(problemaSubdominio('acacia--mates')).toMatch(/minúsculas/);
    expect(problemaSubdominio('-acacia')).toMatch(/minúsculas/);
    expect(problemaSubdominio('admin')).toMatch(/reservada/);
  });

  it('normaliza dominios propios', () => {
    expect(normalizarDominio('https://www.AcaciaMates.com.ar/tienda')).toBe('acaciamates.com.ar');
    expect(normalizarDominio('acacia.com:443')).toBe('acacia.com');
    expect(normalizarDominio('no es un dominio')).toBeNull();
    expect(normalizarDominio('localhost')).toBeNull();
  });

  it('encuentra la tienda desde el host', () => {
    expect(sitioDesdeHost('acacia.analitica360.app', 'analitica360.app')).toEqual({ tipo: 'subdominio', valor: 'acacia' });
    expect(sitioDesdeHost('acacia.localhost:3010', 'analitica360.app')).toEqual({ tipo: 'subdominio', valor: 'acacia' });
    expect(sitioDesdeHost('www.acaciamates.com.ar', 'analitica360.app')).toEqual({ tipo: 'dominio', valor: 'acaciamates.com.ar' });
    expect(sitioDesdeHost('analitica360.app', 'analitica360.app')).toBeNull();
    expect(sitioDesdeHost('www.analitica360.app', 'analitica360.app')).toBeNull();
    expect(sitioDesdeHost('a.b.analitica360.app', 'analitica360.app')).toBeNull();
    expect(sitioDesdeHost('localhost:3010', 'analitica360.app')).toBeNull();
  });

  it('reconoce imágenes por su contenido', () => {
    expect(tipoImagen(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('jpg');
    expect(tipoImagen(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
    expect(tipoImagen(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(2)]))).toBe('webp');
    expect(tipoImagen(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
