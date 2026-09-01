import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect, Text as SvgText, TSpan } from "react-native-svg"
import { Ionicons } from "@expo/vector-icons"
import type { AvailableTable } from "../../lib/api"
import { DEFAULT_ZONE_TONE, ZONE_TONE, getFloorPlan, type FloorPlanSpec } from "../../lib/floorPlan"
import { BENCH, CHAIR, tableFurniture, type Bench, type Chair, type TableFurniture } from "../../lib/tableFurniture"
import { RoomShell, RoomShellDefs, sheetAspect, sheetViewBox } from "./RoomShell"
import { alpha, colors, fonts, radius } from "../../lib/theme"
import { EmptyNote } from "../ui/Primitives"
import { PressScale } from "../ui/Pressable"

/** A seating plan of the real dining room. The room shell comes from the per-restaurant spec in
 *  lib/floorPlan; the tables come from live availability and are placed by mapping their
 *  pos_x/pos_y percentages onto the spec's floor rectangle, so one layout renders at any size.
 *
 *  Each table is drawn as its actual furniture (lib/tableFurniture) rather than as an icon, and
 *  a table that is too small for the party dims instead of disappearing — so the room a guest
 *  sees here is the room they walk into.
 *
 *  Mobile differs from the web version in two ways. There is no hover, so a tap both focuses a
 *  table and selects it when it is bookable; tapping one that cannot be booked says why in a
 *  toast instead of doing nothing. And the whole room is fitted to the screen width rather than
 *  scrolled sideways, which makes pinch-to-zoom the primary way to read a busy room. */

const FONT = fonts.sans
const FONT_BOLD = fonts.sansBold
const FONT_SEMI = fonts.sansSemi

const MAX_ZOOM = 2.6
const ZOOM_STEP = 0.45
const TOAST_MS = 2800

/** `wrongSize` tables belong to the room but not to this party size — drawn as furniture only. */
type TableState = "available" | "focused" | "selected" | "taken" | "wrongSize"

interface Tone {
  top: string
  edge: string
  edgeWidth: number
  chair: string
  label: string
  opacity: number
}

const PALETTE: Record<TableState, Tone> = {
  available: { top: "#f7f0e4", edge: "#211b17", edgeWidth: 2.2, chair: "rgba(33,27,23,0.34)", label: "#191512", opacity: 1 },
  focused: { top: "#fffdf8", edge: "#c05f34", edgeWidth: 3, chair: "rgba(192,95,52,0.6)", label: "#191512", opacity: 1 },
  selected: { top: "#c05f34", edge: "#7a3116", edgeWidth: 3, chair: "#c05f34", label: "#fbf8f3", opacity: 1 },
  taken: { top: "url(#fp-booked)", edge: "rgba(33,27,23,0.22)", edgeWidth: 2, chair: "rgba(33,27,23,0.12)", label: "rgba(95,81,72,0.55)", opacity: 1 },
  wrongSize: { top: "#f4ede2", edge: "rgba(33,27,23,0.3)", edgeWidth: 1.8, chair: "rgba(33,27,23,0.24)", label: "rgba(95,81,72,0.8)", opacity: 0.32 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Booked tables are hatched rather than greyed out, the way a plan marks a slab that is
 *  already spoken for — it stays legible as furniture while reading clearly as unavailable. */
function TableDefs() {
  return (
    <Defs>
      <Pattern id="fp-booked" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <Rect width={14} height={14} fill="#f1e8da" />
        <Line x1={0} y1={0} x2={0} y2={14} stroke="rgba(33,27,23,0.16)" strokeWidth={4.5} />
      </Pattern>
    </Defs>
  )
}

function ChairGlyph({ chair, fill }: { chair: Chair; fill: string }) {
  return (
    <G x={chair.x} y={chair.y} rotation={chair.rotation}>
      <Rect x={CHAIR.back.x} y={CHAIR.back.y} width={CHAIR.back.w} height={CHAIR.back.h} rx={3} fill={fill} />
      <Rect x={CHAIR.seat.x} y={CHAIR.seat.y} width={CHAIR.seat.w} height={CHAIR.seat.h} rx={4} fill={fill} />
    </G>
  )
}

function BenchGlyph({ bench, fill }: { bench: Bench; fill: string }) {
  const backWidth = bench.w + BENCH.backOverhang
  return (
    <G x={bench.x} y={bench.y} rotation={bench.rotation}>
      {bench.back && (
        <Rect
          x={-backWidth / 2}
          y={BENCH.backInset}
          width={backWidth}
          height={BENCH.backHeight}
          rx={3}
          fill={fill}
        />
      )}
      <Rect x={-bench.w / 2} y={BENCH.seatInset} width={bench.w} height={BENCH.seatHeight} rx={5} fill={fill} />
    </G>
  )
}

function TableGlyph({
  table,
  furniture,
  state,
  cx,
  cy,
  onPress,
}: {
  table: AvailableTable
  furniture: TableFurniture
  state: TableState
  cx: number
  cy: number
  onPress: () => void
}) {
  const c = PALETTE[state]
  const { top } = furniture
  const lifted = state !== "taken" && state !== "wrongSize"

  const status = !table.fits ? "not offered for this party size" : table.available ? "available" : "already booked"

  return (
    <G
      onPress={onPress}
      opacity={c.opacity}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Table ${table.table_number}, ${table.seats} seats, ${table.zone} zone, ${furniture.kind}, ${status}`}
    >
      <G x={cx} y={cy}>
        {state === "selected" && (
          <Circle
            r={Math.max(furniture.reach.x, furniture.reach.y) + 16}
            fill="none"
            stroke="#c05f34"
            strokeWidth={1.6}
            strokeDasharray="9 7"
            opacity={0.7}
          />
        )}

        {/* Seating first, so the tabletop always reads as sitting on top of it. */}
        {furniture.benches.map((bench, i) => (
          <BenchGlyph key={`b${i}`} bench={bench} fill={c.chair} />
        ))}
        {furniture.chairs.map((chair, i) => (
          <ChairGlyph key={`c${i}`} chair={chair} fill={c.chair} />
        ))}

        {/* A flat offset copy stands in for a drop shadow — a blur filter per table is far too
            expensive to rasterise once a full room is on screen. */}
        {lifted &&
          (top.round ? (
            <Circle cy={3.5} r={top.w / 2} fill="rgba(33,27,23,0.18)" />
          ) : (
            <Rect
              x={-top.w / 2}
              y={-top.h / 2 + 3.5}
              width={top.w}
              height={top.h}
              rx={9}
              fill="rgba(33,27,23,0.18)"
            />
          ))}

        {top.round ? (
          <Circle r={top.w / 2} fill={c.top} stroke={c.edge} strokeWidth={c.edgeWidth} />
        ) : (
          <Rect
            x={-top.w / 2}
            y={-top.h / 2}
            width={top.w}
            height={top.h}
            rx={9}
            fill={c.top}
            stroke={c.edge}
            strokeWidth={c.edgeWidth}
          />
        )}

        <SvgText
          textAnchor="middle"
          alignmentBaseline="middle"
          fill={c.label}
          fontSize={16}
          fontFamily={state === "taken" || state === "wrongSize" ? FONT_SEMI : FONT_BOLD}
        >
          {table.table_number}
        </SvgText>

        {state === "selected" && (
          <G x={top.w / 2 - 4} y={-top.h / 2 - 4}>
            <Circle r={12} fill="#191512" />
            <Path
              d="M -5 0 L -1.5 3.6 L 5.2 -3.4"
              fill="none"
              stroke="#fbf8f3"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        )}

        {/* Generous invisible hit area, so tables stay easy to tap on a phone. */}
        <Rect
          x={-furniture.reach.x - 10}
          y={-furniture.reach.y - 10}
          width={furniture.reach.x * 2 + 20}
          height={furniture.reach.y * 2 + 20}
          fill="transparent"
        />
      </G>
    </G>
  )
}

/** Floating caption for the focused table. Sized from the text length, since SVG has no
 *  intrinsic layout, and flipped below the table when it would clip the top wall. */
function TableChip({
  table,
  furniture,
  cx,
  cy,
  room,
}: {
  table: AvailableTable
  furniture: TableFurniture
  cx: number
  cy: number
  room: { w: number; h: number }
}) {
  const status = !table.fits ? "Other party size" : table.available ? "Available" : "Booked"
  const text = `${table.table_number} · ${table.seats} seats · ${table.zone}`
  const w = Math.max(190, text.length * 7.4 + status.length * 6.6 + 62)
  const h = 34
  const gap = furniture.reach.y + 22
  const below = cy - gap - h < 6
  const x = clamp(cx - w / 2, 8, room.w - w - 8)
  const y = below ? cy + gap : cy - gap - h
  const dotColor = !table.fits ? "rgba(95,81,72,0.35)" : table.available ? "#6b7d5e" : "rgba(163,67,47,0.6)"
  const tail = clamp(cx, x + 18, x + w - 18)

  return (
    <G>
      {/* Offset copy in place of the web's feDropShadow filter. */}
      <Rect x={x} y={y + 3} width={w} height={h} rx={17} fill="rgba(33,27,23,0.22)" />
      <Rect x={x} y={y} width={w} height={h} rx={17} fill="#191512" />
      <Path
        d={
          below
            ? `M ${tail - 7} ${y} L ${tail} ${y - 8} L ${tail + 7} ${y} Z`
            : `M ${tail - 7} ${y + h} L ${tail} ${y + h + 8} L ${tail + 7} ${y + h} Z`
        }
        fill="#191512"
      />
      <Circle cx={x + 17} cy={y + h / 2} r={4.5} fill={dotColor} />
      <SvgText x={x + 29} y={y + h / 2} alignmentBaseline="middle" fontSize={13} fontFamily={FONT} fill="#fbf8f3">
        <TSpan fontFamily={FONT_BOLD}>{table.table_number}</TSpan>
        <TSpan fill="rgba(251,248,243,0.62)">{`  ${table.seats} seats · ${table.zone}`}</TSpan>
        <TSpan fill="rgba(251,248,243,0.35)">{"  ·  "}</TSpan>
        <TSpan fontFamily={FONT_SEMI} fill={dotColor === "#6b7d5e" ? "#a7bb96" : "rgba(251,248,243,0.7)"}>
          {status}
        </TSpan>
      </SvgText>
    </G>
  )
}

interface Band {
  zone: string
  top: number
  bottom: number
  free: number
  total: number
}

/** Zone bands are derived from where the tables actually sit, not hard-coded, so a reseeded
 *  layout can never leave a band floating over empty floor. Adjacent bands that would overlap
 *  after padding are split at the midpoint between the two rows of tables. */
function zoneBands(tables: AvailableTable[], floor: FloorPlanSpec["floor"]): Band[] {
  const groups = new Map<string, { min: number; max: number; free: number; total: number }>()
  for (const table of tables) {
    const y = floor.y + (table.pos_y / 100) * floor.h
    const g = groups.get(table.zone)
    const free = table.fits && table.available ? 1 : 0
    const fits = table.fits ? 1 : 0
    if (g) {
      g.min = Math.min(g.min, y)
      g.max = Math.max(g.max, y)
      g.free += free
      g.total += fits
    } else {
      groups.set(table.zone, { min: y, max: y, free, total: fits })
    }
  }

  const raw = [...groups.entries()]
    .map(([zone, g]) => ({ zone, ...g }))
    .sort((a, b) => (a.min + a.max) / 2 - (b.min + b.max) / 2)

  const pad = 66
  const bands: Band[] = raw.map((g) => ({ zone: g.zone, top: g.min - pad, bottom: g.max + pad, free: g.free, total: g.total }))
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].top < bands[i - 1].bottom) {
      const mid = (raw[i - 1].max + raw[i].min) / 2
      bands[i - 1].bottom = mid - 5
      bands[i].top = mid + 5
    }
  }
  return bands
}

/** Distance between the first two active touches, for pinch scaling. */
function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  const [a, b] = touches
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
}

export function FloorPlan({
  tables,
  restaurantSlug,
  value,
  onChange,
  disabled = false,
  partySize,
  slotLabel,
  onConfirm,
  confirmPending = false,
}: {
  tables: AvailableTable[]
  restaurantSlug?: string
  value: number | null
  onChange: (tableId: number | null) => void
  disabled?: boolean
  /** Party the plan is being read for — drives the dimming and the sheet's copy. */
  partySize?: number | null
  /** The seating time, so the sheet's call to action can name it. */
  slotLabel?: string
  /** When given, a selected table can be reserved straight from the sheet. */
  onConfirm?: () => void
  confirmPending?: boolean
}) {
  const spec: FloorPlanSpec = useMemo(() => getFloorPlan(restaurantSlug), [restaurantSlug])
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const [boardWidth, setBoardWidth] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastFade = useRef(new Animated.Value(0)).current

  // Gesture bookkeeping. Kept in refs so the responder callbacks never close over stale state.
  const gesture = useRef<{ startView: typeof view; startDistance: number; pinching: boolean }>({
    startView: { s: 1, tx: 0, ty: 0 },
    startDistance: 0,
    pinching: false,
  })
  const viewRef = useRef(view)
  viewRef.current = view

  const toX = (posX: number) => spec.floor.x + (posX / 100) * spec.floor.w
  const toY = (posY: number) => spec.floor.y + (posY / 100) * spec.floor.h

  const furnitureById = useMemo(
    () => new Map(tables.map((table) => [table.id, tableFurniture(table)])),
    [tables],
  )

  const fitting = tables.filter((table) => table.fits)
  const freeCount = fitting.filter((table) => table.available).length
  const selected = tables.find((table) => table.id === value) ?? null
  const focused = tables.find((table) => table.id === focusedId) ?? null
  // The sheet stays on the selection; the chip on the plan covers everything else.
  const subject = selected ?? focused
  const bands = useMemo(() => zoneBands(tables, spec.floor), [tables, spec.floor])

  const limitFor = (s: number) => ({ x: ((s - 1) * spec.room.w) / 2, y: ((s - 1) * spec.room.h) / 2 })

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  function flash(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastFade.setValue(0)
    Animated.timing(toastFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  /** Tapping a table that cannot be booked says why, instead of doing nothing. */
  function activate(table: AvailableTable) {
    setFocusedId(table.id)
    if (disabled) return
    if (!table.fits) {
      flash(
        `Table ${table.table_number} seats ${table.seats}${
          partySize ? ` — it is not offered for a party of ${partySize}` : " — not offered for this party size"
        }.`,
      )
      return
    }
    if (!table.available) {
      flash(`Table ${table.table_number} is already booked for this seating. Pick another one.`)
      return
    }
    setToast(null)
    onChange(table.id)
  }

  // Zooming into a room is only useful if it zooms into the table being looked at.
  useEffect(() => {
    if (!selected || viewRef.current.s <= 1) return
    const l = limitFor(viewRef.current.s)
    setView((v) => ({
      s: v.s,
      tx: clamp(-v.s * (toX(selected.pos_x) - spec.room.w / 2), -l.x, l.x),
      ty: clamp(-v.s * (toY(selected.pos_y) - spec.room.h / 2), -l.y, l.y),
    }))
    // Recentring is a response to the selection changing, not to every pan.
  }, [value])

  function zoomBy(delta: number) {
    setView((v) => {
      const s = clamp(v.s + delta, 1, MAX_ZOOM)
      const l = limitFor(s)
      // Zooming with a table picked keeps that table centred rather than the room.
      if (selected && s > 1) {
        return {
          s,
          tx: clamp(-s * (toX(selected.pos_x) - spec.room.w / 2), -l.x, l.x),
          ty: clamp(-s * (toY(selected.pos_y) - spec.room.h / 2), -l.y, l.y),
        }
      }
      return { s, tx: clamp(v.tx, -l.x, l.x), ty: clamp(v.ty, -l.y, l.y) }
    })
  }

  // Pixel deltas convert to plan units with the viewBox ratio alone, because the pan offset is
  // applied outside the zoom transform — same reasoning as the web version.
  const unitsPerPixel = boardWidth > 0 ? (spec.room.w + 44) / boardWidth : 1

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim the gesture on touch-down: that would swallow every table tap.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, state) => {
          const touches = event.nativeEvent.touches
          if (touches.length >= 2) return true
          return viewRef.current.s > 1 && (Math.abs(state.dx) > 4 || Math.abs(state.dy) > 4)
        },
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches
          gesture.current = {
            startView: viewRef.current,
            startDistance: touches.length >= 2 ? touchDistance(touches) : 0,
            pinching: touches.length >= 2,
          }
        },
        onPanResponderMove: (event, state) => {
          const touches = event.nativeEvent.touches
          const g = gesture.current

          if (touches.length >= 2) {
            const distance = touchDistance(touches)
            if (!g.pinching || g.startDistance === 0) {
              // A second finger landed mid-drag — restart the pinch from here.
              gesture.current = { startView: viewRef.current, startDistance: distance, pinching: true }
              return
            }
            const s = clamp(g.startView.s * (distance / g.startDistance), 1, MAX_ZOOM)
            const l = limitFor(s)
            setView({ s, tx: clamp(g.startView.tx, -l.x, l.x), ty: clamp(g.startView.ty, -l.y, l.y) })
            return
          }

          if (g.pinching) return
          const l = limitFor(g.startView.s)
          setView({
            s: g.startView.s,
            tx: clamp(g.startView.tx + state.dx * unitsPerPixel, -l.x, l.x),
            ty: clamp(g.startView.ty + state.dy * unitsPerPixel, -l.y, l.y),
          })
        },
        onPanResponderRelease: () => {
          gesture.current.pinching = false
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // `unitsPerPixel` only changes when the board is first measured.
    [unitsPerPixel, spec.room.w, spec.room.h],
  )

  if (tables.length === 0) {
    return <EmptyNote>No tables in the dining room for this seating.</EmptyNote>
  }

  const cx = spec.room.w / 2
  const cy = spec.room.h / 2
  const zoomed = view.s > 1
  const boardHeight = boardWidth > 0 ? boardWidth / sheetAspect(spec) : 0

  return (
    <View style={[styles.card, disabled && { opacity: 0.5 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Dining room plan</Text>
          <Text style={styles.headerTitle}>
            {freeCount} of {fitting.length} tables free
          </Text>
        </View>
        {(slotLabel || partySize) && (
          <Text style={styles.headerSeating}>
            {slotLabel}
            {slotLabel && partySize ? " · " : ""}
            {partySize ? `party of ${partySize}` : ""}
          </Text>
        )}
      </View>

      {bands.length > 1 && (
        <View style={styles.zoneRow}>
          {bands.map((band) => {
            const tone = ZONE_TONE[band.zone] ?? DEFAULT_ZONE_TONE
            return (
              <View key={band.zone} style={styles.zonePill}>
                <View style={[styles.zoneSwatch, { backgroundColor: tone.fill, borderColor: tone.stroke }]} />
                <Text style={styles.zoneName}>{band.zone}</Text>
                {band.total > 0 && (
                  <Text style={[styles.zoneCount, band.free > 0 ? styles.zoneCountFree : styles.zoneCountEmpty]}>
                    {band.free}/{band.total}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      )}

      <View
        style={styles.board}
        onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {boardWidth > 0 && (
          <Svg width={boardWidth} height={boardHeight} viewBox={sheetViewBox(spec)}>
            <RoomShellDefs />
            <TableDefs />

            <G translateX={view.tx} translateY={view.ty} scale={view.s} originX={cx} originY={cy}>
              <RoomShell spec={spec} />

              {/* Seating zones, tinted behind the tables. */}
              <G>
                {bands.map((band) => {
                  const tone = ZONE_TONE[band.zone] ?? DEFAULT_ZONE_TONE
                  const bx = spec.floor.x - 10
                  const bw = spec.floor.w + 20
                  const labelX = spec.floor.x + spec.floor.w - 6
                  const labelY = (band.top + band.bottom) / 2
                  return (
                    <G key={band.zone}>
                      <Rect
                        x={bx}
                        y={band.top}
                        width={bw}
                        height={band.bottom - band.top}
                        rx={16}
                        fill={tone.fill}
                        stroke={tone.stroke}
                        strokeWidth={1.4}
                        strokeDasharray="10 8"
                      />
                      <SvgText
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        fontSize={11}
                        fontFamily={FONT_SEMI}
                        letterSpacing={3}
                        fill={tone.text}
                        rotation={-90}
                        originX={labelX}
                        originY={labelY}
                      >
                        {band.zone.toUpperCase()}
                      </SvgText>
                    </G>
                  )
                })}
              </G>

              {/* Context furniture first, so a live table is never hidden behind a ghosted one. */}
              {[...tables]
                .sort((a, b) => Number(a.fits) - Number(b.fits))
                .map((table) => {
                  const isSelected = value === table.id && table.fits && table.available
                  const state: TableState = !table.fits
                    ? "wrongSize"
                    : !table.available
                      ? "taken"
                      : isSelected
                        ? "selected"
                        : focusedId === table.id
                          ? "focused"
                          : "available"
                  return (
                    <TableGlyph
                      key={table.id}
                      table={table}
                      furniture={furnitureById.get(table.id)!}
                      state={state}
                      cx={toX(table.pos_x)}
                      cy={toY(table.pos_y)}
                      onPress={() => activate(table)}
                    />
                  )
                })}

              {focused && (
                <TableChip
                  table={focused}
                  furniture={furnitureById.get(focused.id)!}
                  cx={toX(focused.pos_x)}
                  cy={toY(focused.pos_y)}
                  room={spec.room}
                />
              )}
            </G>
          </Svg>
        )}

        <View style={styles.zoomControls}>
          <ZoomButton icon="add" label="Zoom in" onPress={() => zoomBy(ZOOM_STEP)} disabled={view.s >= MAX_ZOOM} />
          <ZoomButton icon="remove" label="Zoom out" onPress={() => zoomBy(-ZOOM_STEP)} disabled={view.s <= 1} divider />
          <ZoomButton
            icon="refresh"
            label="Reset the view"
            onPress={() => setView({ s: 1, tx: 0, ty: 0 })}
            disabled={view.s === 1 && view.tx === 0 && view.ty === 0}
            divider
          />
        </View>

        {zoomed && !toast && (
          <View style={styles.panHint} pointerEvents="none">
            <Text style={styles.panHintText}>Pinch or drag · {view.s.toFixed(1)}×</Text>
          </View>
        )}

        {toast && (
          <Animated.View style={[styles.toast, { opacity: toastFade }]} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </View>

      <Legend />

      <DetailSheet
        table={subject}
        furniture={subject ? (furnitureById.get(subject.id) ?? null) : null}
        isSelected={!!selected && subject?.id === selected.id}
        partySize={partySize}
        slotLabel={slotLabel}
        onChoose={() => subject && activate(subject)}
        onConfirm={onConfirm}
        onClear={() => {
          setFocusedId(null)
          setToast(null)
          onChange(null)
        }}
        confirmPending={confirmPending}
        freeCount={freeCount}
        disabled={disabled}
      />
    </View>
  )
}

/** What every mark on the plan means, drawn with the same shapes the plan uses. */
function Legend() {
  return (
    <View style={styles.legend}>
      <LegendItem label="Free">
        <Svg width={15} height={15}>
          <Rect x={1.5} y={1.5} width={12} height={12} rx={2.5} fill="#f7f0e4" stroke="#211b17" strokeWidth={2} />
        </Svg>
      </LegendItem>
      <LegendItem label="Booked">
        <Svg width={15} height={15}>
          <Defs>
            <Pattern id="fp-legend-booked" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Rect width={7} height={7} fill="#f1e8da" />
              <Line x1={0} y1={0} x2={0} y2={7} stroke="rgba(33,27,23,0.22)" strokeWidth={2.4} />
            </Pattern>
          </Defs>
          <Rect
            x={1.5}
            y={1.5}
            width={12}
            height={12}
            rx={2.5}
            fill="url(#fp-legend-booked)"
            stroke="rgba(33,27,23,0.3)"
            strokeWidth={1.6}
          />
        </Svg>
      </LegendItem>
      <LegendItem label="Yours">
        <Svg width={15} height={15}>
          <Rect x={1.5} y={1.5} width={12} height={12} rx={2.5} fill="#c05f34" stroke="#7a3116" strokeWidth={2} />
        </Svg>
      </LegendItem>
      <LegendItem label="Other size">
        <Svg width={15} height={15} opacity={0.32}>
          <Rect x={1.5} y={1.5} width={12} height={12} rx={2.5} fill="#f4ede2" stroke="rgba(33,27,23,0.4)" strokeWidth={1.6} />
        </Svg>
      </LegendItem>
      <LegendItem label="Window">
        <Svg width={15} height={15}>
          <Rect x={4} y={1.5} width={7} height={12} fill="rgba(107,125,94,0.28)" stroke="#211b17" strokeWidth={1.5} />
        </Svg>
      </LegendItem>
      <LegendItem label="Door">
        <Svg width={15} height={15}>
          <Path d="M2.5 13V2.5" stroke="#c05f34" strokeWidth={2.2} strokeLinecap="round" />
          <Path
            d="M2.5 2.5a10.5 10.5 0 0 1 10.5 10.5"
            fill="none"
            stroke="rgba(192,95,52,0.45)"
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />
        </Svg>
      </LegendItem>
    </View>
  )
}

function LegendItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.legendItem}>
      {children}
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

/** The sheet below the plan: what the guest is looking at, and the one action they can take.
 *  It follows the selection, falling back to whatever was last tapped. */
function DetailSheet({
  table,
  furniture,
  isSelected,
  partySize,
  slotLabel,
  onChoose,
  onConfirm,
  onClear,
  confirmPending,
  freeCount,
  disabled,
}: {
  table: AvailableTable | null
  furniture: TableFurniture | null
  isSelected: boolean
  partySize?: number | null
  slotLabel?: string
  onChoose: () => void
  onConfirm?: () => void
  onClear: () => void
  confirmPending: boolean
  freeCount: number
  disabled: boolean
}) {
  if (!table || !furniture) {
    return (
      <View style={[styles.sheet, styles.sheetEmpty]}>
        <View style={styles.sheetEmptyBadge}>
          <Text style={styles.sheetEmptyBadgeText}>?</Text>
        </View>
        <View style={styles.sheetEmptyCopy}>
          <Text style={styles.sheetEmptyTitle}>Tap a table on the plan</Text>
          <Text style={styles.sheetEmptyNote}>
            {freeCount} {freeCount === 1 ? "table fits" : "tables fit"}
            {partySize ? ` your party of ${partySize}` : " your party"} at this time.
          </Text>
        </View>
      </View>
    )
  }

  const bookable = table.fits && table.available
  const statusLabel = !table.fits ? "Other party size" : !table.available ? "Booked" : isSelected ? "Selected" : "Available"
  const statusStyle = !bookable ? styles.tagMuted : isSelected ? styles.tagSelected : styles.tagFree

  const cta = !table.fits
    ? "Sized for a different party"
    : !table.available
      ? "Already booked at this time"
      : isSelected
        ? `Reserve table ${table.table_number}${slotLabel ? ` · ${slotLabel}` : ""}`
        : `Choose table ${table.table_number}`

  const footnote = !table.fits
    ? `Seats ${table.seats} · we only offer it to parties it suits`
    : !table.available
      ? "Someone else has this seating — pick another table"
      : `Seats ${table.seats}${partySize ? ` · your party of ${partySize} fits` : ""} · free to change until the day before`

  const ctaDisabled = !bookable || disabled || confirmPending || (isSelected && !onConfirm)

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetTop}>
        <View style={styles.sheetTitleWrap}>
          <Text style={styles.sheetZone}>{table.zone}</Text>
          <Text style={styles.sheetTitle}>Table {table.table_number}</Text>
        </View>
        <View style={[styles.tag, statusStyle]}>
          <Text style={[styles.tagText, !bookable ? styles.tagTextMuted : isSelected ? styles.tagTextSelected : styles.tagTextFree]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.sheetDescription}>{furniture.description}</Text>

      <View style={styles.sheetTags}>
        {furniture.tags.map((tag) => (
          <View key={tag} style={styles.sheetTag}>
            <Text style={styles.sheetTagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sheetActions}>
        <PressScale
          onPress={isSelected ? onConfirm : onChoose}
          disabled={ctaDisabled}
          style={styles.sheetCtaWrap}
          accessibilityLabel={cta}
        >
          <View style={[styles.sheetCta, ctaDisabled && styles.sheetCtaDisabled]}>
            <Text style={[styles.sheetCtaText, ctaDisabled && styles.sheetCtaTextDisabled]}>
              {confirmPending ? "Reserving…" : cta}
            </Text>
          </View>
        </PressScale>
        <PressScale onPress={onClear} accessibilityLabel="Clear the selection" scaleTo={0.92}>
          <View style={styles.sheetClear}>
            <Ionicons name="close" size={16} color={colors.ink700} />
          </View>
        </PressScale>
      </View>

      <Text style={styles.sheetFootnote}>{footnote}</Text>
    </View>
  )
}

function ZoomButton({
  icon,
  label,
  onPress,
  disabled,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
  divider?: boolean
}) {
  return (
    <PressScale onPress={onPress} disabled={disabled} accessibilityLabel={label} scaleTo={0.9}>
      <View style={[styles.zoomButton, divider && styles.zoomButtonDivider]}>
        <Ionicons name={icon} size={16} color={disabled ? alpha.ink(0.25) : colors.ink700} />
      </View>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
    backgroundColor: colors.parchment50,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: alpha.ink(0.1),
    backgroundColor: "rgba(244,237,226,0.7)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerEyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink950,
  },
  headerSeating: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink700,
  },
  zoneRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: alpha.ink(0.08),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
    backgroundColor: colors.parchment50,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 4,
  },
  zoneSwatch: {
    height: 14,
    width: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  zoneName: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.ink800,
    textTransform: "capitalize",
  },
  zoneCount: {
    fontSize: 11,
  },
  zoneCountFree: {
    fontFamily: fonts.sansBold,
    color: colors.moss500,
  },
  zoneCountEmpty: {
    fontFamily: fonts.sans,
    color: alpha.ink(0.35),
  },
  board: {
    backgroundColor: "#f6f2ea",
    position: "relative",
  },
  zoomControls: {
    position: "absolute",
    right: 12,
    top: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
    backgroundColor: "rgba(251,248,243,0.95)",
    overflow: "hidden",
  },
  zoomButton: {
    padding: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomButtonDivider: {
    borderTopWidth: 1,
    borderTopColor: alpha.ink(0.08),
  },
  panHint: {
    position: "absolute",
    left: 14,
    bottom: 14,
    borderRadius: radius.pill,
    backgroundColor: "rgba(25,21,18,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  panHintText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.parchment50,
  },
  toast: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: radius.md,
    backgroundColor: colors.ink950,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.parchment50,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: alpha.ink(0.08),
    backgroundColor: "rgba(244,237,226,0.4)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: alpha.ink(0.55),
  },
  sheet: {
    borderTopWidth: 2,
    borderTopColor: colors.ink950,
    backgroundColor: "rgba(244,237,226,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sheetEmpty: {
    minHeight: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sheetEmptyBadge: {
    height: 44,
    width: 44,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: alpha.ink(0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  sheetEmptyBadgeText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: alpha.ink(0.45),
  },
  sheetEmptyCopy: {
    flex: 1,
  },
  sheetEmptyTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.ink950,
  },
  sheetEmptyNote: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: alpha.ink(0.6),
  },
  sheetTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetTitleWrap: {
    flexShrink: 1,
  },
  sheetZone: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: alpha.ink(0.55),
  },
  sheetTitle: {
    marginTop: 2,
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink950,
  },
  tag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagMuted: {
    borderColor: alpha.ink(0.12),
    backgroundColor: alpha.ink(0.05),
  },
  tagSelected: {
    borderColor: alpha.ember(0.3),
    backgroundColor: alpha.ember(0.12),
  },
  tagFree: {
    borderColor: alpha.moss(0.3),
    backgroundColor: alpha.moss(0.1),
  },
  tagText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tagTextMuted: {
    color: alpha.ink(0.6),
  },
  tagTextSelected: {
    color: colors.ember600,
  },
  tagTextFree: {
    color: colors.moss500,
  },
  sheetDescription: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  sheetTags: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sheetTag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.12),
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sheetTagText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink600,
  },
  sheetActions: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  sheetCtaWrap: {
    flex: 1,
  },
  sheetCta: {
    borderRadius: radius.md,
    backgroundColor: colors.ink950,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "center",
  },
  sheetCtaDisabled: {
    backgroundColor: alpha.ink(0.12),
  },
  sheetCtaText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.parchment50,
  },
  sheetCtaTextDisabled: {
    color: alpha.ink(0.5),
  },
  sheetClear: {
    height: "100%",
    minHeight: 52,
    width: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha.ink(0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  sheetFootnote: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    color: alpha.ink(0.6),
  },
})
