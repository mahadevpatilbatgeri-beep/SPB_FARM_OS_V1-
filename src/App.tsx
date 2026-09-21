import { useMemo, useState } from "react";
import {
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
} from "./domain";

type Screen =
  | "dashboard"
  | "search"
  | "goat"
  | "weight"
  | "health"
  | "rfid";

type Modal =
  | null
  | "add-goat"
  | "edit-goat"
  | "weight"
  | "assign-rfid"
  | "replace-rfid";

const nav = [
  {
    id: "dashboard" as Screen,
    label: "Home",
    icon: Home,
  },
  {
    id: "search" as Screen,
    label: "Goats",
    icon: Search,
  },
];

const replacementReasons = [
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
    () =>
      state.goats.find((goat) => goat.id === selectedGoatId) ?? null,
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
    setScreen("search");
  }

  function addGoat(goat: Goat, rfid?: string) {
    let next = {
      ...state,
      goats: [...state.goats, goat],
    };

    if (rfid) {
      const cleaned = rfid.trim();

      if (!cleaned) {
        setModal(null);
        commit(next);
        return;
      }

      if (isRfidActive(next, cleaned)) {
        alert("This RFID is already actively assigned to another goat.");
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      next = {
        ...next,
        goats: next.goats.map((item) =>
          item.id === goat.id
            ? {
                ...item,
                rfid: cleaned,
              }
            : item
        ),
        rfidAssignments: [
          ...next.rfidAssignments,
          {
            id: uid("rfid"),
            goatId: goat.id,
            rfid: cleaned,
            status: "ACTIVE",
            assignedDate: today,
          },
        ],
        rfidAudit: [
          ...next.rfidAudit,
          {
            id: uid("audit"),
            action: "RFID_ASSIGNED",
            goatId: goat.id,
            newRfid: cleaned,
            date: today,
            reason: "Initial RFID assignment",
            performedBy: "SPB FARM OS",
          },
        ],
      };
    }

    commit(next);
    setModal(null);
    setSelectedGoatId(goat.id);
    setScreen("goat");
  }

  function editGoat(updated: Goat) {
    const next: FarmState = {
      ...state,
      goats: state.goats.map((goat) =>
        goat.id === updated.id
          ? {
              ...updated,
              rfid: goat.rfid,
            }
          : goat
      ),
    };

    commit(next);
    setModal(null);
  }

  function addWeight(
    date: string,
    weightKg: number,
    _notes?: string
  ) {
    if (!selectedGoat) return;

    const duplicate = state.weights.some(
      (record) =>
        record.goatId === selectedGoat.id &&
        record.date === date
    );

    if (duplicate) {
      alert(
        "A weight record already exists for this goat on this date. Please use a different date."
      );
      return;
    }

    const next: FarmState = {
      ...state,
      weights: [
        ...state.weights,
        {
          id: uid("weight"),
          goatId: selectedGoat.id,
          date,
          weightKg,
        },
      ],
    };

    commit(next);
    setModal(null);
  }

  function assignRfid(rfid: string, date: string) {
    if (!selectedGoat) return;

    const cleaned = rfid.trim();

    if (!cleaned) {
      alert("Please enter an RFID.");
      return;
    }

    if (isRfidActive(state, cleaned)) {
      alert("This RFID is already actively assigned to another goat.");
      return;
    }

    const next: FarmState = {
      ...state,
      goats: state.goats.map((goat) =>
        goat.id === selectedGoat.id
          ? {
              ...goat,
              rfid: cleaned,
            }
          : goat
      ),
      rfidAssignments: [
        ...state.rfidAssignments,
        {
          id: uid("rfid"),
          goatId: selectedGoat.id,
          rfid: cleaned,
          status: "ACTIVE",
          assignedDate: date,
        },
      ],
      rfidAudit: [
        ...state.rfidAudit,
        {
          id: uid("audit"),
          action: "RFID_ASSIGNED",
          goatId: selectedGoat.id,
          newRfid: cleaned,
          date,
          reason: "RFID assigned",
          performedBy: "SPB FARM OS",
        },
      ],
    };

    commit(next);
    setModal(null);
  }

  function replaceRfid(
    newRfid: string,
    date: string,
    reason: string,
    notes?: string
  ) {
    if (!selectedGoat) return;

    const cleaned = newRfid.trim();

    if (!cleaned) {
      alert("Please enter the new RFID.");
      return;
    }

    if (!reason) {
      alert("Please select a replacement reason.");
      return;
    }

    if (reason === "Other" && !notes?.trim()) {
      alert("Please enter notes when the reason is Other.");
      return;
    }

    if (isRfidActive(state, cleaned)) {
      alert(
        "This RFID is already actively assigned to another goat."
      );
      return;
    }

    const oldRfid = getActiveRfid(state, selectedGoat.id);

    if (!oldRfid) {
      alert(
        "This goat does not have an active RFID. Use Assign RFID instead."
      );
      return;
    }

    const next: FarmState = {
      ...state,

      goats: state.goats.map((goat) =>
        goat.id === selectedGoat.id
          ? {
              ...goat,
              rfid: cleaned,
            }
          : goat
      ),

      rfidAssignments: state.rfidAssignments.map(
        (assignment) =>
          assignment.goatId === selectedGoat.id &&
          assignment.status === "ACTIVE"
            ? {
                ...assignment,
                status: "REPLACED",
                replacedDate: date,
                replacementReason: reason,
                notes: notes?.trim() || undefined,
              }
            : assignment
      ).concat({
        id: uid("rfid"),
        goatId: selectedGoat.id,
        rfid: cleaned,
        status: "ACTIVE",
        assignedDate: date,
      }),

      rfidAudit: [
        ...state.rfidAudit,
        {
          id: uid("audit"),
          action: "RFID_REPLACED",
          goatId: selectedGoat.id,
          oldRfid,
          newRfid: cleaned,
          date,
          reason,
          performedBy: "SPB FARM OS",
          notes: notes?.trim() || undefined,
        },
      ],
    };

    commit(next);
    setModal(null);
  }

  const filteredGoats = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return state.goats;

    return state.goats.filter((goat) => {
      const activeRfid =
        getActiveRfid(state, goat.id) ?? goat.rfid ?? "";

      return [
        goat.id,
        goat.name,
        goat.breed,
        goat.sex,
        goat.status,
        activeRfid,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [state, search]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto min-h-screen max-w-6xl">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <PawPrint
                  size={22}
                  className="text-emerald-400"
                />
                <h1 className="text-lg font-bold">
                  SPB FARM OS
                </h1>
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Goat Farm Management System
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              V1.1
            </div>
          </div>
        </header>

        <main className="px-4 py-5 pb-28">
          {screen === "dashboard" && (
            <Dashboard
              state={state}
              onSearch={() => setScreen("search")}
              onAddGoat={() => setModal("add-goat")}
              onOpenGoat={openGoat}
            />
          )}

          {screen === "search" && (
            <SearchScreen
              state={state}
              search={search}
              setSearch={setSearch}
              goats={filteredGoats}
              onBack={() => setScreen("dashboard")}
              onOpenGoat={openGoat}
              onAddGoat={() => setModal("add-goat")}
            />
          )}

          {screen === "goat" && selectedGoat && (
            <Goat360
              state={state}
              goat={selectedGoat}
              onBack={back}
              onWeight={() => setModal("weight")}
              onWeightHistory={() => setScreen("weight")}
              onEdit={() => setModal("edit-goat")}
              onAssignRfid={() => setModal("assign-rfid")}
              onReplaceRfid={() => setModal("replace-rfid")}
              onHealth={() => setScreen("health")}
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
            <HealthScreen
              goat={selectedGoat}
              onBack={back}
            />
          )}

          {screen === "rfid" && selectedGoat && (
            <Goat360
              state={state}
              goat={selectedGoat}
              onBack={back}
              onWeight={() => setModal("weight")}
              onWeightHistory={() => setScreen("weight")}
              onEdit={() => setModal("edit-goat")}
              onAssignRfid={() => setModal("assign-rfid")}
              onReplaceRfid={() => setModal("replace-rfid")}
              onHealth={() => setScreen("health")}
            />
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-around">
            {nav.map((item) => {
              const Icon = item.icon;
              const active =
                screen === item.id ||
                (item.id === "search" &&
                  ["goat", "weight", "health"].includes(screen));

              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex min-w-24 flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs ${
                    active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  <Icon size={19} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {modal === "add-goat" && (
        <GoatForm
          title="Add Goat"
          state={state}
          onClose={() => setModal(null)}
          onSave={addGoat}
        />
      )}

      {modal === "edit-goat" && selectedGoat && (
        <GoatForm
          title="Edit Goat"
          state={state}
          goat={selectedGoat}
          onClose={() => setModal(null)}
          onSave={(updated) => editGoat(updated)}
        />
      )}

      {modal === "weight" && selectedGoat && (
        <WeightModal
          goat={selectedGoat}
          onClose={() => setModal(null)}
          onSave={addWeight}
        />
      )}

      {modal === "assign-rfid" && selectedGoat && (
        <RfidModal
          mode="assign"
          goat={selectedGoat}
          onClose={() => setModal(null)}
          onAssign={assignRfid}
          onReplace={replaceRfid}
        />
      )}

      {modal === "replace-rfid" && selectedGoat && (
        <RfidModal
          mode="replace"
          goat={selectedGoat}
          onClose={() => setModal(null)}
          onAssign={assignRfid}
          onReplace={replaceRfid}
        />
      )}
    </div>
  );
}

function Dashboard({
  state,
  onSearch,
  onAddGoat,
  onOpenGoat,
}: {
  state: FarmState;
  onSearch: () => void;
  onAddGoat: () => void;
  onOpenGoat: (goatId: string) => void;
}) {
  const active = state.goats.filter(
    (goat) => goat.status === "Active"
  );

  const females = state.goats.filter(
    (goat) => goat.sex === "Female"
  );

  const males = state.goats.filter(
    (goat) => goat.sex === "Male"
  );

  const rfidCount = state.rfidAssignments.filter(
    (item) => item.status === "ACTIVE"
  ).length;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-emerald-400">
              Welcome to
            </div>

            <h2 className="mt-1 text-3xl font-bold">
              SPB FARM OS
            </h2>

            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Enter data once → calculations → intelligence →
              action.
            </p>
          </div>

          <ShieldCheck
            size={30}
            className="text-emerald-400"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onSearch}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
          >
            <Search size={18} />
            Search Goats
          </button>

          <button
            onClick={onAddGoat}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 font-semibold"
          >
            <CirclePlus size={18} />
            Add Goat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total Goats" value={state.goats.length} />
        <Kpi label="Active" value={active.length} />
        <Kpi label="Females" value={females.length} />
        <Kpi label="Males" value={males.length} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label="Active RFID"
          value={rfidCount}
        />

        <Kpi
          label="Weight Records"
          value={state.weights.length}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            Recent Goats
          </h2>

          <button
            onClick={onSearch}
            className="text-sm text-emerald-400"
          >
            View all
          </button>
        </div>

        <div className="space-y-2">
          {state.goats.slice(0, 5).map((goat) => (
            <GoatCard
              key={goat.id}
              state={state}
              goat={goat}
              onClick={() => onOpenGoat(goat.id)}
            />
          ))}

          {!state.goats.length && (
            <Empty message="No goats found." />
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-bold">
        {value}
      </div>
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
  const activeRfid =
    getActiveRfid(state, goat.id) ?? goat.rfid;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left"
    >
      <div className="min-w-0">
        <div className="font-semibold">
          {goat.name}
        </div>

        <div className="mt-1 font-mono text-xs text-emerald-400">
          {goat.id}
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>{goat.sex}</span>
          <span>•</span>
          <span>{goat.breed}</span>
          {activeRfid && (
            <>
              <span>•</span>
              <span>{activeRfid}</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight
        size={19}
        className="shrink-0 text-slate-500"
      />
    </button>
  );
}

function SearchScreen({
  state,
  search,
  setSearch,
  goats,
  onBack,
  onOpenGoat,
  onAddGoat,
}: {
  state: FarmState;
  search: string;
  setSearch: (value: string) => void;
  goats: Goat[];
  onBack: () => void;
  onOpenGoat: (goatId: string) => void;
  onAddGoat: () => void;
}) {
  return (
    <section className="space-y-5">
      <PageHeader
        title="Goat Search"
        onBack={onBack}
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Goat ID, name, RFID, breed..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 outline-none focus:border-emerald-500/50"
          />
        </div>

        <button
          onClick={onAddGoat}
          className="rounded-2xl bg-emerald-500 px-4 font-semibold text-slate-950"
        >
          <CirclePlus size={20} />
        </button>
      </div>

      <div className="text-xs text-slate-500">
        {goats.length} goat{goats.length === 1 ? "" : "s"} found
      </div>

      <div className="space-y-2">
        {goats.map((goat) => (
          <GoatCard
            key={goat.id}
            state={state}
            goat={goat}
            onClick={() => onOpenGoat(goat.id)}
          />
        ))}

        {!goats.length && (
          <Empty message="No goats match your search." />
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
  onWeightHistory,
  onEdit,
  onAssignRfid,
  onReplaceRfid,
  onHealth,
}: {
  state: FarmState;
  goat: Goat;
  onBack: () => void;
  onWeight: () => void;
  onWeightHistory: () => void;
  onEdit: () => void;
  onAssignRfid: () => void;
  onReplaceRfid: () => void;
  onHealth: () => void;
}) {
  const calc = calculateWeight(state, goat);
  const activeRfid = getActiveRfid(state, goat.id);
  const rfidHistory = getGoatRfidHistory(state, goat.id);
  const weights = getGoatWeights(state, goat.id);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Goat 360°"
        onBack={onBack}
      />

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">
              PERMANENT GOAT ID
            </div>

            <div className="mt-1 font-mono text-lg font-semibold text-emerald-400">
              {goat.id}
            </div>

            <div className="mt-3 text-2xl font-bold">
              {goat.name}
            </div>

            <div className="mt-1 text-sm text-slate-400">
              {goat.breed}
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 p-3">
            <PawPrint
              size={25}
              className="text-emerald-400"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Info label="Sex" value={goat.sex} />
          <Info label="Status" value={goat.status} />
          <Info label="Age" value={ageText(goat.dob)} />
          <Info
            label="Health"
            value={goat.healthStatus}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label="Current Weight"
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
          label="Target ADG"
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

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onWeight}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
        >
          <Weight size={18} />
          Add Weight
        </button>

        <button
          onClick={onHealth}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 font-semibold"
        >
          <HeartPulse size={18} />
          Health
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio
              size={19}
              className="text-emerald-400"
            />
            <h2 className="font-semibold">
              RFID Identity
            </h2>
          </div>

          <ShieldCheck
            size={18}
            className="text-emerald-400"
          />
        </div>

        <div className="rounded-xl bg-slate-900 p-4">
          <div className="text-xs text-slate-500">
            ACTIVE RFID
          </div>

          <div className="mt-1 font-mono text-emerald-400">
            {activeRfid ?? "Not assigned"}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onAssignRfid}
            className="rounded-xl border border-white/10 px-3 py-3 text-sm"
          >
            Assign RFID
          </button>

          <button
            onClick={onReplaceRfid}
            disabled={!activeRfid}
            className="rounded-xl border border-white/10 px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Replace RFID
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          RFID can change. Goat ID never changes.
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            Identity & Details
          </h2>

          <button
            onClick={onEdit}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm"
          >
            Edit Goat
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Info label="Breed" value={goat.breed} />
          <Info label="DOB" value={goat.dob} />
          <Info label="Source" value={goat.source} />
          <Info
            label="Pen"
            value={goat.pen ?? "Not assigned"}
          />
          <Info
            label="Purchase Date"
            value={goat.purchaseDate ?? "—"}
          />
          <Info
            label="Purchase Price"
            value={
              goat.purchasePrice != null
                ? `₹${goat.purchasePrice}`
                : "—"
            }
          />
          <Info
            label="Target ADG"
            value={
              goat.targetAdgGPerDay != null
                ? `${goat.targetAdgGPerDay} g/day`
                : "—"
            }
          />
        </div>

        {goat.notes && (
          <div className="mt-4 rounded-xl bg-slate-900 p-3 text-sm text-slate-400">
            {goat.notes}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Weight & Growth
          </h2>

          <span className="text-xs text-slate-500">
            {weights.length} record
            {weights.length === 1 ? "" : "s"}
          </span>
        </div>

        <button
          onClick={onWeightHistory}
          className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm"
        >
          Weight History
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">
          RFID History
        </h2>

        <div className="mt-4 space-y-2">
          {rfidHistory
            .slice()
            .reverse()
            .map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm">
                    {item.rfid}
                  </div>

                  <div
                    className={`text-xs ${
                      item.status === "ACTIVE"
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  >
                    {item.status}
                  </div>
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Assigned: {item.assignedDate}
                </div>

                {item.replacedDate && (
                  <div className="mt-1 text-xs text-slate-500">
                    Replaced: {item.replacedDate}
                  </div>
                )}

                {item.replacementReason && (
                  <div className="mt-1 text-xs text-slate-500">
                    Reason: {item.replacementReason}
                  </div>
                )}
              </div>
            ))}

          {!rfidHistory.length && (
            <Empty message="No RFID history." />
          )}
        </div>
      </div>
    </section>
  );
}

function RfidModal({
  mode,
  goat,
  onClose,
  onAssign,
  onReplace,
}: {
  mode: "assign" | "replace";
  goat: Goat;
  onClose: () => void;
  onAssign: (rfid: string, date: string) => void;
  onReplace: (
    rfid: string,
    date: string,
    reason: string,
    notes?: string
  ) => void;
}) {
  const [rfid, setRfid] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!rfid.trim()) {
      alert("Please enter an RFID.");
      return;
    }

    if (!date) {
      alert("Please select a valid date.");
      return;
    }

    if (mode === "assign") {
      onAssign(rfid, date);
    } else {
      onReplace(
        rfid,
        date,
        reason,
        notes.trim() || undefined
      );
    }
  }

  return (
    <ModalShell
      title={mode === "assign" ? "Assign RFID" : "Replace RFID"}
      onClose={onClose}
    >
      <div className="rounded-xl bg-slate-900 p-3">
        <div className="text-xs text-slate-500">
          GOAT
        </div>

        <div className="mt-1 font-semibold">
          {goat.name}
        </div>

        <div className="font-mono text-xs text-emerald-400">
          {goat.id}
        </div>
      </div>

      <label className="field">
        <span>RFID *</span>

        <input
          value={rfid}
          onChange={(e) => setRfid(e.target.value)}
          placeholder="Enter RFID"
          autoFocus
        />
      </label>

      <label className="field">
        <span>
          {mode === "assign"
            ? "Assignment Date *"
            : "Replacement Date *"}
        </span>

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
              <option value="">
                Select reason
              </option>

              {replacementReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              {reason === "Other"
                ? "Notes *"
                : "Notes"}
            </span>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes"
            />
          </label>
        </>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
        RFID is replaceable electronic identity.
        The permanent Goat ID will not change.
      </div>

      <button
        onClick={submit}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
      >
        {mode === "assign"
          ? "Assign RFID"
          : "Replace RFID"}
      </button>
    </ModalShell>
  );
}

function GoatForm({
  title,
  state,
  goat,
  onClose,
  onSave,
}: {
  title: string;
  state: FarmState;
  goat?: Goat;
  onClose: () => void;
  onSave: (goat: Goat, rfid?: string) => void;
}) {
  const [name, setName] = useState(
    goat?.name ?? ""
  );

  const [sex, setSex] = useState<Goat["sex"]>(
    goat?.sex ?? "Female"
  );

  const [breed, setBreed] = useState(
    goat?.breed ?? ""
  );

  const [dob, setDob] = useState(
    goat?.dob ?? ""
  );

  const [status, setStatus] =
    useState<Goat["status"]>(
      goat?.status ?? "Active"
    );

  const [source, setSource] = useState(
    goat?.source ?? ""
  );

  const [purchaseDate, setPurchaseDate] =
    useState(goat?.purchaseDate ?? "");

  const [purchasePrice, setPurchasePrice] =
    useState(
      goat?.purchasePrice?.toString() ?? ""
    );

  const [pen, setPen] = useState(
    goat?.pen ?? ""
  );

  const [healthStatus, setHealthStatus] =
    useState(
      goat?.healthStatus ?? "Healthy"
    );

  const [targetAdg, setTargetAdg] =
    useState(
      goat?.targetAdgGPerDay?.toString() ?? ""
    );

  const [rfid, setRfid] = useState(
    goat?.rfid ?? ""
  );

  const [notes, setNotes] = useState(
    goat?.notes ?? ""
  );

  function submit() {
    if (
      !name.trim() ||
      !breed.trim() ||
      !dob ||
      !source.trim()
    ) {
      alert(
        "Please complete all required fields."
      );
      return;
    }

    const nextGoat: Goat = {
      id:
        goat?.id ??
        generateGoatId(
          state.goats,
          sex,
          new Date(dob).getFullYear()
        ),
      name: name.trim(),
      breed: breed.trim(),
      sex,
      dob,
      status,
      source: source.trim(),
      purchaseDate:
        purchaseDate || undefined,
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
      onSave(
        nextGoat,
        rfid.trim() || undefined
      );
    } else {
      onSave(nextGoat);
    }
  }

  return (
    <ModalShell
      title={title}
      onClose={onClose}
    >
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
          onChange={(e) =>
            setName(e.target.value)
          }
          placeholder="Goat name"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Sex *</span>

        <select
          value={sex}
          onChange={(e) =>
            setSex(
              e.target.value as Goat["sex"]
            )
          }
        >
          <option value="Female">
            Female
          </option>

          <option value="Male">
            Male
          </option>
        </select>
      </label>

      <label className="field">
        <span>Breed *</span>

        <input
          value={breed}
          onChange={(e) =>
            setBreed(e.target.value)
          }
          placeholder="Osmanabadi × Boer"
        />
      </label>

      <label className="field">
        <span>Date of Birth *</span>

        <input
          type="date"
          value={dob}
          onChange={(e) =>
            setDob(e.target.value)
          }
        />
      </label>

      <label className="field">
        <span>Status *</span>

        <select
          value={status}
          onChange={(e) =>
            setStatus(
              e.target.value as Goat["status"]
            )
          }
        >
          <option value="Active">
            Active
          </option>

          <option value="Quarantine">
            Quarantine
          </option>

          <option value="Sold">
            Sold
          </option>

          <option value="Deceased">
            Deceased
          </option>
        </select>
      </label>

      <label className="field">
        <span>Source *</span>

        <input
          value={source}
          onChange={(e) =>
            setSource(e.target.value)
          }
          placeholder="Supplier / Farm born"
        />
      </label>

      {!goat && (
        <label className="field">
          <span>RFID (optional)</span>

          <input
            value={rfid}
            onChange={(e) =>
              setRfid(e.target.value)
            }
            placeholder="RFID"
          />
        </label>
      )}

      <label className="field">
        <span>Purchase Date</span>

        <input
          type="date"
          value={purchaseDate}
          onChange={(e) =>
            setPurchaseDate(e.target.value)
          }
        />
      </label>

      <label className="field">
        <span>Purchase Price</span>

        <input
          type="number"
          value={purchasePrice}
          onChange={(e) =>
            setPurchasePrice(e.target.value)
          }
          placeholder="₹"
        />
      </label>

      <label className="field">
        <span>Pen</span>

        <input
          value={pen}
          onChange={(e) =>
            setPen(e.target.value)
          }
          placeholder="P-01"
        />
      </label>

      <label className="field">
        <span>Health Status</span>

        <input
          value={healthStatus}
          onChange={(e) =>
            setHealthStatus(e.target.value)
          }
        />
      </label>

      <label className="field">
        <span>Target ADG (g/day)</span>

        <input
          type="number"
          value={targetAdg}
          onChange={(e) =>
            setTargetAdg(e.target.value)
          }
          placeholder="80"
        />
      </label>

      <label className="field">
        <span>Notes</span>

        <textarea
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
          rows={3}
        />
      </label>

      <button
        onClick={submit}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950"
      >
        {goat
          ? "Save Changes"
          : "Create Goat"}
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
  const history = getGoatWeights(
    state,
    goat.id
  );

  const calc = calculateWeight(
    state,
    goat
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="Weight & Growth"
        onBack={onBack}
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="font-semibold">
          {goat.name}
        </div>

        <div className="font-mono text-xs text-emerald-400">
          {goat.id}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            label="Current"
            value={
              calc.current
                ? `${calc.current.weightKg.toFixed(
                    1
                  )} kg`
                : "—"
            }
          />

          <Metric
            label="Gain"
            value={
              calc.gainKg != null
                ? `${calc.gainKg.toFixed(
                    1
                  )} kg`
                : "—"
            }
          />

          <Metric
            label="ADG"
            value={
              calc.adgGPerDay != null
                ? `${calc.adgGPerDay.toFixed(
                    0
                  )} g/day`
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
          <h2 className="font-semibold">
            Weight History
          </h2>

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
                  {record.weightKg.toFixed(
                    1
                  )}{" "}
                  kg
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
    new Date()
      .toISOString()
      .slice(0, 10)
  );

  const [weight, setWeight] =
    useState("");

  const [notes, setNotes] =
    useState("");

  return (
    <ModalShell
      title="Add Weight"
      onClose={onClose}
    >
      <div className="mb-4 rounded-xl bg-slate-900 p-3">
        <div className="text-xs text-slate-500">
          GOAT
        </div>

        <div className="mt-1 font-semibold">
          {goat.name}
        </div>

        <div className="font-mono text-xs text-emerald-400">
          {goat.id}
        </div>
      </div>

      <label className="field">
        <span>Date *</span>

        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(e.target.value)
          }
        />
      </label>

      <label className="field">
        <span>Weight (kg) *</span>

        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) =>
            setWeight(e.target.value)
          }
          placeholder="20.0"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Notes</span>

        <textarea
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
          rows={3}
          placeholder="Optional"
        />
      </label>

      <button
        onClick={() => {
          const value = Number(weight);

          if (
            !date ||
            !Number.isFinite(value) ||
            value <= 0
          ) {
            alert(
              "Please enter a valid date and weight."
            );
            return;
          }

          onSave(
            date,
            value,
            notes.trim() || undefined
          );
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
      <PageHeader
        title="Health"
        onBack={onBack}
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <HeartPulse className="text-emerald-400" />

          <div>
            <div className="font-semibold">
              {goat.name}
            </div>

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
        Health module will be expanded in the
        next frozen layer.
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
          <h2 className="text-xl font-bold">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {children}
        </div>
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

      <h1 className="text-2xl font-bold">
        {title}
      </h1>
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
      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-1 truncate text-sm">
        {value}
      </div>
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
      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function Empty({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}