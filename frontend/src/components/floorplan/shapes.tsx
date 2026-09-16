import {
  CHAIR_CM,
  ELEMENT_PRESETS,
  STATUS_FILL,
  chairPositions,
  type FloorElementKind,
  type TableShape,
  type TableStatus,
} from "../../lib/floorplan"

/** Everything here draws in centimetres around a (0,0) centre - the caller supplies the
 * translate/rotate transform, so an item's stored x/y is always its centre point. */

const CHAIR_DEPTH_CM = CHAIR_CM * 0.78

export function ChairGlyph({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect
        x={-CHAIR_CM / 2}
        y={-CHAIR_DEPTH_CM / 2}
        width={CHAIR_CM}
        height={CHAIR_DEPTH_CM}
        rx={CHAIR_CM * 0.22}
        fill="#d8c9b2"
        stroke="#a38b6a"
        strokeWidth={2}
      />
      {/* Backrest - the edge away from the table. */}
      <rect
        x={-CHAIR_CM / 2}
        y={-CHAIR_DEPTH_CM / 2}
        width={CHAIR_CM}
        height={CHAIR_DEPTH_CM * 0.26}
        rx={CHAIR_CM * 0.12}
        fill="#a38b6a"
      />
    </g>
  )
}

export function TableGlyph({
  shape,
  seats,
  width,
  height,
  label,
  status = "free",
  labelPx,
  dimmed,
}: {
  shape: TableShape
  seats: number
  width: number
  height: number
  label: string
  status?: TableStatus
  /** Font size in cm that renders at a constant on-screen size. */
  labelPx: number
  dimmed?: boolean
}) {
  const tone = STATUS_FILL[status]
  const chairs = chairPositions(shape, seats, width, height)
  // A long number on a small two-top would spill past the table top, where light-on-light
  // text disappears - shrink the label until it fits inside.
  const fittedLabelPx = Math.min(labelPx, (width * 0.86) / (0.6 * Math.max(2, label.length)))
  return (
    <g opacity={dimmed ? 0.45 : 1}>
      {chairs.map((c, i) => (
        <ChairGlyph key={i} x={c.x} y={c.y} angle={c.angle} />
      ))}
      {shape === "round" ? (
        <ellipse cx={0} cy={0} rx={width / 2} ry={height / 2} fill={tone.fill} stroke={tone.stroke} strokeWidth={3} />
      ) : (
        <rect
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={shape === "square" ? 8 : 6}
          fill={tone.fill}
          stroke={tone.stroke}
          strokeWidth={3}
        />
      )}
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fittedLabelPx}
        fontWeight={600}
        fill={tone.text}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>
    </g>
  )
}

function Bar({ w, h, fill, stroke }: { w: number; h: number; fill: string; stroke: string }) {
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(h / 2, 6)} fill={fill} stroke={stroke} strokeWidth={2} />
}

export function ElementGlyph({
  kind,
  width,
  height,
  label,
  color,
  labelPx,
}: {
  kind: FloorElementKind
  width: number
  height: number
  label: string | null
  color: string | null
  labelPx: number
}) {
  const preset = ELEMENT_PRESETS[kind]
  const fill = color ?? preset.fill
  const stroke = preset.stroke
  const w = width
  const h = height
  const text = label ?? (kind === "label" ? "Text" : null)

  const caption = text ? (
    <text
      x={0}
      y={preset.thin ? -h / 2 - labelPx * 0.5 : 0}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={labelPx}
      fontWeight={600}
      fill={kind === "label" ? "#453a33" : preset.thin ? "#5f5148" : "#fbf8f3"}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {text}
    </text>
  ) : null

  switch (kind) {
    case "window":
      return (
        <g>
          <Bar w={w} h={h} fill={fill} stroke={stroke} />
          <line x1={-w / 2 + 4} y1={0} x2={w / 2 - 4} y2={0} stroke="#fbf8f3" strokeWidth={3} />
          {caption}
        </g>
      )
    case "entrance":
      return (
        <g>
          <Bar w={w} h={h} fill={fill} stroke={stroke} />
          {/* Arrow pointing into the room, so the plan shows which way people walk in. */}
          <path
            d={`M 0 ${h / 2 + 10} L -18 ${h / 2 + 46} L 18 ${h / 2 + 46} Z`}
            fill={stroke}
            opacity={0.75}
          />
          <text
            x={0}
            y={-h / 2 - labelPx * 0.55}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={labelPx}
            fontWeight={700}
            fill="#a34a26"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label ?? "ENTRANCE"}
          </text>
        </g>
      )
    case "door":
      return (
        <g>
          <Bar w={w} h={h} fill={fill} stroke={stroke} />
          {/* Swing arc, the standard architectural notation for a door. */}
          <path
            d={`M ${-w / 2} ${h / 2} A ${w} ${w} 0 0 1 ${w / 2} ${h / 2 + w}`}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray="10 8"
            opacity={0.6}
          />
          {caption}
        </g>
      )
    case "sofa":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} fill={fill} stroke={stroke} strokeWidth={2} />
          {/* Backrest along the top edge, armrests at both ends. */}
          <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.3} rx={10} fill={stroke} />
          <rect x={-w / 2} y={-h / 2} width={h * 0.22} height={h} rx={8} fill={stroke} opacity={0.85} />
          <rect x={w / 2 - h * 0.22} y={-h / 2} width={h * 0.22} height={h} rx={8} fill={stroke} opacity={0.85} />
          {caption}
        </g>
      )
    case "booth":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={14} fill={fill} stroke={stroke} strokeWidth={2} />
          {/* Bench-table-bench: the classic U booth. */}
          <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.24} rx={10} fill={stroke} />
          <rect x={-w / 2} y={h / 2 - h * 0.24} width={w} height={h * 0.24} rx={10} fill={stroke} />
          <rect x={-w * 0.3} y={-h * 0.14} width={w * 0.6} height={h * 0.28} rx={6} fill="#f4ede2" stroke={stroke} strokeWidth={2} />
          {caption}
        </g>
      )
    case "plant":
      return (
        <g>
          <circle cx={0} cy={0} r={Math.min(w, h) / 2} fill={fill} stroke={stroke} strokeWidth={2} />
          <circle cx={0} cy={0} r={Math.min(w, h) / 4} fill={stroke} opacity={0.5} />
          {caption}
        </g>
      )
    case "pillar":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={2} />
          <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} stroke="#fbf8f3" strokeWidth={2} opacity={0.35} />
          <line x1={w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} stroke="#fbf8f3" strokeWidth={2} opacity={0.35} />
          {caption}
        </g>
      )
    case "stairs":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={2} />
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={i}
              x1={-w / 2}
              y1={-h / 2 + (h * (i + 1)) / 8}
              x2={w / 2}
              y2={-h / 2 + (h * (i + 1)) / 8}
              stroke={stroke}
              strokeWidth={2}
            />
          ))}
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={labelPx}
            fontWeight={600}
            fill="#5f5148"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label ?? "Stairs"}
          </text>
        </g>
      )
    case "bar":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={10} fill={fill} stroke={stroke} strokeWidth={2} />
          <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.3} rx={8} fill="#8a7a6a" />
          {caption ?? (
            <text
              x={0}
              y={h * 0.12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={labelPx}
              fontWeight={600}
              fill="#fbf8f3"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              BAR
            </text>
          )}
        </g>
      )
    case "kitchen":
    case "restroom":
      return (
        <g>
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            rx={6}
            fill={fill}
            stroke={stroke}
            strokeWidth={3}
            strokeDasharray="14 10"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={labelPx}
            fontWeight={600}
            fill="#5f5148"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label ?? preset.label}
          </text>
        </g>
      )
    case "label":
      return (
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.max(labelPx, h * 0.6)}
          fontWeight={600}
          fill="#453a33"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {label ?? "Text"}
        </text>
      )
    default:
      // wall, divider
      return (
        <g>
          <Bar w={w} h={h} fill={fill} stroke={stroke} />
          {caption}
        </g>
      )
  }
}
