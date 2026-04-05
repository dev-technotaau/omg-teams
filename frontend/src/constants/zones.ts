// ──────────────────────────────────────────────
//  Zone Constants — Spec Section 5
// ──────────────────────────────────────────────

export const ZONES = {
  NORTH: "NORTH",
  SOUTH: "SOUTH",
  EAST: "EAST",
  WEST: "WEST",
  CENTRAL: "CENTRAL",
} as const;

export type Zone = (typeof ZONES)[keyof typeof ZONES];

export const ZONE_SET: Record<Zone, "A" | "B"> = {
  NORTH: "B",
  SOUTH: "B",
  EAST: "B",
  WEST: "A",
  CENTRAL: "A",
};

export const ZONE_OPTIONS: { value: Zone; label: string; set: "A" | "B" }[] = [
  { value: "NORTH", label: "North", set: "B" },
  { value: "SOUTH", label: "South", set: "B" },
  { value: "EAST", label: "East", set: "B" },
  { value: "WEST", label: "West", set: "A" },
  { value: "CENTRAL", label: "Central", set: "A" },
];

export const ZONE_FILTER_OPTIONS = [
  { value: "", label: "All Zones" },
  ...ZONE_OPTIONS.map((z) => ({ value: z.value, label: z.label })),
] as const;

export function isSetA(zone: Zone): boolean {
  return ZONE_SET[zone] === "A";
}
