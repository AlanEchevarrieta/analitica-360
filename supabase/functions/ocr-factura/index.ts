const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imagenBase64, mimeType } = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analizá esta factura argentina y extraé los datos en formato JSON.
Devolvé SOLO un objeto JSON sin texto adicional ni backticks:
{
  "proveedor": "nombre del proveedor o razon social",
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
Si no podes leer algun campo pone null.
Los montos deben ser numeros sin simbolo de pesos.`,
              },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: imagenBase64,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    const data = await response.json()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Error en Gemini' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return new Response(JSON.stringify({ error: 'Error en OCR' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jsonStr = text.replace(/```json|```/g, '').trim()

    return new Response(jsonStr, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en OCR'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
