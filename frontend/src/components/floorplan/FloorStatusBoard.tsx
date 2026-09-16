import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getFloorPlan, getFloorPlans, type Reservation } from "../../lib/api"
import { STATUS_FILL, type TableStatus } from "../../lib/floorplan"
import { formatSlotTime } from "../../lib/time"
import { FloorCanvas, type CanvasElement, type CanvasTable } from "./FloorCanvas"

const PX_PER_CM = 0.42
/** Worst state wins, so a table that is both booked later and seated now reads as seated. */
const PRIORITY: Record<TableStatus, number> = { free: 0, done: 1, booked: 2, seated: 3 }
const LEGEND: { status: TableStatus; label: string }[] = [
  { status: "free", label: "Free" },
  { status: "booked", label: "Booked" },
  { status: "seated", label: "Seated" },
  { status: "done", label: "Finished" },
]

function statusFor(reservation: Reservation): TableStatus {
  if (reservation.status === "seated") return "seated"
  if (reservation.status === "booked") return "booked"
  if (reservation.status === "completed") return "done"
  return "free" // cancelled / no_show free the table up again
}

/** The saved floor plan, coloured by what is happening on the selected day. Read-only - the
 * plan itself is drawn in the Layout editor. */
export function FloorStatusBoard({ reservations }: { reservations: Reservation[] }) {
  const [planId, setPlanId] = useState<number | null>(null)

  const plans = useQuery({ queryKey: ["admin", "floor-plans"], queryFn: getFloorPlans })
  const activePlanId = planId ?? plans.data?.[0]?.id ?? null
  const plan = useQuery({
    queryKey: ["admin", "floor-plan", activePlanId],
    queryFn: () => getFloorPlan(activePlanId!),
    enabled: activePlanId != null,
  })

  const { statusByTableId, titleByTableId } = useMemo(() => {
    const status: Record<number, TableStatus> = {}
    const title: Record<number, string[]> = {}
    for (const reservation of reservations) {
      const next = statusFor(reservation)
      const ids = [reservation.assigned_table_id, ...(reservation.merged_table_ids ?? [])]
      for (const id of ids) {
        if (PRIORITY[next] > PRIORITY[status[id] ?? "free"]) status[id] = next
        if (next !== "free") {
          title[id] = [
            ...(title[id] ?? []),
            `${formatSlotTime(reservation.start_time)} · ${reservation.guest_name} (${reservation.party_size})`,
          ]
        }
      }
    }
    return {
      statusByTableId: status,
      titleByTableId: Object.fromEntries(
        Object.entries(title).map(([id, lines]) => [Number(id), lines.join("\n")]),
      ),
    }
  }, [reservations])

  const canvasTables: CanvasTable[] = useMemo(
    () =>
      (plan.data?.tables ?? []).map((t) => ({
        uid: `t${t.id}`,
        id: t.id,
        table_number: t.table_number,
        category: t.category,
        shape: t.shape,
        seats: t.seats,
        x_cm: t.x_cm,
        y_cm: t.y_cm,
        width_cm: t.width_cm,
        height_cm: t.height_cm,
        rotation: t.rotation,
      })),
    [plan.data],
  )

  const canvasElements: CanvasElement[] = useMemo(
    () => (plan.data?.elements ?? []).map((e) => ({ uid: `e${e.id}`, ...e })),
    [plan.data],
  )

  if (plans.data && plans.data.length === 0) {
    return (
      <p className="text-sm text-ink-600/70">
        No floor plan yet — draw one under <span className="text-ink-800">Layout</span>.
      </p>
    )
  }

  return (
    <div>
      {plans.data && plans.data.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {plans.data.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlanId(p.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                p.id === activePlanId
                  ? "bg-ink-950 text-parchment-50"
                  : "border border-ink-900/15 text-ink-700 hover:border-ember-400/60"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-ink-900/8">
        {plan.data ? (
          <FloorCanvas
            width_cm={plan.data.width_cm}
            height_cm={plan.data.height_cm}
            tables={canvasTables}
            elements={canvasElements}
            pxPerCm={PX_PER_CM}
            statusByTableId={statusByTableId}
            titleByTableId={titleByTableId}
          />
        ) : (
          <p className="p-6 text-sm text-ink-600">Loading plan…</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {LEGEND.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5 text-[11px] text-ink-600">
            <span
              className="h-2.5 w-2.5 rounded-full border"
              style={{ backgroundColor: STATUS_FILL[status].fill, borderColor: STATUS_FILL[status].stroke }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
