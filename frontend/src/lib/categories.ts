/** Canonical infrastructure fault categories (must match backend CANONICAL_CATEGORIES). */
export const FAULT_CATEGORIES = [
  { value: "pothole", label: "Pothole" },
  { value: "water_leak", label: "Water leak" },
  { value: "blocked_drain", label: "Blocked drain / gutter" },
  { value: "downed_power_line", label: "Downed power line" },
  { value: "uncollected_waste", label: "Uncollected waste" },
  { value: "broken_streetlight", label: "Broken streetlight" },
  { value: "damaged_road_sign", label: "Damaged road sign" },
  { value: "other", label: "Other / not sure" },
] as const;

export type FaultCategoryValue = (typeof FAULT_CATEGORIES)[number]["value"];

export function categoryLabel(value: string): string {
  const found = FAULT_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value.replace(/_/g, " ");
}
