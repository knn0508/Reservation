import { TileMap, type LatLng } from "./TileMap"
import type { OriginCell } from "../../lib/api"
import { money } from "./Panels"

/** Grid step the backend rounds to; ~100 m of latitude. */
const CELL_DEG = 0.001

/**
 * Where delivered orders actually went.
 *
 * This is the view that answers which neighbourhoods to advertise in and where a second
 * branch belongs, so it is drawn from delivered orders only - a cancelled order is not
 * demand that was served.
 */
export function OriginHeatmap({ cells, isLoading }: { cells: OriginCell[]; isLoading: boolean }) {
  if (isLoading) return <p className="text-sm text-ink-600/60">Loading origins…</p>
  if (cells.length === 0) {
    return (
      <p className="text-sm text-ink-600/60">
        No delivered orders in this period yet — the heatmap fills in as deliveries complete.
      </p>
    )
  }

  const busiest = Math.max(...cells.map((c) => c.orders))
  const fit: LatLng[] = cells.map((c) => ({ lat: c.lat, lng: c.lng }))
  const totalOrders = cells.reduce((sum, c) => sum + c.orders, 0)

  return (
    <div className="space-y-2">
      <TileMap fit={fit} fitKey={`origins:${cells.length}`} height={440}>
        {(project) => (
          <>
            {cells.map((cell) => {
              const topLeft = project({ lat: cell.lat + CELL_DEG / 2, lng: cell.lng - CELL_DEG / 2 })
              const bottomRight = project({ lat: cell.lat - CELL_DEG / 2, lng: cell.lng + CELL_DEG / 2 })
              // Cells are drawn at their true ground size, so zooming tells you honestly how
              // tightly the demand clusters instead of rescaling blobs.
              const width = Math.max(6, bottomRight.x - topLeft.x)
              const height = Math.max(6, bottomRight.y - topLeft.y)
              const intensity = cell.orders / busiest
              return (
                <div
                  key={`${cell.lat}:${cell.lng}`}
                  className="absolute rounded-[3px]"
                  style={{
                    left: topLeft.x,
                    top: topLeft.y,
                    width,
                    height,
                    // Single-hue ramp: opacity carries the value, so it stays readable for
                    // colour-blind viewers and in greyscale.
                    backgroundColor: `rgba(235, 104, 52, ${0.18 + intensity * 0.62})`,
                  }}
                  title={`${cell.orders} order${cell.orders === 1 ? "" : "s"} · ${money(cell.revenue)}`}
                />
              )
            })}
          </>
        )}
      </TileMap>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-600">
        <span>Fewer</span>
        <span className="flex h-2.5 w-28 overflow-hidden rounded-full">
          {[0.18, 0.34, 0.5, 0.66, 0.8].map((a) => (
            <span key={a} className="flex-1" style={{ backgroundColor: `rgba(235, 104, 52, ${a})` }} />
          ))}
        </span>
        <span>More</span>
        <span className="ml-auto">
          {cells.length} cells · {totalOrders} delivered · busiest {busiest}
        </span>
      </div>
    </div>
  )
}
