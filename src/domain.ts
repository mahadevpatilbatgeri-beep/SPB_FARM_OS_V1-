export type Sex = "Female" | "Male";
export type GoatStatus = "Active" | "Quarantine" | "Sold" | "Deceased";
export type GrowthStatus = "On Target" | "Below Target" | "No Target";

export type RFIDStatus = "ACTIVE" | "REPLACED";
export type RFIDAction = "RFID_ASSIGNED" | "RFID_REPLACED";

export interface WeightRecord {
  id: string;
  goatId: string;
  date: string;
  weightKg: number;
}

export interface Goat {
  id: string;
  name: string;

  /**
   * @deprecated
   * Kept temporarily for V1 App compatibility.
   * V1.1 source of truth is rfidAssignments.
   */
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

export interface RFIDAssignment {
  id: string;
  goatId: string;
  rfid: string;
  status: RFIDStatus;
  assignedDate: string;
  replacedDate?: string;
  replacementReason?: string;
  notes?: string;
}

export interface RFIDAuditEvent {
  id: string;
  action: RFIDAction;
  goatId: string;
  oldRfid?: string;
  newRfid?: string;
  date: string;
  reason?: string;
  performedBy?: string;
  notes?: string;
}

export interface FarmState {
  goats: Goat[];
  weights: WeightRecord[];

  /**
   * V1.1 Identity + RFID layer
   */
  rfidAssignments: RFIDAssignment[];
  rfidAudit: RFIDAuditEvent[];

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

export const CURRENT_STATE_VERSION = 2;

export function seedState(): FarmState {
  const today = new Date().toISOString().slice(0, 10);

  return {
    version: CURRENT_STATE_VERSION,
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
      {
        id: "W-001",
        goatId: "SPB-TEST-F-0001",
        date: "2026-08-20",
        weightKg: 22.4,
      },
      {
        id: "W-002",
        goatId: "SPB-TEST-F-0001",
        date: "2026-09-10",
        weightKg: 24.1,
      },
      {
        id: "W-003",
        goatId: "SPB-TEST-F-0002",
        date: "2026-08-20",
        weightKg: 18.2,
      },
      {
        id: "W-004",
        goatId: "SPB-TEST-F-0002",
        date: "2026-09-10",
        weightKg: 19.0,
      },
      {
        id: "W-005",
        goatId: "SPB-TEST-M-0001",
        date: "2026-08-20",
        weightKg: 31.5,
      },
      {
        id: "W-006",
        goatId: "SPB-TEST-M-0001",
        date: "2026-09-10",
        weightKg: 33.2,
      },
    ],

    rfidAssignments: [
      {
        id: "RFID-A-001",
        goatId: "SPB-TEST-F-0001",
        rfid: "TEST-RFID-000001",
        status: "ACTIVE",
        assignedDate: "2026-01-10",
      },
      {
        id: "RFID-A-002",
        goatId: "SPB-TEST-F-0002",
        rfid: "TEST-RFID-000002",
        status: "ACTIVE",
        assignedDate: "2026-01-12",
      },
      {
        id: "RFID-A-003",
        goatId: "SPB-TEST-M-0001",
        rfid: "TEST-RFID-000003",
        status: "ACTIVE",
        assignedDate: "2026-01-15",
      },
    ],

    rfidAudit: [],
  };
}

export function migrateState(input: FarmState): FarmState {
  const state = input as Partial<FarmState> & {
    goats?: Goat[];
    weights?: WeightRecord[];
  };

  const goats = Array.isArray(state.goats) ? state.goats : [];
  const weights = Array.isArray(state.weights) ? state.weights : [];

  const existingAssignments = Array.isArray(state.rfidAssignments)
    ? state.rfidAssignments
    : [];

  const existingAudit = Array.isArray(state.rfidAudit)
    ? state.rfidAudit
    : [];

  const assignments = [...existingAssignments];

  /**
   * Migrate legacy V1 Goat.rfid values into the V1.1
   * RFID assignment table without changing Goat IDs
   * or weight records.
   */
  for (const goat of goats) {
    if (!goat.rfid) continue;

    const alreadyAssigned = assignments.some(
      (assignment) =>
        assignment.goatId === goat.id &&
        assignment.rfid === goat.rfid
    );

    if (alreadyAssigned) continue;

    const rfidAlreadyActive = assignments.some(
      (assignment) =>
        assignment.rfid === goat.rfid &&
        assignment.status === "ACTIVE"
    );

    if (rfidAlreadyActive) continue;

    assignments.push({
      id: uid("RFID-A"),
      goatId: goat.id,
      rfid: goat.rfid,
      status: "ACTIVE",
      assignedDate: goat.purchaseDate ?? new Date().toISOString().slice(0, 10),
    });
  }

  return {
    goats,
    weights,
    rfidAssignments: assignments,
    rfidAudit: existingAudit,
    version: CURRENT_STATE_VERSION,
    testMode: state.testMode ?? true,
  };
}

export function loadState(): FarmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return seedState();
    }

    const parsed = JSON.parse(raw) as FarmState;

    if (
      parsed.version !== CURRENT_STATE_VERSION ||
      !Array.isArray(parsed.rfidAssignments) ||
      !Array.isArray(parsed.rfidAudit)
    ) {
      const migrated = migrateState(parsed);
      saveState(migrated);
      return migrated;
    }

    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: FarmState) {
  const nextState: FarmState = {
    ...state,
    version: CURRENT_STATE_VERSION,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function getGoatWeights(state: FarmState, goatId: string) {
  return state.weights
    .filter((w) => w.goatId === goatId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateWeight(
  state: FarmState,
  goat: Goat
): WeightCalculation {
  const history = getGoatWeights(state, goat.id);

  if (!history.length) {
    return {
      growthStatus: "No Target",
    };
  }

  const current = history[history.length - 1];

  const previous =
    history.length > 1 ? history[history.length - 2] : undefined;

  if (!previous) {
    return {
      current,
      targetAdgGPerDay: goat.targetAdgGPerDay,
      growthStatus: goat.targetAdgGPerDay
        ? "No Target"
        : "No Target",
    };
  }

  const days = Math.max(
    1,
    Math.round(
      (new Date(current.date).getTime() -
        new Date(previous.date).getTime()) /
        86400000
    )
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
    growthStatus:
      target == null
        ? "No Target"
        : adgGPerDay >= target
          ? "On Target"
          : "Below Target",
  };
}

export function getActiveRfid(
  state: FarmState,
  goatId: string
): RFIDAssignment | undefined {
  return state.rfidAssignments.find(
    (assignment) =>
      assignment.goatId === goatId &&
      assignment.status === "ACTIVE"
  );
}

export function isRfidActive(
  state: FarmState,
  rfid: string
): boolean {
  return state.rfidAssignments.some(
    (assignment) =>
      assignment.rfid === rfid &&
      assignment.status === "ACTIVE"
  );
}

export function getGoatRfidHistory(
  state: FarmState,
  goatId: string
): RFIDAssignment[] {
  return state.rfidAssignments
    .filter((assignment) => assignment.goatId === goatId)
    .sort((a, b) =>
      a.assignedDate.localeCompare(b.assignedDate)
    );
}

export function normalizeAssignments(
  state: FarmState
): FarmState {
  const assignments = [...state.rfidAssignments];

  const seenActive = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.status !== "ACTIVE") continue;

    if (seenActive.has(assignment.rfid)) {
      assignment.status = "REPLACED";
      assignment.replacedDate =
        assignment.replacedDate ??
        new Date().toISOString().slice(0, 10);
      continue;
    }

    seenActive.add(assignment.rfid);
  }

  return {
    ...state,
    rfidAssignments: assignments,
    version: CURRENT_STATE_VERSION,
  };
}

export function generateGoatId(
  goats: Goat[],
  sex: Sex,
  year = new Date().getFullYear()
): string {
  const yy = String(year).slice(-2);
  const sexCode = sex === "Female" ? "F" : "M";
  const prefix = `SPB-${yy}-${sexCode}-`;

  let maxSequence = 0;

  for (const goat of goats) {
    if (!goat.id.startsWith(prefix)) continue;

    const sequenceText = goat.id.slice(prefix.length);
    const sequence = Number(sequenceText);

    if (Number.isInteger(sequence)) {
      maxSequence = Math.max(maxSequence, sequence);
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
}

export function ageText(dob: string) {
  const birth = new Date(dob);
  const now = new Date();

  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months--;
  }

  if (months < 1) {
    return "<1 month";
  }

  const years = Math.floor(months / 12);
  const rem = months % 12;

  return years ? `${years}y ${rem}m` : `${rem}m`;
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}