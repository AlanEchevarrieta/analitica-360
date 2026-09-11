declare module 'jsbarcode' {
  function JsBarcode(
    element: SVGSVGElement | HTMLCanvasElement | string,
    data: string,
    options?: {
      format?: string
      width?: number
      height?: number
      displayValue?: boolean
      fontSize?: number
      margin?: number
      background?: string
      lineColor?: string
      font?: string
    },
  ): void
  export default JsBarcode
}
