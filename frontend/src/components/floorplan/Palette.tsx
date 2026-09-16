import { ELEMENT_KINDS, ELEMENT_PRESETS, type FloorElementKind, type TableShape } from "../../lib/floorplan"

const GROUP_LABEL: Record<"structure" | "furniture", string> = {
  structure: "Structure",
  furniture: "Furniture",
}

const TABLE_PRESETS: { label: string; shape: TableShape; seats: number }[] = [
  { label: "2-top", shape: "round", seats: 2 },
  { label: "4-top", shape: "round", seats: 4 },
  { label: "Square 4", shape: "square", seats: 4 },
  { label: "Long 6", shape: "rect", seats: 6 },
  { label: "Long 8", shape: "rect", seats: 8 },
]

function Swatch({ kind }: { kind: FloorElementKind }) {
  const preset = ELEMENT_PRESETS[kind]
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 rounded-[3px] border"
      style={{
        backgroundColor: preset.fill === "transparent" ? "#fbf8f3" : preset.fill,
        borderColor: preset.stroke,
      }}
    />
  )
}

export function Palette({
  onAddTable,
  onAddElement,
}: {
  onAddTable: (shape: TableShape, seats: number) => void
  onAddElement: (kind: FloorElementKind) => void
}) {
  const groups: ("structure" | "furniture")[] = ["structure", "furniture"]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Tables</h3>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {TABLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onAddTable(preset.shape, preset.seats)}
              className="rounded-lg border border-ink-900/12 bg-parchment-50 px-2 py-1.5 text-left text-xs text-ink-800 transition-colors hover:border-ember-400/60 hover:text-ink-950"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group}>
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-600">
            {GROUP_LABEL[group]}
          </h3>
          <p className="mt-1 text-[11px] text-ink-600/70">Click to add, or drag onto the plan.</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {ELEMENT_KINDS.filter((kind) => ELEMENT_PRESETS[kind].group === group).map((kind) => (
              <button
                key={kind}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-floor-element", kind)
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => onAddElement(kind)}
                className="flex items-center gap-1.5 rounded-lg border border-ink-900/12 bg-parchment-50 px-2 py-1.5 text-left text-xs text-ink-800 transition-colors hover:border-ember-400/60 hover:text-ink-950"
              >
                <Swatch kind={kind} />
                {ELEMENT_PRESETS[kind].label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
