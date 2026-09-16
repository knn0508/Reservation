import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowCounterClockwise, ArrowClockwise, FloppyDisk, Minus, Plus } from "@phosphor-icons/react"
import {
  ApiError,
  createFloorPlan,
  deleteFloorPlan,
  getFloorPlan,
  getFloorPlans,
  saveFloorPlanLayout,
  updateFloorPlan,
  type FloorPlanDetail,
} from "../lib/api"
import {
  ELEMENT_PRESETS,
  categoryForSeats,
  defaultTableSize,
  type FloorElementKind,
  type TableShape,
} from "../lib/floorplan"
import {
  FloorCanvas,
  type CanvasElement,
  type CanvasTable,
  type GeometryPatch,
} from "../components/floorplan/FloorCanvas"
import { Palette } from "../components/floorplan/Palette"
import { Inspector } from "../components/floorplan/Inspector"

const BASE_PX_PER_CM = 0.5
const ZOOM_STEPS = [0.4, 0.55, 0.7, 0.85, 1, 1.25, 1.5, 2]
const NUDGE_CM = 10
const HISTORY_LIMIT = 60

interface Layout {
  tables: CanvasTable[]
  elements: CanvasElement[]
}

let uidCounter = 0
const nextUid = () => `i${++uidCounter}`

function toLayout(plan: FloorPlanDetail): Layout {
  return {
    tables: plan.tables.map((t) => ({
      uid: nextUid(),
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
    elements: plan.elements.map((e) => ({
      uid: nextUid(),
      kind: e.kind,
      x_cm: e.x_cm,
      y_cm: e.y_cm,
      width_cm: e.width_cm,
      height_cm: e.height_cm,
      rotation: e.rotation,
      label: e.label,
      color: e.color,
      z_index: e.z_index,
    })),
  }
}

/** Next unused "T<n>" so a freshly dropped table already has a valid, unique number. */
function nextTableNumber(tables: CanvasTable[]): string {
  const taken = new Set(tables.map((t) => t.table_number))
  for (let n = 1; n < 1000; n++) {
    const candidate = `T${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `T${Date.now() % 10000}`
}

export function AdminFloorPlanPage() {
  const queryClient = useQueryClient()
  const [planId, setPlanId] = useState<number | null>(null)
  const [layout, setLayoutState] = useState<Layout>({ tables: [], elements: [] })
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [zoomIndex, setZoomIndex] = useState(4)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const layoutRef = useRef<Layout>(layout)
  const history = useRef<Layout[]>([])
  const historyIndex = useRef(-1)
  const [historyTick, setHistoryTick] = useState(0)

  const plans = useQuery({ queryKey: ["admin", "floor-plans"], queryFn: getFloorPlans })
  const activePlanId = planId ?? plans.data?.[0]?.id ?? null
  const plan = useQuery({
    queryKey: ["admin", "floor-plan", activePlanId],
    queryFn: () => getFloorPlan(activePlanId!),
    enabled: activePlanId != null,
  })

  const setLayout = useCallback((next: Layout) => {
    layoutRef.current = next
    setLayoutState(next)
    setDirty(true)
  }, [])

  const pushHistory = useCallback(() => {
    const trimmed = history.current.slice(0, historyIndex.current + 1)
    trimmed.push(layoutRef.current)
    // Keep the stack bounded - a floor plan is small, but an afternoon of dragging is not.
    history.current = trimmed.slice(-HISTORY_LIMIT)
    historyIndex.current = history.current.length - 1
    setHistoryTick((t) => t + 1)
  }, [])

  /** Edits that are a single user action: change state and record it in one go. */
  const commit = useCallback(
    (next: Layout) => {
      setLayout(next)
      pushHistory()
    },
    [setLayout, pushHistory],
  )

  // Reset the editor whenever a different plan (or a freshly saved one) arrives.
  useEffect(() => {
    if (!plan.data) return
    const fresh = toLayout(plan.data)
    layoutRef.current = fresh
    setLayoutState(fresh)
    history.current = [fresh]
    historyIndex.current = 0
    setHistoryTick((t) => t + 1)
    setSelectedUid(null)
    setDirty(false)
  }, [plan.data])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const canUndo = historyIndex.current > 0
  const canRedo = historyIndex.current < history.current.length - 1

  const undo = useCallback(() => {
    if (historyIndex.current <= 0) return
    historyIndex.current -= 1
    const snapshot = history.current[historyIndex.current]
    layoutRef.current = snapshot
    setLayoutState(snapshot)
    setDirty(true)
    setHistoryTick((t) => t + 1)
  }, [])

  const redo = useCallback(() => {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current += 1
    const snapshot = history.current[historyIndex.current]
    layoutRef.current = snapshot
    setLayoutState(snapshot)
    setDirty(true)
    setHistoryTick((t) => t + 1)
  }, [])

  const selectedTable = layout.tables.find((t) => t.uid === selectedUid) ?? null
  const selectedElement = layout.elements.find((e) => e.uid === selectedUid) ?? null

  const patchTable = useCallback(
    (uid: string, patch: Partial<CanvasTable>, record: boolean) => {
      const next = {
        ...layoutRef.current,
        tables: layoutRef.current.tables.map((t) => (t.uid === uid ? { ...t, ...patch } : t)),
      }
      if (record) commit(next)
      else setLayout(next)
    },
    [commit, setLayout],
  )

  const patchElement = useCallback(
    (uid: string, patch: Partial<CanvasElement>, record: boolean) => {
      const next = {
        ...layoutRef.current,
        elements: layoutRef.current.elements.map((e) => (e.uid === uid ? { ...e, ...patch } : e)),
      }
      if (record) commit(next)
      else setLayout(next)
    },
    [commit, setLayout],
  )

  // Dragging fires continuously; the snapshot lands once, on pointer-up.
  const onGeometryChange = useCallback(
    (uid: string, patch: GeometryPatch) => {
      if (layoutRef.current.tables.some((t) => t.uid === uid)) patchTable(uid, patch, false)
      else patchElement(uid, patch, false)
    },
    [patchTable, patchElement],
  )

  const removeSelected = useCallback(() => {
    if (!selectedUid) return
    commit({
      tables: layoutRef.current.tables.filter((t) => t.uid !== selectedUid),
      elements: layoutRef.current.elements.filter((e) => e.uid !== selectedUid),
    })
    setSelectedUid(null)
  }, [selectedUid, commit])

  const addTable = useCallback(
    (shape: TableShape, seats: number, x?: number, y?: number) => {
      const uid = nextUid()
      const table: CanvasTable = {
        uid,
        id: null,
        table_number: nextTableNumber(layoutRef.current.tables),
        category: categoryForSeats(seats),
        shape,
        seats,
        x_cm: x ?? 200,
        y_cm: y ?? 200,
        rotation: 0,
        ...defaultTableSize(shape, seats),
      }
      commit({ ...layoutRef.current, tables: [...layoutRef.current.tables, table] })
      setSelectedUid(uid)
    },
    [commit],
  )

  const addElement = useCallback(
    (kind: FloorElementKind, x?: number, y?: number) => {
      const preset = ELEMENT_PRESETS[kind]
      const uid = nextUid()
      const element: CanvasElement = {
        uid,
        kind,
        x_cm: x ?? 300,
        y_cm: y ?? 150,
        width_cm: preset.width_cm,
        height_cm: preset.height_cm,
        rotation: 0,
        label: null,
        color: null,
        z_index: preset.group === "structure" ? -1 : 0,
      }
      commit({ ...layoutRef.current, elements: [...layoutRef.current.elements, element] })
      setSelectedUid(uid)
    },
    [commit],
  )

  // Keyboard shortcuts, skipped while a form field has focus so typing a table number works.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.key === "Escape") return setSelectedUid(null)
      if (!selectedUid) return
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        return removeSelected()
      }
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-NUDGE_CM, 0],
        ArrowRight: [NUDGE_CM, 0],
        ArrowUp: [0, -NUDGE_CM],
        ArrowDown: [0, NUDGE_CM],
      }
      const delta = nudge[event.key]
      if (!delta) return
      event.preventDefault()
      const item =
        layoutRef.current.tables.find((t) => t.uid === selectedUid) ??
        layoutRef.current.elements.find((e) => e.uid === selectedUid)
      if (!item) return
      const patch = { x_cm: item.x_cm + delta[0], y_cm: item.y_cm + delta[1] }
      if ("id" in item) patchTable(selectedUid, patch, true)
      else patchElement(selectedUid, patch, true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedUid, undo, redo, removeSelected, patchTable, patchElement])

  const save = useMutation({
    mutationFn: () =>
      saveFloorPlanLayout(activePlanId!, {
        tables: layoutRef.current.tables.map(({ uid: _uid, ...t }) => t),
        elements: layoutRef.current.elements.map(({ uid: _uid, ...e }) => e),
      }),
    onSuccess: (saved) => {
      setError(null)
      queryClient.setQueryData(["admin", "floor-plan", saved.id], saved)
      queryClient.invalidateQueries({ queryKey: ["admin", "tables"] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the plan"),
  })

  const addPlan = useMutation({
    mutationFn: () => createFloorPlan({ name: `Plan ${(plans.data?.length ?? 0) + 1}` }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "floor-plans"] })
      setPlanId(created.id)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the plan"),
  })

  const editPlan = useMutation({
    mutationFn: (input: { name?: string; width_cm?: number; height_cm?: number }) =>
      updateFloorPlan(activePlanId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "floor-plans"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "floor-plan", activePlanId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update the plan"),
  })

  const removePlan = useMutation({
    mutationFn: () => deleteFloorPlan(activePlanId!),
    onSuccess: () => {
      setPlanId(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "floor-plans"] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not delete the plan"),
  })

  const pxPerCm = BASE_PX_PER_CM * ZOOM_STEPS[zoomIndex]
  const seatTotal = useMemo(() => layout.tables.reduce((sum, t) => sum + t.seats, 0), [layout.tables])

  if (plans.isLoading) {
    return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-ink-600">Loading floor plans…</div>
  }

  return (
    <div className="mx-auto max-w-[100rem] px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-950">Floor plan</h1>
          <p className="mt-1 text-sm text-ink-600">
            Lay out the room as it really is — tables and chairs, sofas, the bar, windows and the
            entrance. {layout.tables.length} tables · {seatTotal} seats on this plan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            key={`undo-${historyTick}`}
            title="Undo (Ctrl+Z)"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-900/15 text-ink-700 transition-colors hover:border-ember-400/60 disabled:opacity-30"
          >
            <ArrowCounterClockwise size={15} weight="bold" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-900/15 text-ink-700 transition-colors hover:border-ember-400/60 disabled:opacity-30"
          >
            <ArrowClockwise size={15} weight="bold" />
          </button>
          <div className="flex items-center gap-1 rounded-full border border-ink-900/15 px-1">
            <button
              type="button"
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-700 hover:text-ink-950"
              aria-label="Zoom out"
            >
              <Minus size={13} weight="bold" />
            </button>
            <span className="w-10 text-center text-xs tabular-nums text-ink-600">
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-700 hover:text-ink-950"
              aria-label="Zoom in"
            >
              <Plus size={13} weight="bold" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || activePlanId == null}
            className="flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-xs font-medium uppercase tracking-wide text-parchment-50 transition-opacity disabled:opacity-30"
          >
            <FloppyDisk size={14} weight="bold" />
            {save.isPending ? "Saving…" : dirty ? "Save plan" : "Saved"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {plans.data?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              if (dirty && !window.confirm("Switch plans and lose unsaved changes?")) return
              setPlanId(p.id)
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              p.id === activePlanId
                ? "bg-ink-950 text-parchment-50"
                : "border border-ink-900/15 text-ink-700 hover:border-ember-400/60"
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addPlan.mutate()}
          className="rounded-full border border-dashed border-ink-900/25 px-3.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-ember-400/60 hover:text-ink-900"
        >
          + New zone
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rust-500/30 bg-rust-500/5 px-4 py-2.5 text-sm text-rust-500">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_16rem]">
        <aside className="rounded-[1.5rem] border border-ink-900/10 bg-parchment-100/60 p-4">
          <Palette onAddTable={(shape, seats) => addTable(shape, seats)} onAddElement={(kind) => addElement(kind)} />
        </aside>

        <div className="overflow-auto rounded-[1.5rem] border border-ink-900/10 bg-parchment-100/40 p-4">
          {plan.data ? (
            <FloorCanvas
              width_cm={plan.data.width_cm}
              height_cm={plan.data.height_cm}
              tables={layout.tables}
              elements={layout.elements}
              pxPerCm={pxPerCm}
              interactive
              selectedUid={selectedUid}
              onSelect={setSelectedUid}
              onGeometryChange={onGeometryChange}
              onGestureEnd={pushHistory}
              onDropElement={(kind, x, y) => addElement(kind, x, y)}
            />
          ) : (
            <p className="p-6 text-sm text-ink-600">
              {plans.data?.length ? "Loading plan…" : "Create a zone to start drawing."}
            </p>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[1.5rem] border border-ink-900/10 bg-parchment-100/60 p-4">
            <h2 className="font-display text-base text-ink-950">Selection</h2>
            <div className="mt-3">
              <Inspector
                table={selectedTable}
                element={selectedElement}
                onTableChange={(patch) => selectedUid && patchTable(selectedUid, patch, true)}
                onElementChange={(patch) => selectedUid && patchElement(selectedUid, patch, true)}
                onDelete={removeSelected}
              />
            </div>
          </div>

          {plan.data && (
            <div className="rounded-[1.5rem] border border-ink-900/10 bg-parchment-100/60 p-4">
              <h2 className="font-display text-base text-ink-950">Zone</h2>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-ember-400"
                  defaultValue={plan.data.name}
                  key={plan.data.id}
                  maxLength={60}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== plan.data!.name) editPlan.mutate({ name })
                  }}
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["width_cm", "height_cm"] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-ink-600">
                      {field === "width_cm" ? "Width (cm)" : "Depth (cm)"}
                    </span>
                    <input
                      type="number"
                      step={50}
                      min={100}
                      key={`${plan.data!.id}-${field}`}
                      defaultValue={plan.data![field]}
                      className="mt-1 w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-ember-400"
                      onBlur={(e) => {
                        const value = Number(e.target.value)
                        if (Number.isFinite(value) && value >= 100 && value !== plan.data![field]) {
                          editPlan.mutate({ [field]: Math.round(value) })
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete the "${plan.data!.name}" zone?`)) removePlan.mutate()
                }}
                className="mt-4 w-full rounded-full border border-rust-500/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-rust-500 transition-colors hover:bg-rust-500/10"
              >
                Delete zone
              </button>
              <p className="mt-3 text-[11px] leading-snug text-ink-600/70">
                Drag to move, corner handles to resize, the top handle to rotate. Hold Alt to ignore
                the grid; arrow keys nudge by 10 cm.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
