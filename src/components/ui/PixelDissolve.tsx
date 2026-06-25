import { useRef, forwardRef, useImperativeHandle } from 'react'

export interface PixelDissolveHandle {
  trigger: (onMidpoint: () => void) => void
}

// ── tunables ──────────────────────────────────────────────────────────────────
const BLOCK       = 22          // px – crisp square size
const COVER_MS    = 430         // ms – sweep in
const HOLD_MS     = 90          // ms – fully opaque pause
const UNCOVER_MS  = 400         // ms – sweep out
const COL_WEIGHT  = 0.70        // how strongly column position drives timing
const RND_WEIGHT  = 0.30        // per-cell randomness (creates the scatter)

// purple gradient: dense/dark left edge → sparse/lighter leading edge
const DENSE: [number, number, number] = [45,  27,  69 ]  // #2D1B45
const EDGE:  [number, number, number] = [74,  44,  112]  // #4A2C70

// ── helpers ───────────────────────────────────────────────────────────────────
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function cellColor(tCol: number): string {
  const r = Math.round(lerp(DENSE[0], EDGE[0], tCol))
  const g = Math.round(lerp(DENSE[1], EDGE[1], tCol))
  const b = Math.round(lerp(DENSE[2], EDGE[2], tCol))
  return `rgb(${r},${g},${b})`
}

interface Cell {
  x: number; y: number; w: number; h: number
  showT: number   // 0-1 – when cell appears during cover sweep
  hideT: number   // 0-1 – when cell disappears during uncover sweep
  color: string
}

// ── component ─────────────────────────────────────────────────────────────────
const PixelDissolve = forwardRef<PixelDissolveHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useImperativeHandle(ref, () => ({
    trigger(onMidpoint) {
      const canvas = canvasRef.current
      if (!canvas) return

      // Graceful degradation: skip animation for reduced-motion preference
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onMidpoint()
        return
      }

      // Size canvas to physical pixels for crisp rendering
      const dpr = window.devicePixelRatio || 1
      const W   = window.innerWidth
      const H   = window.innerHeight
      canvas.width  = W * dpr
      canvas.height = H * dpr
      canvas.style.width  = `${W}px`
      canvas.style.height = `${H}px`

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      // Build cell grid
      const numCols = Math.ceil(W / BLOCK)
      const numRows = Math.ceil(H / BLOCK)
      const cells: Cell[] = []

      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          const tCol  = numCols > 1 ? col / (numCols - 1) : 0

          // Cover: left→right sweep with per-cell scatter
          const showT = Math.min(1, tCol * COL_WEIGHT + Math.random() * RND_WEIGHT)

          // Uncover: right→left (leading edge clears first, solid edge last)
          const hideT = Math.min(1, (1 - tCol) * COL_WEIGHT + Math.random() * RND_WEIGHT)

          cells.push({
            x: col * BLOCK,
            y: row * BLOCK,
            w: Math.min(BLOCK, W - col * BLOCK),  // clip last column
            h: Math.min(BLOCK, H - row * BLOCK),  // clip last row
            showT,
            hideT,
            color: cellColor(tCol),
          })
        }
      }

      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, W, H)

      const t0 = performance.now()
      let midpointFired = false

      function frame(now: number) {
        const elapsed = now - t0
        ctx.clearRect(0, 0, W, H)

        if (elapsed < COVER_MS) {
          // ── Cover sweep (left → right, dithered density) ──
          const p = easeInOutCubic(elapsed / COVER_MS)
          for (const c of cells) {
            if (c.showT <= p) { ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h) }
          }
          rafRef.current = requestAnimationFrame(frame)

        } else if (elapsed < COVER_MS + HOLD_MS) {
          // ── Hold – fully covered; switch content once ──
          for (const c of cells) { ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h) }
          if (!midpointFired) { midpointFired = true; onMidpoint() }
          rafRef.current = requestAnimationFrame(frame)

        } else {
          // ── Uncover sweep (right → left, same dithered pattern) ──
          const raw = Math.min(1, (elapsed - COVER_MS - HOLD_MS) / UNCOVER_MS)
          const p   = easeInOutCubic(raw)
          for (const c of cells) {
            if (c.hideT > p) { ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h) }
          }
          if (raw < 1) {
            rafRef.current = requestAnimationFrame(frame)
          } else {
            ctx.clearRect(0, 0, W, H)   // animation done – canvas transparent
          }
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    },
  }))

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
    />
  )
})

PixelDissolve.displayName = 'PixelDissolve'
export default PixelDissolve
