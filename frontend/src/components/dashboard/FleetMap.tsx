import { TileMap, type LatLng } from "./TileMap"
import type { BoardOrder, FleetCourier } from "../../lib/api"
import { CATEGORICAL } from "../../lib/chartColors"

/** Past this many seconds without a fix, the courier is drawn as stale rather than live. */
const STALE_AFTER_S = 45

function hasPosition(c: FleetCourier): c is FleetCourier & { lat: number; lng: number } {
  return c.lat !== null && c.lng !== null
}

export function FleetMap({
  couriers,
  orders,
  connected,
}: {
  couriers: FleetCourier[]
  orders: BoardOrder[]
  connected: boolean
}) {
  const located = couriers.filter(hasPosition)
  const drops: LatLng[] = orders.map((o) => ({ lat: o.lat, lng: o.lng }))
  const fit: LatLng[] = [...located.map((c) => ({ lat: c.lat, lng: c.lng })), ...drops]

  // Re-frame when the *set* of things on the map changes, not when a courier moves a metre.
  const fitKey = `${located.map((c) => c.id).join(",")}|${orders.map((o) => o.id).join(",")}`

  return (
    <div className="space-y-2">
      <TileMap fit={fit} fitKey={fitKey} height={440}>
        {(project) => (
          <>
            {orders.map((order) => {
              const p = project({ lat: order.lat, lng: order.lng })
              return (
                <div
                  key={order.id}
                  className="pointer-events-none absolute"
                  style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
                  title={`${order.public_code} · ${order.address_text}`}
                >
                  <span className="block h-2.5 w-2.5 rounded-full border-2 border-parchment-50 bg-ink-950/70" />
                </div>
              )
            })}

            {located.map((courier) => {
              const p = project({ lat: courier.lat, lng: courier.lng })
              const stale = (courier.age_s ?? 0) > STALE_AFTER_S
              return (
                <div
                  key={courier.id}
                  className="pointer-events-none absolute"
                  style={{
                    left: p.x,
                    top: p.y,
                    transform: "translate(-50%, -50%)",
                    // The batch arrives once a second; easing the marker across that second
                    // is what makes it read as a vehicle rather than a dot teleporting.
                    transition: "left 1s linear, top 1s linear",
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-parchment-50 shadow-sm"
                      style={{ backgroundColor: stale ? "#8f8a82" : CATEGORICAL[1] }}
                    >
                      {courier.heading !== null && (
                        <span
                          className="text-[10px] leading-none text-white"
                          style={{ transform: `rotate(${courier.heading}deg)` }}
                        >
                          ▲
                        </span>
                      )}
                    </span>
                    <span className="whitespace-nowrap rounded-full bg-parchment-50/90 px-1.5 text-[10px] text-ink-800">
                      {courier.full_name.split(" ")[0]}
                      {courier.active_load > 0 && ` · ${courier.active_load}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </TileMap>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORICAL[1] }} />
          Courier
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8f8a82]" />
          No signal for {STALE_AFTER_S}s+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-950/70" />
          Drop point
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-[#1baf7a]" : "bg-ink-900/25"}`}
          />
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      {located.length === 0 && (
        <p className="text-xs text-ink-600/70">
          No courier is reporting a position right now. Positions appear here once a courier
          goes on shift with the app open.
        </p>
      )}
    </div>
  )
}
