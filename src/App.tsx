import { useMemo, useState } from "react";
import {
  Activity, ArrowLeft, BarChart3, Bell, ChevronRight, CirclePlus,
  Download, HeartPulse, Home, PawPrint, Radio, Search, Settings,
  ShieldCheck, Trash2, Upload, Weight, X
} from "lucide-react";
import {
  ageText, calculateWeight, FarmState, getGoatWeights, Goat, loadState,
  saveState, uid, WeightCalculation
} from "./domain";

type Screen = "dashboard" | "search" | "goat" | "weight";

const nav = [
  ["dashboard", "Dashboard", Home],
  ["search", "RFID / Search", Radio],
  ["weight", "Weight & Growth", Weight],
] as const;

function App() {
  const [state, setState] = useState<FarmState>(() => loadState());
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [weightOpen, setWeightOpen] = useState(false);

  const persist = (next: FarmState) => {
    setState(next);
    saveState(next);
  };

  const selected = state.goats.find((g) => g.id === selectedId) ?? null;

  const openGoat = (id: string) => {
    setSelectedId(id);
    setScreen("goat");
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FarmState;
        if (!parsed.goats || !parsed.weights) throw new Error("Invalid SPB backup");
        persist(parsed);
        alert("SPB backup imported successfully.");
      } catch {
        alert("That file is not a valid SPB Farm OS backup.");
      }
    };
    reader.readAsText(file);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SPB_FARM_OS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetTest = () => {
    if (!confirm("Reset SPB Farm OS to the original TEST data?")) return;
    const fresh = loadFresh();
    persist(fresh);
    setSelectedId(null);
    setScreen("dashboard");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.goats;
    return state.goats.filter((g) =>
      [g.id, g.name, g.rfid, g.breed, g.pen].some((v) => v?.toLowerCase().includes(q))
    );
  }, [query, state.goats]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><PawPrint size={22} /></div>
          <div>
            <strong>SPB FARM OS</strong>
            <span>Goat Farm Command Center</span>
          </div>
        </div>
        <div className="top-actions">
          <span className="test-badge"><ShieldCheck size={14} /> TEST MODE</span>
          <button className="icon-btn" title="Settings" onClick={() => setScreen("dashboard")}><Settings size={19}/></button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={screen === id ? "nav-item active" : "nav-item"} onClick={() => setScreen(id)}>
              <Icon size={19}/><span>{label}</span>
            </button>
          ))}
          <div className="side-spacer" />
          <div className="side-note">
            <span>Local-first</span>
            <small>Your farm data stays in this browser.</small>
          </div>
        </aside>

        <main className="main">
          {screen === "dashboard" && (
            <Dashboard state={state} openGoat={openGoat} setScreen={setScreen} />
          )}
          {screen === "search" && (
            <SearchScreen state={state} query={query} setQuery={setQuery} openGoat={openGoat} />
          )}
          {screen === "goat" && selected && (
            <Goat360 goat={selected} state={state} back={() => setScreen("search")} addWeight={() => setWeightOpen(true)} />
          )}
          {screen === "weight" && (
            <WeightScreen state={state} openGoat={openGoat} />
          )}
          {!selected && screen === "goat" && (
            <Empty title="Goat not selected" text="Search for a goat and open its 360° profile." action={() => setScreen("search")} />
          )}
        </main>
      </div>

      <nav className="bottom-nav">
        {nav.map(([id, label, Icon]) => (
          <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>
            <Icon size={20}/><span>{label}</span>
          </button>
        ))}
      </nav>

      {selected && weightOpen && (
        <WeightModal
          goat={selected}
          state={state}
          close={() => setWeightOpen(false)}
          save={(record) => {
            persist({ ...state, weights: [...state.weights, record] });
            setWeightOpen(false);
          }}
        />
      )}
    </div>
  );
}

function loadFresh() {
  localStorage.removeItem("spb-farm-os-v1");
  return loadState();
}

function Dashboard({ state, openGoat, setScreen }: { state: FarmState; openGoat: (id: string) => void; setScreen: (s: Screen) => void }) {
  const females = state.goats.filter(g => g.sex === "Female").length;
  const males = state.goats.filter(g => g.sex === "Male").length;
  const quarantine = state.goats.filter(g => g.status === "Quarantine").length;
  const below = state.goats.filter(g => calculateWeight(state, g).growthStatus === "Below Target");

  return (
    <>
      <PageHeader title="Good day, Mahadev 👋" subtitle="Here’s your farm at a glance." />
      <div className="hero-search" onClick={() => setScreen("search")}>
        <Search size={21}/>
        <span>Search Goat ID, RFID or name…</span>
        <ChevronRight size={20}/>
      </div>
      <section className="kpis">
        <Kpi label="Does / Females" value={females} icon={PawPrint} />
        <Kpi label="Bucks / Males" value={males} icon={PawPrint} />
        <Kpi label="Quarantine" value={quarantine} icon={ShieldCheck} />
        <Kpi label="Grand Total" value={state.goats.length} icon={BarChart3} />
      </section>

      <div className="section-head"><div><h2>Needs attention</h2><p>Items surfaced from real farm calculations.</p></div><Bell size={19}/></div>
      {below.length ? below.map(g => {
        const c = calculateWeight(state, g);
        return <div className="attention" key={g.id} onClick={() => openGoat(g.id)}>
          <div className="attention-icon"><Activity size={20}/></div>
          <div><strong>{g.name} · {g.id}</strong><span>Growth is below target · {Math.round(c.adgGPerDay ?? 0)} g/day</span></div>
          <ChevronRight size={18}/>
        </div>
      }) : <div className="empty-card"><ShieldCheck size={22}/><span>No current below-target growth alerts.</span></div>}

      <div className="section-head"><div><h2>Herd</h2><p>Open a goat’s 360° profile.</p></div><button className="link-btn" onClick={() => setScreen("search")}>View all</button></div>
      <div className="goat-grid">
        {state.goats.map(g => <GoatCard key={g.id} goat={g} state={state} open={() => openGoat(g.id)} />)}
      </div>
    </>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: number; icon: typeof PawPrint }) {
  return <div className="kpi"><div className="kpi-icon"><Icon size={18}/></div><strong>{value}</strong><span>{label}</span></div>;
}

function GoatCard({ goat, state, open }: { goat: Goat; state: FarmState; open: () => void }) {
  const c = calculateWeight(state, goat);
  return <button className="goat-card" onClick={open}>
    <div className="avatar">{goat.sex === "Female" ? "♀" : "♂"}</div>
    <div className="goat-card-main"><strong>{goat.name}</strong><span>{goat.id}</span></div>
    <div className="card-weight">{c.current ? `${c.current.weightKg.toFixed(1)} kg` : "—"}<small>{c.growthStatus}</small></div>
    <ChevronRight size={18}/>
  </button>;
}

function SearchScreen({ state, query, setQuery, openGoat }: { state: FarmState; query: string; setQuery: (v: string) => void; openGoat: (id: string) => void }) {
  const results = state.goats.filter(g => !query.trim() || [g.id, g.name, g.rfid, g.breed].some(v => v?.toLowerCase().includes(query.toLowerCase())));
  return <>
    <PageHeader title="RFID / Search" subtitle="Find any goat by permanent ID, RFID or name." />
    <div className="search-box"><Search size={20}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. TEST-RFID-000002 or Lakshmi" /></div>
    <div className="result-count">{results.length} goat{results.length === 1 ? "" : "s"} found</div>
    <div className="result-list">{results.map(g => <GoatCard key={g.id} goat={g} state={state} open={() => openGoat(g.id)} />)}</div>
  </>;
}

function Goat360({ goat, state, back, addWeight }: { goat: Goat; state: FarmState; back: () => void; addWeight: () => void }) {
  const c = calculateWeight(state, goat);
  const history = getGoatWeights(state, goat.id).slice().reverse();
  return <>
    <button className="back-btn" onClick={back}><ArrowLeft size={17}/> Back to search</button>
    <div className="profile-head">
      <div className="profile-avatar">{goat.sex === "Female" ? "♀" : "♂"}</div>
      <div><span className="eyebrow">Goat 360°</span><h1>{goat.name}</h1><p>{goat.id} · {goat.breed}</p></div>
      <span className="status">{goat.status}</span>
    </div>

    <div className="profile-actions"><button className="primary" onClick={addWeight}><CirclePlus size={18}/> Add Weight</button><button className="secondary"><HeartPulse size={18}/> Health</button></div>

    <div className="info-grid">
      <Info label="RFID" value={goat.rfid || "Not assigned"} icon={Radio}/>
      <Info label="Age" value={ageText(goat.dob)} icon={PawPrint}/>
      <Info label="Pen / Location" value={goat.pen || "Not assigned"} icon={Home}/>
      <Info label="Health" value={goat.healthStatus} icon={HeartPulse}/>
    </div>

    <section className="panel">
      <div className="panel-title"><div><h2>Weight & Growth</h2><p>Calculated from the weight history.</p></div><Weight size={21}/></div>
      <div className="metric-row">
        <Metric label="Current" value={c.current ? `${c.current.weightKg.toFixed(1)} kg` : "—"} />
        <Metric label="Previous" value={c.previous ? `${c.previous.weightKg.toFixed(1)} kg` : "—"} />
        <Metric label="Gain" value={c.gainKg == null ? "—" : `${c.gainKg >= 0 ? "+" : ""}${c.gainKg.toFixed(1)} kg`} />
        <Metric label="ADG" value={c.adgGPerDay == null ? "—" : `${Math.round(c.adgGPerDay)} g/day`} />
      </div>
      <div className={`growth-banner ${c.growthStatus.toLowerCase().replaceAll(" ", "-")}`}>
        <strong>{c.growthStatus}</strong>
        {c.targetAdgGPerDay != null && <span>Target: {c.targetAdgGPerDay} g/day</span>}
      </div>
      <div className="history">
        {history.map(w => <div className="history-row" key={w.id}><span>{w.date}</span><strong>{w.weightKg.toFixed(1)} kg</strong></div>)}
      </div>
    </section>

    <section className="panel">
      <div className="panel-title"><div><h2>Identity & Source</h2><p>Permanent farm identity information.</p></div><ShieldCheck size={21}/></div>
      <div className="detail-grid">
        <Info label="Sex" value={goat.sex}/><Info label="Date of birth" value={goat.dob}/>
        <Info label="Source" value={goat.source}/><Info label="Purchase date" value={goat.purchaseDate || "—"}/>
        <Info label="Purchase price" value={goat.purchasePrice ? `₹${goat.purchasePrice.toLocaleString("en-IN")}` : "—"}/>
      </div>
    </section>
  </>;
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Radio }) {
  return <div className="info"><small>{Icon && <Icon size={14}/>} {label}</small><strong>{value}</strong></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><small>{label}</small><strong>{value}</strong></div>;
}

function WeightScreen({ state, openGoat }: { state: FarmState; openGoat: (id: string) => void }) {
  return <>
    <PageHeader title="Weight & Growth" subtitle="One place for the herd's latest growth picture." />
    <div className="goat-grid">{state.goats.map(g => {
      const c = calculateWeight(state, g);
      return <button className="growth-card" key={g.id} onClick={() => openGoat(g.id)}>
        <div><strong>{g.name}</strong><span>{g.id}</span></div>
        <div className="growth-number">{c.current ? `${c.current.weightKg.toFixed(1)} kg` : "—"}</div>
        <div className="growth-meta">{c.adgGPerDay != null ? `${Math.round(c.adgGPerDay)} g/day` : "First weighing"} · {c.growthStatus}</div>
      </button>
    })}</div>
  </>;
}

function WeightModal({ goat, state, close, save }: { goat: Goat; state: FarmState; close: () => void; save: (r: { id: string; goatId: string; date: string; weightKg: number }) => void }) {
  const [date, setDate] = useState("2026-09-20");
  const [weight, setWeight] = useState("");
  const previous = getGoatWeights(state, goat.id).at(-1);
  const preview: WeightCalculation = previous && weight ? calculateWeight(
    { ...state, weights: [...state.weights, { id: "preview", goatId: goat.id, date, weightKg: Number(weight) }] },
    goat
  ) : { growthStatus: "No Target" };

  return <div className="modal-backdrop" onMouseDown={close}>
    <div className="modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">New weight</span><h2>{goat.name}</h2></div><button className="icon-btn" onClick={close}><X/></button></div>
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Current weight (kg)<input autoFocus type="number" step="0.1" min="0" value={weight} onChange={e => setWeight(e.target.value)} placeholder="20.0" /></label>
      {weight && <div className="preview-calc"><div><span>Previous</span><strong>{previous?.weightKg.toFixed(1) ?? "—"} kg</strong></div><div><span>Gain</span><strong>{preview.gainKg == null ? "—" : `${preview.gainKg >= 0 ? "+" : ""}${preview.gainKg.toFixed(1)} kg`}</strong></div><div><span>ADG</span><strong>{preview.adgGPerDay == null ? "—" : `${Math.round(preview.adgGPerDay)} g/day`}</strong></div></div>}
      <button className="primary full" disabled={!weight || Number(weight) <= 0} onClick={() => save({ id: uid("W"), goatId: goat.id, date, weightKg: Number(weight) })}>Save Weight</button>
    </div>
  </div>;
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-header"><div><span className="eyebrow">SPB FARM OS</span><h1>{title}</h1><p>{subtitle}</p></div></div>;
}
function Empty({ title, text, action }: { title: string; text: string; action: () => void }) {
  return <div className="empty-state"><PawPrint size={36}/><h2>{title}</h2><p>{text}</p><button className="primary" onClick={action}>Go to Search</button></div>;
}

export default App;