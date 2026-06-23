import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { motion, useAnimationControls } from "framer-motion"
import ThermodynamicGrid from "@/components/ui/interactive-thermodynamic-grid"

// --- UTILS ---
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ")

const uuidv4 = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// --- HOOKS ---
const SCREEN_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const
type ScreenSize = (typeof SCREEN_SIZES)[number]

const sizeOrder: Record<ScreenSize, number> = { xs: 0, sm: 1, md: 2, lg: 3, xl: 4, "2xl": 5 } as const

class ComparableScreenSize {
  private value: ScreenSize
  constructor(value: ScreenSize) {
    this.value = value
  }
  toString(): ScreenSize { return this.value }
  valueOf(): number { return sizeOrder[this.value] }
  equals(other: ScreenSize): boolean { return this.value === other }
  lessThan(other: ScreenSize): boolean { return this.valueOf() < sizeOrder[other] }
  greaterThan(other: ScreenSize): boolean { return this.valueOf() > sizeOrder[other] }
  lessThanOrEqual(other: ScreenSize): boolean { return this.valueOf() <= sizeOrder[other] }
  greaterThanOrEqual(other: ScreenSize): boolean { return this.valueOf() >= sizeOrder[other] }
}

const useScreenSize = (): ComparableScreenSize => {
  const [screenSize, setScreenSize] = useState<ScreenSize>("xs")

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width >= 1536) setScreenSize("2xl")
      else if (width >= 1280) setScreenSize("xl")
      else if (width >= 1024) setScreenSize("lg")
      else if (width >= 768) setScreenSize("md")
      else if (width >= 640) setScreenSize("sm")
      else setScreenSize("xs")
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return new ComparableScreenSize(screenSize)
}

interface Dimensions { width: number; height: number }

function useDimensions(ref: React.RefObject<HTMLElement | SVGElement | null>): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const updateDimensions = () => {
      if (ref.current) {
        const { width, height } = ref.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }
    const debouncedUpdateDimensions = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateDimensions, 250)
    }
    updateDimensions()
    window.addEventListener("resize", debouncedUpdateDimensions)
    return () => {
      window.removeEventListener("resize", debouncedUpdateDimensions)
      clearTimeout(timeoutId)
    }
  }, [ref])
  return dimensions
}

// --- COMPONENTS ---
const GooeyFilter = ({ id = "goo-filter", strength = 10 }: { id?: string; strength?: number }) => (
  <svg className="hidden absolute">
    <defs>
      <filter id={id}>
        <feGaussianBlur in="SourceGraphic" stdDeviation={strength} result="blur" />
        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>
    </defs>
  </svg>
)

interface PixelTrailProps {
  pixelSize: number
  fadeDuration?: number
  delay?: number
  className?: string
  pixelClassName?: string
}

const PixelTrail: React.FC<PixelTrailProps> = ({ pixelSize = 20, fadeDuration = 500, delay = 0, className, pixelClassName }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dimensions = useDimensions(containerRef)
  const trailId = useRef(uuidv4())

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / pixelSize)
    const y = Math.floor((e.clientY - rect.top) / pixelSize)
    const pixelElement = document.getElementById(`${trailId.current}-pixel-${x}-${y}`)
    if (pixelElement) {
      // @ts-ignore
      const animatePixel = pixelElement.__animatePixel
      if (animatePixel) animatePixel()
    }
  }, [pixelSize])

  const columns = useMemo(() => Math.ceil(dimensions.width / pixelSize), [dimensions.width, pixelSize])
  const rows = useMemo(() => Math.ceil(dimensions.height / pixelSize), [dimensions.height, pixelSize])

  return (
    <div ref={containerRef} className={cn("absolute inset-0 w-full h-full pointer-events-auto", className)} onMouseMove={handleMouseMove}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <PixelDot
              key={`${colIndex}-${rowIndex}`}
              id={`${trailId.current}-pixel-${colIndex}-${rowIndex}`}
              size={pixelSize}
              fadeDuration={fadeDuration}
              delay={delay}
              className={pixelClassName}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface PixelDotProps { id: string; size: number; fadeDuration: number; delay: number; className?: string }

const PixelDot: React.FC<PixelDotProps> = React.memo(({ id, size, fadeDuration, delay, className }) => {
  const controls = useAnimationControls()
  const animatePixel = useCallback(() => {
    controls.start({ opacity: [1, 0], transition: { duration: fadeDuration / 1000, delay: delay / 1000 } })
  }, [controls, fadeDuration, delay])

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // @ts-ignore
      node.__animatePixel = animatePixel
    }
  }, [animatePixel])

  return (
    <motion.div
      id={id}
      ref={ref}
      className={cn("pointer-events-none", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      initial={{ opacity: 0 }}
      animate={controls}
      exit={{ opacity: 0 }}
    />
  )
})
PixelDot.displayName = "PixelDot"

// --- MAIN APP ---
export default function App() {
  const screenSize = useScreenSize()
  const [phase, setPhase] = useState<"intro" | "exiting" | "workspace">("intro")
  const [apiKey, setApiKey] = useState("")
  const [apiError, setApiError] = useState("")

  const handleEnter = () => {
    if (!apiKey.trim()) {
      setApiError("Please enter your Gemini API key to continue.")
      return
    }
    if (apiKey.trim().length < 20) {
      setApiError("That doesn't look like a valid API key. It should start with 'AIza'.")
      return
    }
    setApiError("")
    localStorage.setItem("himmyhelp_api_key", apiKey.trim())
    setPhase("exiting")
    setTimeout(() => setPhase("workspace"), 900)
  }

  if (phase === "workspace") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="w-screen h-screen overflow-hidden bg-[#2D1E16]"
      >
        <iframe
          src="/himmyhelp.html"
          title="HimmyHelp Workspace"
          className="w-full h-full border-none"
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "exiting" ? 0 : 1, scale: phase === "exiting" ? 1.04 : 1 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="relative w-full h-screen min-h-[600px] flex flex-col items-center justify-center gap-8 bg-[#050505] text-center overflow-hidden"
    >
      <ThermodynamicGrid
        resolution={screenSize.lessThan("md") ? 18 : 12}
        coolingFactor={0.96}
      />

      <div className="z-10 flex flex-col items-center gap-8 pointer-events-none mt-16">
        <div className="flex flex-col items-center gap-4">
          <p className="text-white text-5xl md:text-7xl font-serif max-w-4xl font-bold tracking-tight px-4 drop-shadow-lg leading-tight">
            Welcome to {" "}
            <span className="italic text-zinc-300">HimmyHelp</span>
          </p>
          <p className="text-zinc-300 font-sans tracking-widest uppercase text-sm mt-4 font-semibold">
            Study Smart • Get things done efficiently
          </p>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-3 w-full max-w-sm px-4">
          <p className="text-zinc-300 text-sm font-medium">
            Please enter the API key you want to use
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setApiError("") }}
            onKeyDown={e => e.key === "Enter" && handleEnter()}
            placeholder="AIza..."
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
          />
          {apiError && (
            <p className="text-red-400 text-xs text-center">{apiError}</p>
          )}
          <button
            onClick={handleEnter}
            className="w-full py-3 bg-white text-zinc-950 hover:bg-zinc-200 transition-colors rounded-xl font-bold uppercase tracking-widest text-sm shadow-xl hover:scale-105 active:scale-95"
          >
            Enter Workspace
          </button>
        </div>
      </div>
    </motion.div>
  )
}
