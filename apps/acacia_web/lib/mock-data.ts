import type { Producto, SitioConfig } from "./types";

export const ACACIA_CONFIG_DEFAULT: SitioConfig = {
  empresaId: "47d60e49-bf3b-4ca4-915f-3269c5fdbcf9",
  subdominio: "acacia",
  nombre: "Acacia Mates",
  descripcion: "Mates artesanales de calabaza y madera noble, bombillas de alpaca cincelada y marroquinería matera en cuero genuino.",
  color: "#8a5a2b",
  logoUrl: null,
  whatsapp: "2615551234",
  instagram: "acaciamates",
  textoEnvios: "Envíos a todo el país por Correo Argentino y Andreani. Retiro en taller coordinando previamente.",
  alias: "acacia.mates",
  cbu: "0000003100010000000001",
  titular: "Acacia Mates SRL",
  pedidoMinimo: 5000,
  descuentoTransferencia: 10,
};

export const MOCK_PRODUCTOS: Producto[] = [
  {
    id: "192e95c3-6cda-4848-ad73-f82a5c377361",
    nombre: "Mate Imperial de Calabaza y Cuero",
    categoria: "Mates",
    categoriaSlug: "mates",
    precio: 35000,
    precioLista: 38500,
    descuentoPct: 9,
    slug: "mate-imperial-calabaza-cuero",
    descripcion: "Pieza insignia de Acacia. Calabaza brasilera de pared gruesa seleccionada a mano, forrada en cuero vacuno legítimo de curtido vegetal con costura artesanal a la vista. Coronada con virola de alpaca maciza cincelada.",
    imagenes: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=85"
    ],
    miniaturas: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=600&q=80"
    ],
    stock: 14,
    vendidos: 142,
    detalles: {
      material: "Calabaza brasilera de pared gruesa + Cuero vacuno 2.5mm",
      virola: "Alpaca maciza cincelada a mano con guarda pampa",
      origen: "Confección artesanal en taller mendocino",
      curado: "Curado tradicional con yerba usada durante 72 horas",
      capacidadAprox: "180 - 220 ml",
      pesoGramos: 360,
    },
    variantes: [
      { id: "v1", sku: "MIMP-NEGRO", atributos: { Color: "Cuero Negro Azabache" }, precio: 35000, precioLista: 38500, activo: true, stock: 8 },
      { id: "v2", sku: "MIMP-SUELA", atributos: { Color: "Cuero Suela Natural" }, precio: 35000, precioLista: 38500, activo: true, stock: 6 },
    ],
  },
  {
    id: "afb28ba3-55d5-493e-813c-ddea6eb8544c",
    nombre: "Bombilla Pico de Loro Alpaca Maciza",
    categoria: "Bombillas",
    categoriaSlug: "bombillas",
    precio: 6000,
    precioLista: 6000,
    descuentoPct: 0,
    slug: "bombilla-pico-loro-alpaca",
    descripcion: "Bombilla forjada en alpaca alemana maciza con curvatura ergonómica tipo pico de loro. Filtro ranurado desmontable de alta precisión que evita el paso del polvillo sin taparse.",
    imagenes: [
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=85"
    ],
    miniaturas: [
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80"
    ],
    stock: 35,
    vendidos: 290,
    detalles: {
      material: "Alpaca pura maciza 1.2mm",
      virola: "Boquilla cincelada con disipador térmico",
      origen: "Orfebrería criolla",
      curado: "No requiere curado previo. Lavado con agua tibia.",
      pesoGramos: 65,
    },
    variantes: [],
  },
  {
    id: "c2067b52-41b0-4af2-9f42-2d7f7c7a3cbe",
    nombre: "Bolso Matero de Cuero Rústico",
    categoria: "Bolsos",
    categoriaSlug: "bolsos",
    precio: 55000,
    precioLista: 62000,
    descuentoPct: 11,
    slug: "bolso-matero-cuero-rustico",
    descripcion: "Diseñado para expediciones y uso diario. Estructura semi-rígida en cuero vaqueta curtido con taninos vegetales. Compartimento acolchado para termo de 1.4L, mate imperial, lata de yerba y bolsillo interior para bombilla.",
    imagenes: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85"
    ],
    miniaturas: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80"
    ],
    stock: 9,
    vendidos: 85,
    detalles: {
      material: "Cuero vaqueta 100% legítimo de primera selección",
      origen: "Talabartería tradicional",
      curado: "Nutrición con grasa de potro / ceras naturales",
      pesoGramos: 850,
    },
    variantes: [
      { id: "vb1", sku: "BOLS-MARRON", atributos: { Tono: "Marrón Tabaco" }, precio: 55000, precioLista: 62000, activo: true, stock: 5 },
      { id: "vb2", sku: "BOLS-CRUDO", atributos: { Tono: "Suela Envejecido" }, precio: 55000, precioLista: 62000, activo: true, stock: 4 },
    ],
  },
  {
    id: "c746d7f5-f63e-4d5f-9f07-db9c4a024c60",
    nombre: "Mate Imperial de Madera Noble (Algarrobo)",
    categoria: "Mates",
    categoriaSlug: "mates",
    precio: 25000,
    precioLista: 25000,
    descuentoPct: 0,
    slug: "mate-imperial-madera-algarrobo",
    descripcion: "Torneado en una sola pieza de algarrobo macizo estacionado. Aporta una suavidad aromática inconfundible a la infusión. Terminación pulida a mano con cera de abeja natural.",
    imagenes: [
      "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=1200&q=85"
    ],
    miniaturas: [
      "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80"
    ],
    stock: 18,
    vendidos: 110,
    detalles: {
      material: "Madera de algarrobo macizo de monte",
      virola: "Alpaca cincelada lisa",
      origen: "Norte argentino / Cuyo",
      curado: "Untar con manteca o aceite comestible y dejar 24h",
      capacidadAprox: "160 - 200 ml",
      pesoGramos: 310,
    },
    variantes: [],
  },
  {
    id: "d02ed278-47d8-4915-b030-82de038dd49f",
    nombre: "Canasto Criollo para Asado y Fuego",
    categoria: "Canastos",
    categoriaSlug: "canastos",
    precio: 59000,
    precioLista: 65000,
    descuentoPct: 9,
    slug: "canasto-asado-fuego",
    descripcion: "El compañero indispensable del ritual del fuego. Armazón de hierro forjado reforzado con canasta tejida en mimbre silvestre y manijas de cuero cosidas a lezna.",
    imagenes: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85"
    ],
    miniaturas: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80"
    ],
    stock: 6,
    vendidos: 44,
    detalles: {
      material: "Hierro forjado + Mimbre de río + Asas de cuero",
      origen: "Herrería y cestería artesanal",
      curado: "Curado de metal con aceite de lino",
      pesoGramos: 1400,
    },
    variantes: [],
  },
  {
    id: "02933666-0689-4ec2-babc-8ad7c0dde086",
    nombre: "Chau Latas Materas de Cuero (Set x2)",
    categoria: "Accesorios",
    categoriaSlug: "accesorios",
    precio: 6000,
    precioLista: 6000,
    descuentoPct: 0,
    slug: "chau-latas-grandes-cuero",
    descripcion: "Fundas materas flexibles confeccionadas en cordura impermeable exterior con detalles en cuero genuino. Reemplazan las latas ruidosas con un cierre vertedor hermético y seguro.",
    imagenes: [
      "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=85"
    ],
    miniaturas: [
      "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80"
    ],
    stock: 22,
    vendidos: 215,
    detalles: {
      material: "Cordura resinada impermeable con vivo en cuero vacuno",
      origen: "Confección textil artesanal",
      curado: "Lavable en frío",
      pesoGramos: 120,
    },
    variantes: [],
  },
];
