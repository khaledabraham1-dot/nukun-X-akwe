import {useEffect, useRef} from "react"

// Guilloché de la carte de portefeuille, tracé à la résolution de l’écran.
export function Engraving() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const {width, height} = canvas.getBoundingClientRect()
      if (!width || !height) return
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.scale(scale, scale)
      ctx.translate(width * .61, height * .48)
      const radius = Math.min(height * .49, width * .43)
      for (let line = 0; line < 116; line++) {
        const t = line / 115
        ctx.beginPath()
        ctx.strokeStyle = `rgba(212,235,150,${.28 + .47*t})`
        ctx.lineWidth = .65
        for (let i = 0; i <= 640; i++) {
          const angle = i / 640 * Math.PI * 2
          const r = radius * (.21 + .78*t + .105*Math.sin(11*angle + 8*t) + .033*Math.cos(22*angle - 6*t))
          const x = r * Math.cos(angle)
          const y = r * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  return <canvas ref={ref} className="engraving" aria-hidden="true"/>
}