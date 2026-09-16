import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

/**
 * A minimal slippy map over OpenStreetMap raster tiles.
 *
 * Deliberately not a map library. MapLibre or Leaflet would each add a dependency, and the
 * vector-tile sources they are built for need an API key; raster OSM tiles are plain images
 * at a predictable URL, so the whole map is Web Mercator arithmetic and a grid of <img>.
 * What we give up is vector styling and smooth zoom - neither of which a dispatcher board
 * needs to show where six motorbikes are.
 *
 * OSM's tile policy expects light, non-commercial use. Point TILE_URL at your own cache or a
 * paid tile host before this serves real traffic.
 */

const TILE_SIZE = 256
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`

export interface LatLng {
  lat: number
  lng: number
}

/** Pixel position within the map viewport. */
export interface Point {
  x: number
  y: number
}

const MIN_ZOOM = 3
const MAX_ZOOM = 18

function lngToWorldX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * TILE_SIZE * 2 ** zoom
}

function latToWorldY(lat: number, zoom: number): number {
  const rad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad))
  return (1 - merc / Math.PI) / 2 * TILE_SIZE * 2 ** zoom
}

/** Centre and zoom that fit every point, with a little breathing room. */
function fitView(points: LatLng[], width: number, height: number): { center: LatLng; zoom: number } {
  if (points.length === 0) {
    // Baku city centre, so an empty map still shows the right city.
    return { center: { lat: 40.3777, lng: 49.892 }, zoom: 12 }
  }
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  if (points.length === 1) return { center, zoom: 14 }

  // Walk zoom levels down until the whole spread fits the viewport.
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const spanX = Math.abs(lngToWorldX(Math.max(...lngs), zoom) - lngToWorldX(Math.min(...lngs), zoom))
    const spanY = Math.abs(latToWorldY(Math.min(...lats), zoom) - latToWorldY(Math.max(...lats), zoom))
    if (spanX < width * 0.8 && spanY < height * 0.8) return { center, zoom }
  }
  return { center, zoom: MIN_ZOOM }
}

interface TileMapProps {
  /** Points the map should frame on first render and whenever `fitKey` changes. */
  fit: LatLng[]
  /** Change this to re-frame; keeps the map still while only positions move. */
  fitKey?: string
  height?: number
  className?: string
  /** Receives a projection from coordinates to viewport pixels. */
  children: (project: (p: LatLng) => Point) => ReactNode
}

export function TileMap({ fit, fitKey = "", height = 420, className = "", children }: TileMapProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height })
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Re-frame only when the caller says the *subject* changed, not on every position tick -
  // a map that re-centres itself three times a second is unusable.
  useEffect(() => {
    if (size.width === 0) return
    setView(fitView(fit, size.width, size.height))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.width, size.height])

  const project = useCallback(
    (p: LatLng): Point => {
      if (!view) return { x: -9999, y: -9999 }
      const originX = lngToWorldX(view.center.lng, view.zoom) - size.width / 2
      const originY = latToWorldY(view.center.lat, view.zoom) - size.height / 2
      return {
        x: lngToWorldX(p.lng, view.zoom) - originX,
        y: latToWorldY(p.lat, view.zoom) - originY,
      }
    },
    [view, size.width, size.height],
  )

  function pan(dx: number, dy: number) {
    setView((current) => {
      if (!current) return current
      const scale = TILE_SIZE * 2 ** current.zoom
      const x = lngToWorldX(current.center.lng, current.zoom) - dx
      const y = latToWorldY(current.center.lat, current.zoom) - dy
      const lng = (x / scale) * 360 - 180
      const n = Math.PI - 2 * Math.PI * (y / scale)
      const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
      return { center: { lat, lng }, zoom: current.zoom }
    })
  }

  const tiles: ReactNode[] = []
  if (view && size.width > 0) {
    const originX = lngToWorldX(view.center.lng, view.zoom) - size.width / 2
    const originY = latToWorldY(view.center.lat, view.zoom) - size.height / 2
    const firstX = Math.floor(originX / TILE_SIZE)
    const firstY = Math.floor(originY / TILE_SIZE)
    const countX = Math.ceil(size.width / TILE_SIZE) + 1
    const countY = Math.ceil(size.height / TILE_SIZE) + 1
    const max = 2 ** view.zoom

    for (let ix = 0; ix < countX; ix += 1) {
      for (let iy = 0; iy < countY; iy += 1) {
        const tx = firstX + ix
        const ty = firstY + iy
        if (ty < 0 || ty >= max) continue
        // Wrap horizontally so panning past the date line does not leave blank columns.
        const wrappedX = ((tx % max) + max) % max
        tiles.push(
          <img
            key={`${tx}:${ty}`}
            src={TILE_URL(view.zoom, wrappedX, ty)}
            alt=""
            aria-hidden
            draggable={false}
            loading="lazy"
            className="pointer-events-none absolute select-none"
            style={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              left: tx * TILE_SIZE - originX,
              top: ty * TILE_SIZE - originY,
            }}
          />,
        )
      }
    }
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-2xl border border-ink-900/10 bg-parchment-100 ${className}`}
      style={{ height }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        pan(e.clientX - drag.current.x, e.clientY - drag.current.y)
        drag.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    >
      {tiles}
      {view && <div className="absolute inset-0">{children(project)}</div>}

      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border border-ink-900/10 bg-parchment-50/90 backdrop-blur">
        {([1, -1] as const).map((step) => (
          <button
            key={step}
            type="button"
            aria-label={step > 0 ? "Zoom in" : "Zoom out"}
            className="h-7 w-7 text-sm text-ink-800 transition-colors hover:bg-ink-900/[0.06]"
            onClick={() =>
              setView((v) =>
                v
                  ? { ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + step)) }
                  : v,
              )
            }
          >
            {step > 0 ? "+" : "−"}
          </button>
        ))}
      </div>

      {/* OSM's licence requires visible attribution wherever their tiles are shown. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-0 right-0 bg-parchment-50/80 px-1.5 py-0.5 text-[10px] text-ink-600 hover:text-ink-950"
      >
        © OpenStreetMap
      </a>
    </div>
  )
}
