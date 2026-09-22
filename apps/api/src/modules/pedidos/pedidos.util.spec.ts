import { itemPickingCompleto, siguienteEstadoPicking } from './pedidos.util.js';

describe('itemPickingCompleto', () => {
  it('true cuando lo preparado iguala lo pedido y hay cantidad', () => {
    expect(itemPickingCompleto({ cantidad: 3, cantidadPreparada: 3 })).toBe(true);
  });
  it('false cuando falta preparar', () => {
    expect(itemPickingCompleto({ cantidad: 3, cantidadPreparada: 2 })).toBe(false);
  });
  it('false cuando la cantidad pedida es 0', () => {
    expect(itemPickingCompleto({ cantidad: 0, cantidadPreparada: 0 })).toBe(false);
  });
});

describe('siguienteEstadoPicking', () => {
  it('no avanza estados ya despachados/entregados/cancelados', () => {
    expect(siguienteEstadoPicking('despachado', [])).toBe('despachado');
    expect(siguienteEstadoPicking('entregado', [])).toBe('entregado');
    expect(siguienteEstadoPicking('cancelado', [])).toBe('cancelado');
  });

  it('nuevo -> en_preparacion en cuanto algo tiene avance', () => {
    const items = [{ cantidad: 2, cantidadPreparada: 1, preparado: false }];
    expect(siguienteEstadoPicking('nuevo', items)).toBe('en_preparacion');
  });

  it('nuevo se mantiene si nada tiene avance', () => {
    const items = [{ cantidad: 2, cantidadPreparada: 0, preparado: false }];
    expect(siguienteEstadoPicking('nuevo', items)).toBe('nuevo');
  });

  it('desde listo_despacho, si se destapa un item incompleto retrocede a en_preparacion', () => {
    const items = [
      { cantidad: 2, cantidadPreparada: 2, preparado: true },
      { cantidad: 1, cantidadPreparada: 0, preparado: false },
    ];
    expect(siguienteEstadoPicking('listo_despacho', items)).toBe('en_preparacion');
  });

  it('desde listo_despacho, si todo sigue completo se mantiene', () => {
    const items = [{ cantidad: 2, cantidadPreparada: 2, preparado: true }];
    expect(siguienteEstadoPicking('listo_despacho', items)).toBe('listo_despacho');
  });
});
