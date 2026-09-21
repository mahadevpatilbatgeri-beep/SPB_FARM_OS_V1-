import { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bell,
  ChevronRight,
  CirclePlus,
  HeartPulse,
  Home,
  PawPrint,
  Radio,
  Search,
  ShieldCheck,
  Weight,
  X,
} from "lucide-react";

import {
  ageText,
  calculateWeight,
  FarmState,
  generateGoatId,
  getActiveRfid,
  getGoatRfidHistory,
  getGoatWeights,
  Goat,
  isRfidActive,
  loadState,
  saveState,
  uid,
  WeightCalculation,
} from "./domain";

type Screen =
  | "dashboard"
  | "search"
  | "goat"
  | "weight"
  | "health"
  | "rfid";

type Modal =
  | "add-goat"
  | "edit-goat"
  | "weight"
  | "assign-rfid"
  | "replace-rfid"
  | null;

const nav = [
  { id: "dashboard" as Screen, label: "Home", icon: Home },
  { id: "search" as Screen, label: "Search", icon: Search },
];

const reasons = [
  "Damaged",
  "Lost",
  "Malfunctioning",
  "Fell off",
  "Reader unable to detect",
  "Administrative replacement",
  "Other",
];

export default function App() {
  const [state, setState] = useState<FarmState>(() => loadState());
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedGoatId, setSelectedGoatId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState("");

  const selectedGoat = useMemo(
    () => state.goats.find((g) => g.id === selectedGoatId),
    [state.goats, selectedGoatId]
  );

  function commit(next: FarmState) {
    setState(next);
    saveState(next);
  }

  function openGoat(goatId: string) {
    setSelectedGoatId(goatId);
    setScreen("goat");
  }

  function back() {
    if (screen === "goat" || screen === "weight" || screen === "health") {
      setScreen("search");
      return;
    }

    setScreen("dashboard");
  }

  function addGoat(goat: Goat, rfid?: string) {
    let next: FarmState = {
      ...state,
      goats: [...state.goats, goat],
    };

    if (rfid) {
      if (isRfidActive(next, rfid)) {
        alert("This RFID is already actively assigned.");
        return;
      }

      next.rfidAssignments = [
        ...next.rfidAssignments,
        {
          id: uid("RFID-A"),
          goatId: goat.id,
          rfid,
          status: "ACTIVE",
          assignedDate: new Date().toISOString().slice(0, 10),
        },
      ];

      next.rfidAudit = [
        ...next.rfidAudit,
        {
          id: uid("RFID-E"),
          action: "RFID_ASSIGNED",
          goatId: goat.id,
          newRfid: rfid,
          date: new Date().toISOString().slice(0, 10),
        },
      ];
    }

    commit(next);
    setModal(null);
    openGoat(goat.id);
  }

  function editGoat(updated: Goat) {
    const next: FarmState = {
      ...state,
      goats: state.goats.map((g) =>
        g.id === updated.id ? { ...g, ...updated, id: g.id } : g
      ),
    };

    commit(next);
    setModal(null);
  }

  function addWeight(
    goatId: string,
    date: string,
    weightKg: number,
    notes?: string
  ) {
    const duplicate = state.weights.some(
      (w) => w.goatId === goatId && w.date === date
    );

    if (duplicate) {
      alert(
        "A weight record already exists for this goat on this date. It was not overwritten."
      );
      return;
    }

    const next: FarmState = {
      ...state,
      weights: [
        ...state.weights,
        {
          id: uid("W"),
          goatId,
          date,
          weightKg,
          ...(notes ? { notes } : {}),
        } as any,
      ],
    };

    commit(next);
    setModal(null);
  }

  function assignRfid(goatId: string, rfid: string, date: string) {
    const clean = rfid.trim();

    if (!clean) {
      alert("RFID is required.");
      return;
    }

    if (isRfidActive(state, clean)) {
      alert("This RFID is already actively assigned to another goat.");
      return;
    }

    const next: FarmState = {
      ...state,
      rfidAssignments: [
        ...state.rfidAssignments,
        {
          id: uid("RFID-A"),
          goatId,
          rfid: clean,
          status: "ACTIVE",
          assignedDate: date,
        },
      ],
      rfidAudit: [
        ...state.rfidAudit,
        {
          id: uid("RFID-E"),
          action: "RFID_ASSIGNED",
          goatId,
          newRfid: clean,
          date,
        },
      ],
      goats: state.goats.map((goat) =>
        goat.id === goatId ? { ...goat, rfid: clean } : goat
      ),
    };

    commit(next);
    setModal(null);
  }

  function replaceRfid(
    goatId: string,
    newRfid: string,
    date: string,
    reason: string,
    notes?: string
  ) {
    const clean = newRfid.trim();

    if (!clean) {
      alert("New RFID is required.");
      return;
    }

    if (!reason) {
      alert("Replacement reason is required.");
      return;
    }

    if (reason === "Other" && !notes?.trim()) {
      alert("Please enter notes for 'Other'.");
      return;
    }

    const current = getActiveRfid(state, goatId);

    if (!current) {
      alert("This goat does not currently have an active RFID.");
      return;
    }

    if (current.rfid === clean) {
      alert("New RFID must be different from the current RFID.");
      return;
    }

    if (isRfidActive(state, clean)) {
      alert("This RFID is already actively assigned.");
      return;
    }

    const next: FarmState = {
      ...state,
      rfidAssignments: state.rfidAssignments.map((assignment) =>
        assignment.id === current.id
          ? {
              ...assignment,
              status: "REPLACED",
              replacedDate: date,
              replacementReason: reason,
              notes,
            }
          : assignment
      ),
      rfidAudit: [
        ...state.rfidAudit,
        {
          id: uid("RFID-E"),
          action: "RFID_REPLACED",
          goatId,
          oldRfid: current.rfid,
          newRfid: clean,
          date,
          reason,
          notes,
        },
      ],
      goats: state.goats.map((goat) =>
        goat.id === goatId ? { ...goat, rfid: clean } : goat
      ),
    };

    next.rfidAssignments.push({
      id: uid("RFID-A"),
      goatId,
      rfid: clean,
      status: "ACTIVE",
      assignedDate: date,
    });

    commit(next);
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-xl font-bold tracking-tight">
              SPB FARM OS
            </div>
            <div className="text-xs text-slate-400">
              Goat Farm Management
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-white/10 p-2">
              <Bell size={18} />
            </button>

            <button className="rounded-xl border border-white/10 p-2">
              <ShieldCheck size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-28">
        {screen === "dashboard" && (
          <Dashboard
            state={state}
            onSearch={() => setScreen("search")}
            onAdd={() => setModal("add-goat")}
            onOpenGoat={openGoat}
          />
        )}

        {screen === "search" && (
          <SearchScreen
            state={state}
            search={search}
            setSearch={setSearch}
            onBack={back}
            onOpenGoat={openGoat}
            onAdd={() => setModal("add-goat")}
          />
        )}

        {screen === "goat" && selectedGoat && (
          <Goat360
            state={state}
            goat={selectedGoat}
            onBack={back}
            onWeight={() => setModal("weight")}
            onEdit={() => setModal("edit-goat")}
            onAssignRfid={() => setModal("assign-rfid")}
            onReplaceRfid={() => setModal("replace-rfid")}
            onHealth={() => {
              setScreen("health");
            }}
          />
        )}

        {screen === "weight" && selectedGoat && (
          <WeightScreen
            state={state}
            goat={selectedGoat}
            onBack={back}
            onAddWeight={() => setModal("weight")}
          />
        )}

        {screen === "health" && selectedGoat && (
          <HealthScreen goat={selectedGoat} onBack={back} />
        )}

        {modal === "add-goat" && (
          <GoatForm
            title="Add Goat"
            onClose={() => setModal(null)}
            onSave={addGoat}
          />
        )}

        {modal === "edit-goat" && selectedGoat && (
          <GoatForm
            title="Edit Goat"
            goat={selectedGoat}
            onClose={() => setModal(null)}
            onSave={(updated) => editGoat(updated)}
          />
        )}

        {modal === "weight" && selectedGoat && (
          <WeightModal
            goat={selectedGoat}
            onClose={() => setModal(null)}
            onSave={(date, weight, notes) =>
              addWeight(selectedGoat.id, date, weight, notes)
            }
          />
        )}

        {modal === "assign-rfid" && selectedGoat && (
          <RfidModal
            mode="assign"
            goat={selectedGoat}
            onClose={() => setModal(null)}
            onSave={(rfid, date) =>
              assignRfid(selectedGoat.id, rfid, date)
            }
          />
        )}

        {modal === "replace-rfid" && selectedGoat && (
          <RfidModal
            mode="replace"
            goat={selectedGoat}
            onClose={() => setModal(null)}
            onSave={(rfid, date, reason, notes) =>
              replaceRfid(
                selectedGoat.id,
                rfid,
                date,
                reason ?? "",
                notes
              )
            }
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl justify-around px-4 py-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = screen === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs ${
                  active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-slate-400"
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Dashboard({
  state,
  onSearch,
  onAdd,
  onOpenGoat,
}: {
  state: FarmState;
  onSearch: () => void;
  onAdd: () => void;
  onOpenGoat: (id: string) => void;
}) {
  const active = state.goats.filter((g) => g.status === "Active");
  const females = active.filter((g) => g.sex === "Female");
  const males = active.filter((g) => g.sex === "Male");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-sm text-emerald-400">
            Welcome to your farm
          </div>
          <h1 className="text-3xl font-bold">Farm Dashboard</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSearch}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <Search size={18} />
            Find Goat
          </button>

          <button
            onClick={onAdd}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
          >
            <CirclePlus size={18} />
            Add Goat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total Goats" value={active.length} icon={<PawPrint />} />
        <Kpi label="Females" value={females.length} icon={<PawPrint />} />
        <Kpi label="Males" value={males.length} icon={<PawPrint />} />
        <Kpi
          label="With RFID"
          value={
            active.filter((g) => !!getActiveRfid(state, g.id)).length
          }
          icon={<Radio />}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Goats</h2>
          <button
            onClick={onSearch}
            className="text-sm text-emerald-400"
          >
            View all
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {active.map((goat) => (
            <GoatCard
              key={goat.id}
              state={state}
              goat={goat}
              onClick={() => onOpenGoat(goat.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-emerald-400">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function GoatCard({
  state,
  goat,
  onClick,
}: {
  state: FarmState;
  goat: Goat;
  onClick: () => void;
}) {
  const calc = calculateWeight(state, goat);
  const rfid = getActiveRfid(state, goat.id);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{goat.name}</div>
          <div className="mt-1 font-mono text-xs text-emerald-400">
            {goat.id}
          </div>
        </div>

        <ChevronRight size={20} className="text-slate-500" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="Sex" value={goat.sex} />
        <Info label="Breed" value={goat.breed} />
        <Info label="Age" value={ageText(goat.dob)} />
        <Info
          label="Weight"
          value={
            calc.current ? `${calc.current.weightKg.toFixed(1)} kg` : "—"
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
          {goat.status}
        </span>

        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
          {rfid?.rfid ?? "No RFID"}
        </span>
      </div>
    </button>
  );
}

function SearchScreen({
  state,
  search,
  setSearch,
  onBack,
  onOpenGoat,
  onAdd,
}: {
  state: FarmState;
  search: string;
  setSearch: (value: string) => void;
  onBack: () => void;
  onOpenGoat: (id: string) => void;
  onAdd: () => void;
}) {
  const query = search.trim().toLowerCase();

  const results = state.goats.filter((goat) => {
    if (!query) return true;

    const activeRfid = getActiveRfid(state, goat.id)?.rfid ?? "";

    return (
      goat.id.toLowerCase().includes(query) ||
      goat.name.toLowerCase().includes(query) ||
      goat.breed.toLowerCase().includes(query) ||
      activeRfid.toLowerCase().includes(query)
    );
  });

  return (
    <section className="space-y-5">
      <PageHeader title="Find Goat" onBack={onBack} />

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4">
          <Search size={19} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Goat ID, name, RFID..."
            className="w-full bg-transparent py-4 outline-none"
            autoFocus
          />
        </div>

        <button
          onClick={onAdd}
          className="rounded-2xl bg-emerald-500 px-4 font-semibold text-slate-950"
        >
          <CirclePlus size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {results.map((goat) => (
          <GoatCard
            key={goat.id}
            state={state}
            goat={goat}
            onClick={() => onOpenGoat(goat.id)}
          />
        ))}

        {!results.length && (
          <Empty message="No goats found." />
        )}
      </div>
    </section>
  );
}

function Goat360({
  state,
  goat,
  onBack,
  onWeight,
  onEdit,
  onAssignRfid,
  onReplaceRfid,
  onHealth,
}: {
  state: FarmState;
  goat: Goat;
  onBack: () => void;
  onWeight: () => void;
  onEdit: () => void;
  onAssignRfid: () => void;
  onReplaceRfid: () => void;
  onHealth: () => void;
}) {
  const calc = calculateWeight(state, goat);
  const history = getGoatWeights(state, goat.id);
  const rfid = getActiveRfid(state, goat.id);
  const rfidHistory = getGoatRfidHistory(state, goat.id);

  return (
    <section className="space-y-5">
      <PageHeader title="Goat 360°" onBack={onBack} />

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold">{goat.name}</div>
            <div className="mt-1 font-mono text-sm text-emerald-400">
              {goat.id}
            </div>
          </div>

          <button
            onClick={onEdit}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm"
          >
            Edit Goat
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Sex" value={goat.sex} />
          <Metric label="Breed" value={goat.breed} />
          <Metric label="Age" value={ageText(goat.dob)} />
          <Metric
            label="Status"
            value={goat.status}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Radio size={19} className="text-emerald-400" />
            <h2 className="font-semibold">RFID Identity</h2>
          </div>

          {rfid ? (
            <>
              <div className="rounded-xl bg-slate-900 p-4">
                <div className="text-xs text-slate-500">
                  ACTIVE RFID
                </div>
                <div className="mt-1 font-mono text-lg">
                  {rfid.rfid}
                </div>
              </div>

              <button
                onClick={onReplaceRfid}
                className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm"
              >
                Replace RFID
              </button>
            </>
          ) : (
            <button
              onClick={onAssignRfid}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
            >
              Assign RFID
            </button>
          )}

          <div className="mt-4 space-y-2">
            {rfidHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm">
                    {item.rfid}
                  </span>

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] ${
                      item.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Assigned {item.assignedDate}
                  {item.replacedDate
                    ? ` • Replaced ${item.replacedDate}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Weight size={19} className="text-emerald-400" />
            <h2 className="font-semibold">Weight & Growth</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Current"
              value={
                calc.current
                  ? `${calc.current.weightKg.toFixed(1)} kg`
                  : "—"
              }
            />

            <Metric
              label="ADG"
              value={
                calc.adgGPerDay != null
                  ? `${calc.adgGPerDay.toFixed(0)} g/day`
                  : "—"
              }
            />

            <Metric
              label="Target"
              value={
                calc.targetAdgGPerDay != null
                  ? `${calc.targetAdgGPerDay} g/day`
                  : "—"
              }
            />

            <Metric
              label="Growth"
              value={calc.growthStatus}
            />
          </div>

          <button
            onClick={onWeight}
            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
          >
            Add Weight
          </button>

          <button
            onClick={() => {
              const event = new Event("open-weight-screen");
              window.dispatchEvent(event);
            }}
            className="mt-2 w-full rounded-xl border border-white/10 px-4 py-3 text-sm"
          >
            Weight History
          </button>

          <div className="mt-4 space-y-2">
            {history
              .slice()
              .reverse()
              .map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 p-3"
                >
                  <span className="text-sm text-slate-400">
                    {record.date}
                  </span>

                  <span className="font-semibold">
                    {record.weightKg.toFixed(1)} kg
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={onHealth}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
        >
          <HeartPulse className="text-emerald-400" />
          <div>
            <div className="font-semibold">Health</div>
            <div className="text-xs text-slate-500">
              {goat.healthStatus}
            </div>
          </div>
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-500">Source</div>
          <div className="mt-1">{goat.source}</div>
        </div>
      </div>
    </section>
  );
}

function RfidModal({
  mode,
  goat,
  onClose,
  onSave,
}: {
  mode: "assign" | "replace";
  goat: Goat;
  onClose: () => void;
  onSave: (
    rfid: string,
    date: string,
    reason?: string,
    notes?: string
  ) => void;
}) {
  const [rfid, setRfid] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const current = goat.rfid;

  return (
    <ModalShell
      title={mode === "assign" ? "Assign RFID" : "Replace RFID"}
      onClose={onClose}
    >
      {mode === "replace" && (
        <div className="mb-4 rounded-xl bg-slate-900 p-3">
          <div className="text-xs text-slate-500">
            CURRENT RFID
          </div>
          <div className="mt-1 font-mono">{current ?? "None"}</div>
        </div>
      )}

      <label className="field">
        <span>New RFID *</span>
        <input
          value={rfid}
          onChange={(e) => setRfid(e.target.value)}
          placeholder="Enter RFID"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Date *</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      {mode === "replace" && (
        <>
          <label className="field">
            <span>Replacement Reason *</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Select reason</option>
              {reasons.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Notes {reason === "Other" ? "*" : "(optional)"}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason/details"
              rows={3}
            />
          </label>
        </>
      )}

      <button
        onClick={() =>
          onSave(
            rfid,
            date,
            mode === "replace" ? reason : undefined,
            mode === "replace" ? notes : undefined
          )
        }
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
      >
        {mode === "assign" ? "Assign RFID" : "Replace RFID"}
      </button>
    </ModalShell>
  );
}

function GoatForm({
  title,
  goat,
  onClose,
  onSave,
}: {
  title: string;
  goat?: Goat;
  onClose: () => void;
  onSave: (goat: Goat, rfid?: string) => void;
}) {
  const [name, setName] = useState(goat?.name ?? "");
  const [sex, setSex] = useState<Goat["sex"]>(
    goat?.sex ?? "Female"
  );
  const [breed, setBreed] = useState(goat?.breed ?? "");
  const [dob, setDob] = useState(goat?.dob ?? "");
  const [status, setStatus] = useState<Goat["status"]>(
    goat?.status ?? "Active"
  );
  const [source, setSource] = useState(goat?.source ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    goat?.purchaseDate ?? ""
  );
  const [purchasePrice, setPurchasePrice] = useState(
    goat?.purchasePrice?.toString() ?? ""
  );
  const [pen, setPen] = useState(goat?.pen ?? "");
  const [healthStatus, setHealthStatus] = useState(
    goat?.healthStatus ?? "Healthy"
  );
  const [targetAdg, setTargetAdg] = useState(
    goat?.targetAdgGPerDay?.toString() ?? ""
  );
  const [rfid, setRfid] = useState(goat?.rfid ?? "");
  const [notes, setNotes] = useState(goat?.notes ?? "");

  function submit() {
    if (!name.trim() || !breed.trim() || !dob || !source.trim()) {
      alert("Please complete all required fields.");
      return;
    }

    const nextGoat: Goat = {
      id:
        goat?.id ??
        generateGoatId([], sex, new Date(dob).getFullYear()),
      name: name.trim(),
      breed: breed.trim(),
      sex,
      dob,
      status,
      source: source.trim(),
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice
        ? Number(purchasePrice)
        : undefined,
      pen: pen || undefined,
      healthStatus,
      targetAdgGPerDay: targetAdg
        ? Number(targetAdg)
        : undefined,
      notes: notes || undefined,
      rfid: goat?.rfid,
    };

    if (!goat) {
      onSave(nextGoat, rfid.trim() || undefined);
    } else {
      onSave(nextGoat);
    }
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      {goat && (
        <div className="mb-4 rounded-xl bg-slate-900 p-3">
          <div className="text-xs text-slate-500">
            PERMANENT GOAT ID
          </div>
          <div className="mt-1 font-mono text-emerald-400">
            {goat.id}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Goat ID cannot be edited.
          </div>
        </div>
      )}

      <label className="field">
        <span>Goat Name *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goat name"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Sex *</span>
        <select
          value={sex}
          onChange={(e) =>
            setSex(e.target.value as Goat["sex"])
          }
          disabled={!!goat}
        >
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
      </label>

      <label className="field">
        <span>Breed *</span>
        <input
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          placeholder="Osmanabadi × Boer"
        />
      </label>

      <label className="field">
        <span>Date of Birth *</span>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Status *</span>
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as Goat["status"])
          }
        >
          <option>Active</option>
          <option>Quarantine</option>
          <option>Sold</option>
          <option>Deceased</option>
        </select>
      </label>

      <label className="field">
        <span>Source *</span>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Supplier / Farm born"
        />
      </label>

      {!goat && (
        <label className="field">
          <span>RFID (optional)</span>
          <input
            value={rfid}
            onChange={(e) => setRfid(e.target.value)}
            placeholder="RFID"
          />
        </label>
      )}

      <label className="field">
        <span>Purchase Date</span>
        <input
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Purchase Price</span>
        <input
          type="number"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="₹"
        />
      </label>

      <label className="field">
        <span>Pen</span>
        <input
          value={pen}
          onChange={(e) => setPen(e.target.value)}
          placeholder="P-01"
        />
      </label>

      <label className="field">
        <span>Health Status</span>
        <input
          value={healthStatus}
          onChange={(e) => setHealthStatus(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Target ADG (g/day)</span>
        <input
          type="number"
          value={targetAdg}
          onChange={(e) => setTargetAdg(e.target.value)}
          placeholder="80"
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </label>

      <button
        onClick={submit}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
      >
        {goat ? "Save Changes" : "Create Goat"}
      </button>
    </ModalShell>
  );
}

function WeightScreen({
  state,
  goat,
  onBack,
  onAddWeight,
}: {
  state: FarmState;
  goat: Goat;
  onBack: () => void;
  onAddWeight: () => void;
}) {
  const history = getGoatWeights(state, goat.id);
  const calc = calculateWeight(state, goat);

  return (
    <section className="space-y-5">
      <PageHeader title="Weight & Growth" onBack={onBack} />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="font-semibold">{goat.name}</div>
        <div className="font-mono text-xs text-emerald-400">
          {goat.id}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            label="Current"
            value={
              calc.current
                ? `${calc.current.weightKg.toFixed(1)} kg`
                : "—"
            }
          />

          <Metric
            label="Gain"
            value={
              calc.gainKg != null
                ? `${calc.gainKg.toFixed(1)} kg`
                : "—"
            }
          />

          <Metric
            label="ADG"
            value={
              calc.adgGPerDay != null
                ? `${calc.adgGPerDay.toFixed(0)} g/day`
                : "—"
            }
          />

          <Metric
            label="Status"
            value={calc.growthStatus}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Weight History</h2>

          <button
            onClick={onAddWeight}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Add Weight
          </button>
        </div>

        <div className="space-y-2">
          {history
            .slice()
            .reverse()
            .map((record, index) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-xl border border-white/10 p-4"
              >
                <div>
                  <div className="text-sm text-slate-400">
                    {record.date}
                  </div>

                  {index === 0 && (
                    <div className="mt-1 text-xs text-emerald-400">
                      Latest
                    </div>
                  )}
                </div>

                <div className="text-lg font-semibold">
                  {record.weightKg.toFixed(1)} kg
                </div>
              </div>
            ))}

          {!history.length && (
            <Empty message="No weight records yet." />
          )}
        </div>
      </div>
    </section>
  );
}

function WeightModal({
  goat,
  onClose,
  onSave,
}: {
  goat: Goat;
  onClose: () => void;
  onSave: (
    date: string,
    weight: number,
    notes?: string
  ) => void;
}) {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <ModalShell title="Add Weight" onClose={onClose}>
      <div className="mb-4 rounded-xl bg-slate-900 p-3">
        <div className="text-xs text-slate-500">GOAT</div>
        <div className="mt-1 font-semibold">{goat.name}</div>
        <div className="font-mono text-xs text-emerald-400">
          {goat.id}
        </div>
      </div>

      <label className="field">
        <span>Date *</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Weight (kg) *</span>
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="20.0"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </label>

      <button
        onClick={() => {
          const value = Number(weight);

          if (!date || !Number.isFinite(value) || value <= 0) {
            alert("Please enter a valid date and weight.");
            return;
          }

          onSave(date, value, notes.trim() || undefined);
        }}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
      >
        Save Weight
      </button>
    </ModalShell>
  );
}

function HealthScreen({
  goat,
  onBack,
}: {
  goat: Goat;
  onBack: () => void;
}) {
  return (
    <section className="space-y-5">
      <PageHeader title="Health" onBack={onBack} />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <HeartPulse className="text-emerald-400" />
          <div>
            <div className="font-semibold">{goat.name}</div>
            <div className="font-mono text-xs text-emerald-400">
              {goat.id}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Metric
            label="Current Health Status"
            value={goat.healthStatus}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
        Health module will be expanded in the next frozen layer.
      </div>
    </section>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 p-5 sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="rounded-xl border border-white/10 p-2"
      >
        <ArrowLeft size={19} />
      </button>

      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-900 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}