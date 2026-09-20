export type Sex = "Female" | "Male";
export type GoatStatus = "Active" | "Quarantine" | "Sold" | "Deceased";
export type GrowthStatus = "On Target" | "Below Target" | "No Target";

export interface WeightRecord {
  id: string;
  goatId: string;
  date: string;
  weightKg: number;
}

export interface Goat {
  id: string;
  name: string;
  rfid?: string;
  breed: string;
  sex: Sex;
  dob: string;
  status: GoatStatus;
  source: string;
  purchaseDate?: string;
  purchasePrice?: number;
  pen?: string;
  healthStatus: string;
  targetAdgGPerDay?: number;
  notes?: string;
}

export interface FarmState {
  goats: Goat[];
  weights: WeightRecord[];
  version: number;
  testMode: boolean;
}

export interface WeightCalculation {
  current?: WeightRecord;
  previous?: WeightRecord;
  gainKg?: number;
  days?: number;
  adgGPerDay?: number;
  targetAdgGPerDay?: number;
  growthStatus: GrowthStatus;
}

export const STORAGE_KEY = "spb-farm-os-v1";

export function seedState(): FarmState {
  return {
    version: 1,
    testMode: true,
    goats: [
      {
        id: "SPB-TEST-F-0001",
        name: "Raja",
        rfid: "TEST-RFID-000001",
        breed: "Osmanabadi × Boer",
        sex: "Female",
        dob: "2025-11-15",
        status: "Active",
        source: "Test Supplier",
        purchaseDate: "2026-01-10",
        purchasePrice: 12500,
        pen: "P-01",
        healthStatus: "Healthy",
        targetAdgGPerDay: 80,
      },
      {
        id: "SPB-TEST-F-0002",
        name: "Lakshmi",
        rfid: "TEST-RFID-000002",
        breed: "Osmanabadi",
        sex: "Female",
        dob: "2025-12-02",
        status: "Active",
        source: "Test Supplier",
        purchaseDate: "2026-01-12",
        purchasePrice: 10500,
        pen: "P-01",
        healthStatus: "Healthy",
        targetAdgGPerDay: 80,
      },
      {
        id: "SPB-TEST-M-0001",
        name: "Arjun",
        rfid: "TEST-RFID-000003",
        breed: "Boer × Osmanabadi",
        sex: "Male",
        dob: "2025-09-20",
        status: "Active",
        source: "Test Supplier",
        purchaseDate: "2026-01-15",
        purchasePrice: 18000,
        pen: "P-02",
        healthStatus: "Healthy",
        targetAdgGPerDay: 90,
      },
    ],
    weights: [
      { id: "W-001", goatId: "SPB-TEST-F-0001", date: "2026-08-20", weightKg: 22.4 },
      { id: "W-002", goatId: "SPB-TEST-F-0001", date: "2026-09-10", weightKg: 24.1 },
      { id: "W-003", goatId: "SPB-TEST-F-0002", date: "2026-08-20", weightKg: 18.2 },
      { id: "W-004", goatId: "SPB-TEST-F-0002", date: "2026-09-10", weightKg: 19.0 },
      { id: "W-005", goatId: "SPB-TEST-M-0001", date: "2026-08-20", weightKg: 31.5 },
      { id: "W-006", goatId: "SPB-TEST-M-0001", date: "2026-09-10", weightKg: 33.2 },
    ],
  };
}

export function loadState(): FarmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    return JSON.parse(raw) as FarmState;
  } catch {
    return seedState();
  }
}

export function saveState(state: FarmState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getGoatWeights(state: FarmState, goatId: string) {
  return state.weights
    .filter((w) => w.goatId === goatId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateWeight(state: FarmState, goat: Goat): WeightCalculation {
  const history = getGoatWeights(state, goat.id);
  if (!history.length) return { growthStatus: "No Target" };
  const current = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : undefined;
  if (!previous) {
    return {
      current,
      targetAdgGPerDay: goat.targetAdgGPerDay,
      growthStatus: goat.targetAdgGPerDay ? "No Target" : "No Target",
    };
  }
  const days = Math.max(
    1,
    Math.round((new Date(current.date).getTime() - new Date(previous.date).getTime()) / 86400000)
  );
  const gainKg = current.weightKg - previous.weightKg;
  const adgGPerDay = (gainKg * 1000) / days;
  const target = goat.targetAdgGPerDay;
  return {
    current,
    previous,
    gainKg,
    days,
    adgGPerDay,
    targetAdgGPerDay: target,
    growthStatus: target == null ? "No Target" : adgGPerDay >= target ? "On Target" : "Below Target",
  };
}

export function ageText(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months < 1) return "<1 month";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return years ? `${years}y ${rem}m` : `${rem}m`;
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}