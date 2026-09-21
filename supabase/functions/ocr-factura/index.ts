import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { imagenBase64, mimeType } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), {
        status: 500,
        headers: cors,
      })
    }
    if (!imagenBase64) {
      return new Response(JSON.stringify({ error: 'Falta la imagen' }), {
        status: 400,
        headers: cors,
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analizá esta factura argentina y extraé los datos en formato JSON.
Devolvé SOLO un objeto JSON con esta estructura exacta, sin texto adicional:
{
  "proveedor": "nombre del proveedor o razón social",
  "cuit": "XX-XXXXXXXX-X",
  "fecha": "DD/MM/YYYY",
  "numero_factura": "XXXX-XXXXXXXX",
  "tipo_comprobante": "A, B o C",
  "items": [
    {
      "descripcion": "nombre del producto",
      "cantidad": 1,
      "precio_unitario": 1000,
      "subtotal": 1000
    }
  ],
  "subtotal": 0,
  "iva": 0,
  "total": 0
}
Si no podés leer algún campo, poné null.
Todos los montos deben ser números, sin símbolo de pesos.`,
                },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: imagenBase64 } },
              ],
            },
          ],
        }),
      },
    )

    const data = await response.json()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Error en Gemini' }), {
        status: 502,
        headers: cors,
      })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return new Response(JSON.stringify({ error: 'Error en OCR' }), {
        status: 502,
        headers: cors,
      })
    }
    const jsonStr = text.replace(/```json|```/g, '').trim()

    return new Response(jsonStr, { headers: cors })
  } catch {
    return new Response(JSON.stringify({ error: 'Error en OCR' }), {
      status: 500,
      headers: cors,
    })
  }
})
