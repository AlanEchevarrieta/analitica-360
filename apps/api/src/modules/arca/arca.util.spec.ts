import { describe, expect, it } from 'vitest';
import { armarTRA, cuitValido, leerCAE, leerTicketAcceso, leerUltimoAutorizado, numeroCompleto, pedidoCAE, TIPO, urlQR } from './arca.util.js';

describe('cuitValido', () => {
  it('controla el dígito verificador', () => {
    expect(cuitValido('20-12345678-6')).toBe(true);
    expect(cuitValido('20123456780')).toBe(false);
    expect(cuitValido('123')).toBe(false);
  });
});

describe('armarTRA', () => {
  it('pide el servicio con una ventana de 10 minutos en hora argentina', () => {
    const tra = armarTRA('wsfe', new Date('2026-10-08T15:00:00Z'));
    expect(tra).toContain('<service>wsfe</service>');
    expect(tra).toContain('<generationTime>2026-10-08T11:50:00-03:00</generationTime>');
    expect(tra).toContain('<expirationTime>2026-10-08T12:10:00-03:00</expirationTime>');
  });
});

describe('respuestas de ARCA', () => {
  it('ticket de acceso (viene escapado)', () => {
    const r = `<soap:Envelope><soap:Body><loginCmsResponse><loginCmsReturn>&lt;loginTicketResponse&gt;&lt;header&gt;&lt;expirationTime&gt;2026-10-09T03:00:00.000-03:00&lt;/expirationTime&gt;&lt;/header&gt;&lt;credentials&gt;&lt;token&gt;TOK&lt;/token&gt;&lt;sign&gt;FIR&lt;/sign&gt;&lt;/credentials&gt;&lt;/loginTicketResponse&gt;</loginCmsReturn></loginCmsResponse></soap:Body></soap:Envelope>`;
    expect(leerTicketAcceso(r)).toMatchObject({ token: 'TOK', firma: 'FIR' });
  });

  it('error de acceso', () => {
    expect(() => leerTicketAcceso('<soapenv:Fault><faultstring>Computador no autorizado a acceder al servicio</faultstring></soapenv:Fault>')).toThrow('Computador no autorizado');
  });

  it('último número autorizado', () => {
    expect(leerUltimoAutorizado('<FECompUltimoAutorizadoResult><PtoVta>2</PtoVta><CbteTipo>11</CbteTipo><CbteNro>41</CbteNro></FECompUltimoAutorizadoResult>')).toBe(41);
  });

  it('CAE aprobado y rechazado con su motivo', () => {
    expect(leerCAE('<FECAESolicitarResult><FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CAE>76123456789012</CAE><CAEFchVto>20261018</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult>')).toEqual({
      aprobado: true,
      cae: '76123456789012',
      vence: '2026-10-18',
      observaciones: [],
    });
    expect(leerCAE('<FECAESolicitarResult><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10016</Code><Msg>El numero de comprobante no es el proximo a autorizar</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp></FECAESolicitarResult>')).toEqual({
      aprobado: false,
      errores: ['10016: El numero de comprobante no es el proximo a autorizar'],
    });
  });
});

describe('pedidoCAE', () => {
  const auth = { token: 'T', firma: 'F', cuit: '20123456786' };
  it('Factura C a consumidor final: neto = total, sin IVA', () => {
    const xml = pedidoCAE(auth, { tipo: TIPO.FACTURA_C, puntoVenta: 2, numero: 42, fecha: '2026-10-08', total: 15000.5, concepto: 1, docTipo: 99, docNro: '0', condicionIvaReceptor: 5 });
    for (const parte of ['<ar:Cuit>20123456786</ar:Cuit>', '<ar:CbteTipo>11</ar:CbteTipo>', '<ar:CbteDesde>42</ar:CbteDesde>', '<ar:CbteFch>20261008</ar:CbteFch>', '<ar:ImpTotal>15000.50</ar:ImpTotal>', '<ar:ImpNeto>15000.50</ar:ImpNeto>', '<ar:ImpIVA>0.00</ar:ImpIVA>', '<ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>']) {
      expect(xml).toContain(parte);
    }
    expect(xml).not.toContain('FchServDesde');
    expect(xml).not.toContain('CbtesAsoc');
  });
  it('nota de crédito: lleva la factura que anula', () => {
    const xml = pedidoCAE(auth, { tipo: TIPO.NOTA_CREDITO_C, puntoVenta: 2, numero: 3, fecha: '2026-10-09', total: 100, concepto: 1, docTipo: 99, docNro: '0', condicionIvaReceptor: 5, asociado: { tipo: 11, puntoVenta: 2, numero: 42, cuit: '20123456786', fecha: '2026-10-08' } });
    expect(xml).toContain('<ar:CbteAsoc><ar:Tipo>11</ar:Tipo><ar:PtoVta>2</ar:PtoVta><ar:Nro>42</ar:Nro>');
  });
});

describe('urlQR y número', () => {
  it('el QR lleva los datos que pide ARCA', () => {
    const url = urlQR({ fecha: '2026-10-08', cuit: '20123456786', puntoVenta: 2, tipo: 11, numero: 42, total: 15000.5, docTipo: 99, docNro: '0', cae: '76123456789012' });
    const datos = JSON.parse(Buffer.from(url.split('?p=')[1], 'base64').toString());
    expect(datos).toEqual({ ver: 1, fecha: '2026-10-08', cuit: 20123456786, ptoVta: 2, tipoCmp: 11, nroCmp: 42, importe: 15000.5, moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: 76123456789012 });
  });
  it('número con punto de venta', () => {
    expect(numeroCompleto(2, 123)).toBe('00002-00000123');
  });
});
