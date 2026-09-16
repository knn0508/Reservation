import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { TableCategory } from "../../lib/api"
import {
  GRID_CM,
  snapCm,
  type FloorElementKind,
  type TableShape,
  type TableStatus,
} from "../../lib/floorplan"
import { ElementGlyph, TableGlyph } from "./shapes"

/** Editor-side items. `uid` is a client key so a table added on the canvas (id === null) can
 * still be selected and dragged before it has a database id. x/y are the item's CENTRE. */
export interface CanvasTable {
  uid: string
  id: number | null
  table_number: string
  category: TableCategory
  shape: TableShape
  seats: number
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  rotation: number
}

export interface CanvasElement {
  uid: string
  kind: FloorElementKind
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  rotation: number
  label: string | null
  color: string | null
  z_index: number
}

export interface GeometryPatch {
  x_cm?: number
  y_cm?: number
  width_cm?: number
  height_cm?: number
  rotation?: number
}

const MIN_SIZE_CM = 20
const ROTATE_SNAP_DEG = 15
/** Breathing room outside the room's own outline, so a label or rotate handle on an item
 * sitting against a wall is still drawn instead of clipped by the viewBox. */
const MARGIN_CM = 70
/** Handles and labels are sized in cm so they render at a constant pixel size at any zoom. */
const HANDLE_PX = 9
const ROTATE_ARM_PX = 26

type Gesture =
  | { kind: "move"; uid: string; clientX: number; clientY: number; x: number; y: number }
  | {
      kind: "resize"
      uid: string
      sx: 1 | -1
      sy: 1 | -1
      clientX: number
      clientY: number
      x: number
      y: number
      w: number
      h: number
      rotation: number
    }
  | { kind: "rotate"; uid: string; cx: number; cy: number; pointerStart: number; rotation: number }

export interface FloorCanvasProps {
  width_cm: number
  height_cm: number
  tables: CanvasTable[]
  elements: CanvasElement[]
  pxPerCm: number
  /** Edit mode: drag, resize, rotate, select. View mode is read-only. */
  interactive?: boolean
  selectedUid?: string | null
  onSelect?: (uid: string | null) => void
  onGeometryChange?: (uid: string, patch: GeometryPatch) => void
  /** Called once when a drag/resize/rotate finishes, so the page can snapshot for undo. */
  onGestureEnd?: () => void
  onDropElement?: (kind: FloorElementKind, x_cm: number, y_cm: number) => void
  statusByTableId?: Record<number, TableStatus>
  titleByTableId?: Record<number, string>
  onTableClick?: (table: CanvasTable) => void
}

export function FloorCanvas({
  width_cm,
  height_cm,
  tables,
  elements,
  pxPerCm,
  interactive = false,
  selectedUid = null,
  onSelect,
  onGeometryChange,
  onGestureEnd,
  onDropElement,
  statusByTableId,
  titleByTableId,
  onTableClick,
}: FloorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const cm = (px: number) => px / pxPerCm
  const handleCm = cm(HANDLE_PX)
  const labelCm = cm(13)

  useEffect(() => {
    if (!interactive) return

    // The viewBox starts at -MARGIN_CM, so screen-to-plan has to shift by the same margin.
    function toCm(clientX: number, clientY: number) {
      const rect = svgRef.current!.getBoundingClientRect()
      return {
        x: (clientX - rect.left) / pxPerCm - MARGIN_CM,
        y: (clientY - rect.top) / pxPerCm - MARGIN_CM,
      }
    }

    function onMove(event: globalThis.PointerEvent) {
      const g = gesture.current
      if (!g || !onGeometryChange) return
      // Alt bypasses the grid for the odd item that has to sit between two grid lines.
      const snap = !event.altKey

      if (g.kind === "move") {
        onGeometryChange(g.uid, {
          x_cm: snapCm(g.x + (event.clientX - g.clientX) / pxPerCm, snap),
          y_cm: snapCm(g.y + (event.clientY - g.clientY) / pxPerCm, snap),
        })
        return
      }

      if (g.kind === "rotate") {
        const point = toCm(event.clientX, event.clientY)
        const angle = (Math.atan2(point.y - g.cy, point.x - g.cx) * 180) / Math.PI
        let next = g.rotation + (angle - g.pointerStart)
        if (snap) next = Math.round(next / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG
        onGeometryChange(g.uid, { rotation: ((Math.round(next) % 360) + 360) % 360 })
        return
      }

      // Resize anchored on the opposite corner: work out the drag in the item's own
      // (unrotated) axes, then shift the centre by half of the size change, rotated back.
      const rad = (-g.rotation * Math.PI) / 180
      const dx = (event.clientX - g.clientX) / pxPerCm
      const dy = (event.clientY - g.clientY) / pxPerCm
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad)

      const nextW = Math.max(MIN_SIZE_CM, snapCm(g.w + g.sx * lx, snap))
      const nextH = Math.max(MIN_SIZE_CM, snapCm(g.h + g.sy * ly, snap))
      const shiftX = (g.sx * (nextW - g.w)) / 2
      const shiftY = (g.sy * (nextH - g.h)) / 2
      const back = (g.rotation * Math.PI) / 180

      onGeometryChange(g.uid, {
        width_cm: nextW,
        height_cm: nextH,
        x_cm: Math.round(g.x + shiftX * Math.cos(back) - shiftY * Math.sin(back)),
        y_cm: Math.round(g.y + shiftX * Math.sin(back) + shiftY * Math.cos(back)),
      })
    }

    function onUp() {
      if (!gesture.current) return
      gesture.current = null
      onGestureEnd?.()
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [interactive, pxPerCm, onGeometryChange, onGestureEnd])

  function startMove(event: ReactPointerEvent, item: { uid: string; x_cm: number; y_cm: number }) {
    if (!interactive) return
    event.stopPropagation()
    onSelect?.(item.uid)
    gesture.current = {
      kind: "move",
      uid: item.uid,
      clientX: event.clientX,
      clientY: event.clientY,
      x: item.x_cm,
      y: item.y_cm,
    }
  }

  function startResize(
    event: ReactPointerEvent,
    item: CanvasTable | CanvasElement,
    sx: 1 | -1,
    sy: 1 | -1,
  ) {
    event.stopPropagation()
    gesture.current = {
      kind: "resize",
      uid: item.uid,
      sx,
      sy,
      clientX: event.clientX,
      clientY: event.clientY,
      x: item.x_cm,
      y: item.y_cm,
      w: item.width_cm,
      h: item.height_cm,
      rotation: item.rotation,
    }
  }

  function startRotate(event: ReactPointerEvent, item: CanvasTable | CanvasElement) {
    event.stopPropagation()
    const rect = svgRef.current!.getBoundingClientRect()
    const px = (event.clientX - rect.left) / pxPerCm - MARGIN_CM
    const py = (event.clientY - rect.top) / pxPerCm - MARGIN_CM
    gesture.current = {
      kind: "rotate",
      uid: item.uid,
      cx: item.x_cm,
      cy: item.y_cm,
      pointerStart: (Math.atan2(py - item.y_cm, px - item.x_cm) * 180) / Math.PI,
      rotation: item.rotation,
    }
  }

  function Selection({ item }: { item: CanvasTable | CanvasElement }) {
    const halfW = item.width_cm / 2
    const halfH = item.height_cm / 2
    const corners: [1 | -1, 1 | -1][] = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]
    return (
      <g>
        <rect
          x={-halfW}
          y={-halfH}
          width={item.width_cm}
          height={item.height_cm}
          fill="none"
          stroke="#c05f34"
          strokeWidth={cm(1.5)}
          strokeDasharray={`${cm(5)} ${cm(4)}`}
          pointerEvents="none"
        />
        <line
          x1={0}
          y1={-halfH}
          x2={0}
          y2={-halfH - cm(ROTATE_ARM_PX)}
          stroke="#c05f34"
          strokeWidth={cm(1.5)}
          pointerEvents="none"
        />
        <circle
          cx={0}
          cy={-halfH - cm(ROTATE_ARM_PX)}
          r={handleCm * 0.7}
          fill="#c05f34"
          stroke="#fbf8f3"
          strokeWidth={cm(1.5)}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startRotate(e, item)}
        />
        {corners.map(([sx, sy]) => (
          <rect
            key={`${sx}:${sy}`}
            x={sx * halfW - handleCm / 2}
            y={sy * halfH - handleCm / 2}
            width={handleCm}
            height={handleCm}
            fill="#fbf8f3"
            stroke="#c05f34"
            strokeWidth={cm(1.5)}
            style={{ cursor: sx === sy ? "nwse-resize" : "nesw-resize" }}
            onPointerDown={(e) => startResize(e, item, sx, sy)}
          />
        ))}
      </g>
    )
  }

  const sortedElements = [...elements].sort((a, b) => a.z_index - b.z_index)
  const selected =
    tables.find((t) => t.uid === selectedUid) ?? elements.find((e) => e.uid === selectedUid) ?? null

  return (
    <svg
      ref={svgRef}
      width={(width_cm + MARGIN_CM * 2) * pxPerCm}
      height={(height_cm + MARGIN_CM * 2) * pxPerCm}
      viewBox={`${-MARGIN_CM} ${-MARGIN_CM} ${width_cm + MARGIN_CM * 2} ${height_cm + MARGIN_CM * 2}`}
      className="block touch-none select-none rounded-2xl"
      style={{ backgroundColor: "#fbf8f3" }}
      onPointerDown={() => interactive && onSelect?.(null)}
      onDragOver={(e) => {
        if (onDropElement) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!onDropElement) return
        e.preventDefault()
        const kind = e.dataTransfer.getData("application/x-floor-element") as FloorElementKind
        if (!kind) return
        const rect = e.currentTarget.getBoundingClientRect()
        onDropElement(
          kind,
          snapCm((e.clientX - rect.left) / pxPerCm - MARGIN_CM),
          snapCm((e.clientY - rect.top) / pxPerCm - MARGIN_CM),
        )
      }}
    >
      <defs>
        <pattern id="floor-grid" width={GRID_CM * 5} height={GRID_CM * 5} patternUnits="userSpaceOnUse">
          <path
            d={`M ${GRID_CM * 5} 0 L 0 0 0 ${GRID_CM * 5}`}
            fill="none"
            stroke="#e9dcc9"
            strokeWidth={cm(1)}
          />
        </pattern>
      </defs>
      <rect
        x={-MARGIN_CM}
        y={-MARGIN_CM}
        width={width_cm + MARGIN_CM * 2}
        height={height_cm + MARGIN_CM * 2}
        fill="url(#floor-grid)"
        opacity={0.5}
      />
      <rect width={width_cm} height={height_cm} fill="#fbf8f3" />
      <rect width={width_cm} height={height_cm} fill="url(#floor-grid)" />
      <rect
        width={width_cm}
        height={height_cm}
        fill="none"
        stroke="#a38b6a"
        strokeWidth={cm(2)}
        rx={cm(4)}
      />

      {sortedElements.map((element) => (
        <g
          key={element.uid}
          transform={`translate(${element.x_cm} ${element.y_cm}) rotate(${element.rotation})`}
          style={{ cursor: interactive ? "move" : "default" }}
          onPointerDown={(e) => startMove(e, element)}
        >
          <ElementGlyph
            kind={element.kind}
            width={element.width_cm}
            height={element.height_cm}
            label={element.label}
            color={element.color}
            labelPx={labelCm}
          />
        </g>
      ))}

      {tables.map((table) => {
        const status = (table.id != null && statusByTableId?.[table.id]) || "free"
        const title = table.id != null ? titleByTableId?.[table.id] : undefined
        return (
          <g
            key={table.uid}
            transform={`translate(${table.x_cm} ${table.y_cm}) rotate(${table.rotation})`}
            style={{ cursor: interactive ? "move" : onTableClick ? "pointer" : "default" }}
            onPointerDown={(e) => startMove(e, table)}
            onClick={() => !interactive && onTableClick?.(table)}
          >
            {title && <title>{title}</title>}
            <TableGlyph
              shape={table.shape}
              seats={table.seats}
              width={table.width_cm}
              height={table.height_cm}
              label={table.table_number}
              status={status}
              labelPx={labelCm * 1.15}
            />
          </g>
        )
      })}

      {/* Handles live in their own top layer so nothing drawn later can cover them. */}
      {interactive && selected && (
        <g transform={`translate(${selected.x_cm} ${selected.y_cm}) rotate(${selected.rotation})`}>
          <Selection item={selected} />
        </g>
      )}
    </svg>
  )
}
