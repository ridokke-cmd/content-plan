import { useState, useEffect, useCallback, useRef } from "react";

// ── GOOGLE SHEETS CONFIG ──────────────────────────────────────────────────────
// Ganti APPS_SCRIPT_URL dengan URL dari Google Apps Script kamu
// Lihat SETUP_GUIDE.md untuk cara dapetin URL ini
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyP2aXegIBJK0_yZY9VDQYqNA9R2pEorKUfXhetJDVOi1fkjVZlCN8qh49BVngPSUYFkA/exec";

async function gsFetch(action, payload = {}) {
  try {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", action);
    if (action === "read") {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("fetch failed");
      return await res.json();
    } else {
      await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action, ...payload }),
        mode: "no-cors",
      });
      return { ok: true };
    }
  } catch (e) {
    console.warn("Sheets sync failed:", e.message);
    return null;
  }
}

// Fallback ke localStorage jika Sheets belum di-setup
function lsLoad(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const KEYS = { accounts: "cp_accounts", contents: "cp_contents", notebook: "cp_notebook", products: "cp_products" };

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = [
  { id: "ig", platform: "instagram", handle: "@youraccount", followerHistory: {}, totalViews: 0, color: "#E1306C", grad: "linear-gradient(135deg,#833AB4,#E1306C,#F77737)" },
  { id: "tt", platform: "tiktok", handle: "@youraccount", followerHistory: {}, totalViews: 0, color: "#69C9D0", grad: "linear-gradient(135deg,#010101,#69C9D0)" },
  { id: "yt", platform: "youtube", handle: "Your Channel", followerHistory: {}, totalViews: 0, color: "#FF0000", grad: "linear-gradient(135deg,#FF0000,#CC0000)" },
];
const PILLARS = ["Awareness", "Edukasi", "Entertain", "Inspirasi", "Promosi", "Engagement"];
const TYPES = ["Behind The Timeline", "60Second Edit", "Random"];
const TYPE_PREFIX = { "Behind The Timeline": "Behind The Timeline", "60Second Edit": "60Second Edit", "Random": "" };
const STATUSES = ["Pending", "Record", "Posted", "Deleted"];
const STATUS_COLORS = { Pending: "#EF4444", Record: "#F59E0B", Posted: "#22C55E", Deleted: "#6B7280" };
const STATUS_BG = { Pending: "rgba(239,68,68,0.18)", Record: "rgba(245,158,11,0.18)", Posted: "rgba(34,197,94,0.18)", Deleted: "rgba(107,114,128,0.18)" };
const MONTH_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const PLATFORMS = ["instagram", "tiktok", "youtube"];
const PILLAR_COLORS = { Awareness: "#38BDF8", Edukasi: "#34D399", Entertain: "#FBBF24", Inspirasi: "#A78BFA", Promosi: "#F472B6", Engagement: "#FB923C" };
const PRODUCT_STATUSES = ["Pending", "Released"];
const PRODUCT_STATUS_COLORS = { Pending: "#F59E0B", Released: "#22C55E" };
const PRODUCT_STATUS_BG = { Pending: "rgba(245,158,11,0.15)", Released: "rgba(34,197,94,0.15)" };

// ── SVG Platform Logos ────────────────────────────────────────────────────────
const PlatformLogo = ({ platform, size = 28 }) => {
  if (platform === "instagram") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs><radialGradient id="ig1" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" /><stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" /><stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient></defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig1)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
  if (platform === "tiktok") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#010101" />
      <path d="M16.5 7.2c-.8-.5-1.4-1.3-1.6-2.2h-2v9.5c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8.8-1.8 1.8-1.8c.2 0 .4 0 .5.1V10.6c-.2 0-.4-.1-.5-.1-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8 3.8-1.7 3.8-3.8V9.4c.8.5 1.7.8 2.6.8V8.1c-.3 0-1-.3-1-.9z" fill="#69C9D0" />
    </svg>
  );
  if (platform === "youtube") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#FF0000" />
      <path d="M19.5 8.5s-.2-1.3-.8-1.9c-.7-.8-1.5-.8-1.9-.8C14.6 5.6 12 5.6 12 5.6s-2.6 0-4.8.2c-.4 0-1.2 0-1.9.8-.6.6-.8 1.9-.8 1.9S4.3 10 4.3 11.5v1.4c0 1.5.2 3 .2 3s.2 1.3.8 1.9c.7.8 1.7.7 2.1.8C8.7 18.7 12 18.7 12 18.7s2.6 0 4.8-.3c.4 0 1.2 0 1.9-.8.6-.6.8-1.9.8-1.9s.2-1.5.2-3V11.5c0-1.5-.2-3-.2-3z" fill="white" />
      <path d="M10.5 14.5v-5l5 2.5-5 2.5z" fill="#FF0000" />
    </svg>
  );
  return null;
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const I = ({ n, s = 18, c = "currentColor" }) => {
  const P = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    dashboard: <svg {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>,
    plan: <svg {...P}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    calendar: <svg {...P}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    notebook: <svg {...P}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
    product: <svg {...P}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
    plus: <svg {...P} strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    edit: <svg {...P}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    trash: <svg {...P}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
    close: <svg {...P} strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    trophy: <svg {...P}><polyline points="8 21 12 17 16 21" /><line x1="12" y1="17" x2="12" y2="13" /><path d="M7 4h10l1 7H6L7 4z" /><path d="M6 11c-1.7 0-3 1.3-3 3s1.3 3 3 3" /><path d="M18 11c1.7 0 3 1.3 3 3s-1.3 3-3 3" /></svg>,
    chevL: <svg {...P} strokeWidth="2.2"><polyline points="15 18 9 12 15 6" /></svg>,
    chevR: <svg {...P} strokeWidth="2.2"><polyline points="9 18 15 12 9 6" /></svg>,
    save: <svg {...P}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
    menu: <svg {...P} strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    eye: <svg {...P}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    star: <svg {...P} fill={c} stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
    money: <svg {...P}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    box: <svg {...P}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
    chart: <svg {...P}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
    sync: <svg {...P}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
    check: <svg {...P} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
  };
  return icons[n] || null;
};

// ── PASSWORD GATE ─────────────────────────────────────────────────────────────
function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem("cs_auth") === "1");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const attempt = () => {
    if (pw === "Fitrah123") {
      localStorage.setItem("cs_auth", "1");
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 500);
    }
  };

  if (unlocked) return children;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#020816", fontFamily: "'Poppins',sans-serif", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#020816;height:100%;}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{ width: "100%", maxWidth: 380, animation: "fadeIn 0.4s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", background: "linear-gradient(90deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>Creator</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#E2EBF5", letterSpacing: "-1px" }}>Studio</div>
          <div style={{ fontSize: 12, color: "#1E3A5F", marginTop: 6, fontWeight: 500 }}>Masukkan password untuk lanjut</div>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(5,12,28,0.9)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 20, padding: 28, backdropFilter: "blur(20px)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", animation: shake ? "shake 0.5s ease" : "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2E4A6A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Password</div>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            placeholder="••••••••••"
            autoFocus
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", color: "#C8D6E8", border: `1px solid ${error ? "#EF4444" : "rgba(56,189,248,0.15)"}`, borderRadius: 10, padding: "12px 16px", fontFamily: "'Poppins',sans-serif", fontSize: 16, outline: "none", letterSpacing: "0.2em", marginBottom: error ? 8 : 16, transition: "border-color 0.2s", boxShadow: error ? "0 0 0 3px rgba(239,68,68,0.1)" : "none" }}
          />
          {error && <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>⚠ Password salah, coba lagi</div>}
          <button
            onClick={attempt}
            style={{ width: "100%", background: "linear-gradient(135deg,#0EA5E9,#6366F1)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Poppins',sans-serif", boxShadow: "0 4px 20px rgba(14,165,233,0.35)", transition: "all 0.18s" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            Masuk →
          </button>
        </div>

        {/* Glow blobs */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: -1 }}>
          <div style={{ position: "absolute", top: "20%", left: "10%", width: "40%", height: "40%", background: "radial-gradient(circle,rgba(14,165,233,0.1) 0%,transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: "20%", right: "10%", width: "40%", height: "40%", background: "radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)", borderRadius: "50%" }} />
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(true);
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [contents, setContents] = useState([]);
  const [notebook, setNotebook] = useState({ notes: [], plans: [] });
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | error
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const saveTimer = useRef(null);

  // ── LOAD from Sheets → fallback localStorage ──────────────────────────────
  useEffect(() => {
    (async () => {
      setSyncStatus("syncing");
      const remote = await gsFetch("read");
     if (remote && remote.contents !== undefined) {
        // Migrate old accounts that still use `followers` field
        const migratedAccounts = remote.accounts.map(a => {
          if (!a.followerHistory) {
            return { ...a, followerHistory: a.followers ? {} : {}, totalViews: a.totalViews || 0 };
          }
          return a;
        });
        setAccounts(migratedAccounts);
        setContents(remote.contents || []);
        setNotebook(remote.notebook || { notes: [], plans: [] });
        setProducts(remote.products || []);
        lsSave(KEYS.accounts, migratedAccounts);
        lsSave(KEYS.contents, remote.contents || []);
        lsSave(KEYS.notebook, remote.notebook || { notes: [], plans: [] });
        lsSave(KEYS.products, remote.products || []);
        setSyncStatus("ok");
      } else {
        // Sheets not configured yet, use localStorage
        const acc = lsLoad(KEYS.accounts);
        const con = lsLoad(KEYS.contents);
        const nb = lsLoad(KEYS.notebook);
        const pr = lsLoad(KEYS.products);
        if (acc) setAccounts(acc);
        if (con) setContents(con);
        if (nb) setNotebook(nb);
        if (pr) setProducts(pr);
        setSyncStatus(APPS_SCRIPT_URL.includes("YOUR_SCRIPT_ID") ? "not-configured" : "error");
      }
      setLoaded(true);
    })();
  }, []);

  // ── SAVE debounced – write to localStorage instantly, push to Sheets after 1.5s ──
  const persistAll = useCallback((acc, con, nb, pr) => {
    lsSave(KEYS.accounts, acc);
    lsSave(KEYS.contents, con);
    lsSave(KEYS.notebook, nb);
    lsSave(KEYS.products, pr);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (APPS_SCRIPT_URL.includes("YOUR_SCRIPT_ID")) return;
      setSyncStatus("syncing");
      const res = await gsFetch("write", { accounts: acc, contents: con, notebook: nb, products: pr });
      setSyncStatus(res ? "ok" : "error");
    }, 1500);
  }, []);

  const updateAccounts = useCallback(v => { setAccounts(v); persistAll(v, contents, notebook, products); }, [contents, notebook, products, persistAll]);
  const updateContents = useCallback(v => { setContents(v); persistAll(accounts, v, notebook, products); }, [accounts, notebook, products, persistAll]);
  const updateNotebook = useCallback(v => { setNotebook(v); persistAll(accounts, contents, v, products); }, [accounts, contents, products, persistAll]);
  const updateProducts = useCallback(v => { setProducts(v); persistAll(accounts, contents, notebook, v); }, [accounts, contents, notebook, persistAll]);

  const updateContent = useCallback((id, updates) => {
    const next = contents.map(c => c.id === id ? { ...c, ...updates } : c);
    updateContents(next);
  }, [contents, updateContents]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "plan", label: "Content Plan", icon: "plan" },
    { id: "calendar", label: "Calendar", icon: "calendar" },
    { id: "notebook", label: "Notebook", icon: "notebook" },
    { id: "product", label: "My Product", icon: "product" },
  ];

  const syncColors = {
    idle: "#2E4A6A", syncing: "#F59E0B", ok: "#22C55E",
    error: "#EF4444", "not-configured": "#6B7280"
  };
  const syncLabels = {
    idle: "–", syncing: "Syncing...", ok: "Synced ✓",
    error: "Sync Error", "not-configured": "Local only"
  };

  if (!loaded) return (
    <PasswordGate>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#020816", color: "#38BDF8", fontFamily: "'Poppins',sans-serif", fontSize: 15, gap: 10 }}>
        <div style={{ width: 18, height: 18, border: "2px solid #38BDF8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Loading...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </PasswordGate>
  );

  return (
    <PasswordGate>
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#020816;color:#C8D6E8;font-family:'Poppins',sans-serif;height:100%;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#1a2f4a;border-radius:4px;}
        input,textarea,select{
          background:rgba(255,255,255,0.04);color:#C8D6E8;
          border:1px solid rgba(56,189,248,0.15);
          border-radius:10px;padding:10px 14px;
          font-family:'Poppins',sans-serif;font-size:13px;outline:none;
          transition:border-color 0.2s,box-shadow 0.2s;width:100%;
          backdrop-filter:blur(8px);
        }
        input:focus,textarea:focus,select:focus{border-color:#38BDF8;box-shadow:0 0 0 3px rgba(56,189,248,0.12);}
        select option{background:#070E1C;}
        button{cursor:pointer;font-family:'Poppins',sans-serif;border:none;outline:none;transition:all 0.18s;}
        .tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:100px;font-size:10px;font-weight:600;letter-spacing:0.04em;}
        .btn-primary{background:linear-gradient(135deg,#0EA5E9,#6366F1);color:#fff;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:7px;box-shadow:0 4px 20px rgba(14,165,233,0.35);}
        .btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(14,165,233,0.45);}
        .btn-ghost{background:rgba(255,255,255,0.04);color:#4A6A8A;border:1px solid rgba(56,189,248,0.12);border-radius:8px;padding:7px 12px;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:5px;backdrop-filter:blur(6px);}
        .btn-ghost:hover{border-color:#38BDF8;color:#38BDF8;background:rgba(56,189,248,0.08);}
        .glass{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:18px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}
        .glass-dark{background:rgba(2,8,22,0.6);border:1px solid rgba(56,189,248,0.1);border-radius:16px;padding:18px;backdrop-filter:blur(20px);}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,5,15,0.85);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;}
        .modal{background:rgba(5,12,28,0.95);border:1px solid rgba(56,189,248,0.2);border-radius:20px;padding:24px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,0.8);backdrop-filter:blur(20px);}
        .pill-opt{padding:6px 13px;border-radius:100px;font-size:11px;font-weight:600;border:1.5px solid rgba(56,189,248,0.15);background:transparent;color:#4A6A8A;cursor:pointer;transition:all 0.15s;font-family:'Poppins',sans-serif;}
        .pill-opt:hover{border-color:#38BDF8;color:#38BDF8;}
        .pill-opt.sel{border-color:#0EA5E9;background:rgba(14,165,233,0.15);color:#38BDF8;}
        .lbl{font-size:10px;font-weight:700;color:#2E4A6A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:7px;}
        .page{padding:22px 16px;}
        @media(min-width:640px){.page{padding:28px 28px;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
        .fade-up{animation:fadeUp 0.28s ease;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite;}
        .grad-text{background:linear-gradient(135deg,#38BDF8,#818CF8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", position: "relative", background: "#020816" }}>
        {/* bg glow blobs */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "45%", height: "45%", background: "radial-gradient(circle,rgba(14,165,233,0.12) 0%,transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "50%", left: "30%", width: "30%", height: "30%", background: "radial-gradient(circle,rgba(168,85,247,0.06) 0%,transparent 70%)", borderRadius: "50%" }} />
        </div>

        {/* SIDEBAR */}
        <aside style={{ width: sideOpen ? 210 : 64, background: "rgba(3,9,20,0.85)", borderRight: "1px solid rgba(56,189,248,0.1)", padding: sideOpen ? "22px 14px" : "22px 10px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0, transition: "width 0.25s cubic-bezier(.4,0,.2,1),padding 0.25s", overflow: "hidden", zIndex: 50, backdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: sideOpen ? "space-between" : "center", marginBottom: 28, paddingLeft: sideOpen ? 4 : 0 }}>
            {sideOpen && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", background: "linear-gradient(90deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Creator</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#E2EBF5", lineHeight: 1.1 }}>Studio</div>
              </div>
            )}
            <button onClick={() => setSideOpen(v => !v)} style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 8, padding: "6px", color: "#38BDF8", display: "flex" }}>
              <I n="menu" s={15} />
            </button>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {navItems.map(n => {
              const active = tab === n.id;
              return (
                <button key={n.id} onClick={() => setTab(n.id)} title={n.label} style={{ display: "flex", alignItems: "center", gap: sideOpen ? 10 : 0, justifyContent: sideOpen ? "flex-start" : "center", padding: sideOpen ? "11px 12px" : "11px 0", borderRadius: 10, border: "none", cursor: "pointer", background: active ? "rgba(14,165,233,0.12)" : "transparent", color: active ? "#38BDF8" : "#2E4A6A", fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", position: "relative", transition: "all 0.2s" }}>
                  {active && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, background: "linear-gradient(180deg,#38BDF8,#6366F1)", borderRadius: "0 2px 2px 0" }} />}
                  <I n={n.icon} s={16} c={active ? "#38BDF8" : "#2E4A6A"} />
                  {sideOpen && n.label}
                </button>
              );
            })}
          </nav>

          {sideOpen && (
            <div style={{ marginTop: "auto", paddingLeft: 4 }}>
              <div style={{ height: 1, background: "linear-gradient(90deg,rgba(56,189,248,0.3),transparent)", marginBottom: 10 }} />
              {/* Sync status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: syncColors[syncStatus], flexShrink: 0, boxShadow: `0 0 6px ${syncColors[syncStatus]}` }} />
                <div style={{ fontSize: 9, color: syncColors[syncStatus], fontWeight: 600, letterSpacing: "0.05em" }}>{syncLabels[syncStatus]}</div>
              </div>
              <div style={{ fontSize: 10, color: "#1E3A5F", fontWeight: 500 }}>Content Plan · v3.0</div>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, overflowX: "hidden", minWidth: 0, position: "relative", zIndex: 1 }}>
          <div className="fade-up" key={tab}>
            {tab === "dashboard" && <Dashboard accounts={accounts} setAccounts={updateAccounts} contents={contents} selYear={selYear} selMonth={selMonth} setSelYear={setSelYear} setSelMonth={setSelMonth} />}
            {tab === "plan" && <ContentPlan contents={contents} setContents={updateContents} />}
            {tab === "calendar" && <ContentCalendar contents={contents} updateContent={updateContent} accounts={accounts} selYear={selYear} selMonth={selMonth} setSelYear={setSelYear} setSelMonth={setSelMonth} />}
            {tab === "notebook" && <Notebook notebook={notebook} setNotebook={updateNotebook} />}
            {tab === "product" && <MyProduct products={products} setProducts={updateProducts} />}
          </div>
        </main>
      </div>
    </>
    </PasswordGate>
  );
}

// ── FOLLOWER HISTORY HELPERS ──────────────────────────────────────────────────
function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
function getFollower(acc, year, month) {
  return acc.followerHistory?.[monthKey(year, month)] ?? null;
}
function getPrevFollower(acc, year, month) {
  const hist = acc.followerHistory || {};
  const cur = monthKey(year, month);
  const prevKeys = Object.keys(hist).sort().filter(k => k < cur);
  if (!prevKeys.length) return null;
  return hist[prevKeys[prevKeys.length - 1]];
}
function getLatestFollower(acc) {
  const hist = acc.followerHistory || {};
  const keys = Object.keys(hist).sort();
  if (!keys.length) return null;
  return hist[keys[keys.length - 1]];
}
function getAllTimeGrowth(acc) {
  const hist = acc.followerHistory || {};
  const keys = Object.keys(hist).sort();
  if (keys.length < 2) return null;
  return hist[keys[keys.length - 1]] - hist[keys[0]];
}
function getAllTimeFirstFollower(acc) {
  const hist = acc.followerHistory || {};
  const keys = Object.keys(hist).sort();
  if (!keys.length) return null;
  return hist[keys[0]];
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

function Dashboard({ accounts, setAccounts, contents, selYear, selMonth, setSelYear, setSelMonth }) {
  const [editAcc, setEditAcc] = useState(null);
  const [allMonths, setAllMonths] = useState(false);
  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i);

  const filtered = allMonths
    ? contents.filter(c => c.date && c.date.trim() !== "")
    : contents.filter(c => { const d = new Date(c.date); return d.getFullYear() === selYear && d.getMonth() === selMonth; });
  const posted = filtered.filter(c => c.status === "Posted");
  const pending = filtered.filter(c => c.status === "Pending");
  const record = filtered.filter(c => c.status === "Record");
  const platformViews = PLATFORMS.reduce((acc, p) => { acc[p] = posted.reduce((sum, c) => sum + (c.views?.[p] || 0), 0); return acc; }, {});
  const totalViewsAll = Object.values(platformViews).reduce((a, b) => a + b, 0);
  const winning = [...posted].sort((a, b) => { const ta = PLATFORMS.reduce((s, p) => s + (a.views?.[p] || 0), 0); const tb = PLATFORMS.reduce((s, p) => s + (b.views?.[p] || 0), 0); return tb - ta; }).slice(0, 3);
  const pillarDist = {};
  filtered.forEach(c => { pillarDist[c.pillar] = (pillarDist[c.pillar] || 0) + 1; });
  const statCards = [
    { label: "Total Konten", val: filtered.length, color: "#38BDF8", grad: "linear-gradient(135deg,rgba(14,165,233,0.2),rgba(99,102,241,0.1))", border: "rgba(56,189,248,0.3)", icon: <I n="plan" s={18} c="#38BDF8" /> },
    { label: "Posted", val: posted.length, color: "#22C55E", grad: "linear-gradient(135deg,rgba(34,197,94,0.2),rgba(16,185,129,0.1))", border: "rgba(34,197,94,0.3)", icon: <I n="eye" s={18} c="#22C55E" /> },
    { label: "Pending", val: pending.length, color: "#EF4444", grad: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.1))", border: "rgba(239,68,68,0.3)", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
    { label: "Record", val: record.length, color: "#F59E0B", grad: "linear-gradient(135deg,rgba(245,158,11,0.2),rgba(234,179,8,0.1))", border: "rgba(245,158,11,0.3)", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="#F59E0B" /></svg> },
  ];

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "linear-gradient(90deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 2 }}>Overview</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#E2EBF5", letterSpacing: "-0.5px" }}>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setAllMonths(v => !v)} style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${allMonths ? "#38BDF8" : "rgba(56,189,248,0.15)"}`, background: allMonths ? "rgba(56,189,248,0.12)" : "transparent", color: allMonths ? "#38BDF8" : "#4A6A8A", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Poppins',sans-serif", transition: "all 0.18s" }}>
            {allMonths ? "✓ Semua Bulan" : "Semua Bulan"}
          </button>
          {!allMonths && <>
            <select value={selMonth} onChange={e => setSelMonth(+e.target.value)} style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}>{MONTH_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
            <select value={selYear} onChange={e => setSelYear(+e.target.value)} style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
          </>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: s.grad, border: `1px solid ${s.border}`, borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(16px)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -12, right: -12, opacity: 0.08, transform: "scale(2.5)" }}>{s.icon}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><div style={{ padding: 7, background: "rgba(0,0,0,0.3)", borderRadius: 9, display: "flex" }}>{s.icon}</div></div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-1px" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "rgba(200,214,232,0.5)", marginTop: 3, fontWeight: 600, letterSpacing: "0.05em" }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Views + Follower Growth card */}
      <div style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.15),rgba(99,102,241,0.15))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: "18px 20px", marginBottom: 16, backdropFilter: "blur(16px)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right,rgba(99,102,241,0.2),transparent 60%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, color: "rgba(129,140,248,0.8)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            {allMonths ? "Total Views Semua Waktu" : "Total Views Bulan Ini"}
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1, letterSpacing: "-1px" }}>{fmtNum(totalViewsAll)}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
            {PLATFORMS.map(p => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <PlatformLogo platform={p} size={18} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#E2EBF5" }}>{fmtNum(platformViews[p] || 0)}</div>
                  <div style={{ fontSize: 9, color: "rgba(200,214,232,0.4)", textTransform: "capitalize" }}>{p}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Follower growth per platform */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 10, color: "rgba(129,140,248,0.7)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              {allMonths ? "Total Pertumbuhan Followers (All Time)" : "Pertumbuhan Followers Bulan Ini"}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {accounts.map(acc => {
                let growth = null;
                let curFollowers = null;
                if (allMonths) {
                  growth = getAllTimeGrowth(acc);
                  curFollowers = getLatestFollower(acc);
                } else {
                  curFollowers = getFollower(acc, selYear, selMonth);
                  const prev = getPrevFollower(acc, selYear, selMonth);
                  if (curFollowers !== null && prev !== null) growth = curFollowers - prev;
                  else if (curFollowers !== null && getAllTimeFirstFollower(acc) !== null) {
                    const firstKey = Object.keys(acc.followerHistory || {}).sort()[0];
                    const curKey = monthKey(selYear, selMonth);
                    if (firstKey === curKey) growth = null;
                  }
                }
                return (
                  <div key={acc.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <PlatformLogo platform={acc.platform} size={18} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#E2EBF5" }}>
                        {curFollowers !== null ? fmtNum(curFollowers) : "–"}
                      </div>
                      {growth !== null && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: growth >= 0 ? "#22C55E" : "#EF4444" }}>
                          {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toLocaleString("id-ID")}
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: "rgba(200,214,232,0.4)", textTransform: "capitalize" }}>{acc.platform}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Akun Sosial Media */}
      <div className="glass-dark" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#E2EBF5" }}>Akun Sosial Media</span>
          <span style={{ fontSize: 10, color: "#1E3A5F" }}>tap untuk input followers</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map(acc => {
            const curFollowers = allMonths ? getLatestFollower(acc) : getFollower(acc, selYear, selMonth);
            const prevFollowers = allMonths ? getAllTimeFirstFollower(acc) : getPrevFollower(acc, selYear, selMonth);
            const growth = curFollowers !== null && prevFollowers !== null ? curFollowers - prevFollowers : null;
            return (
              <div key={acc.id} onClick={() => setEditAcc(acc)} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", transition: "all 0.2s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(56,189,248,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: acc.grad, borderRadius: "12px 0 0 12px" }} />
                <div style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: acc.grad, padding: 2 }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                    <PlatformLogo platform={acc.platform} size={26} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
                  <div style={{ fontSize: 9, color: acc.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{acc.platform}</div>
                  <div style={{ fontSize: 13, color: "#C8D6E8", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acc.handle}</div>
                </div>
                <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#1E3A5F", fontWeight: 700, letterSpacing: "0.05em" }}>FOLLOWERS</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#E2EBF5" }}>{curFollowers !== null ? fmtNum(curFollowers) : <span style={{ color: "#1E3A5F", fontSize: 12 }}>–</span>}</div>
                    {growth !== null && <div style={{ fontSize: 9, fontWeight: 700, color: growth >= 0 ? "#22C55E" : "#EF4444" }}>{growth >= 0 ? "▲" : "▼"}{Math.abs(growth).toLocaleString("id-ID")}</div>}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#1E3A5F", fontWeight: 700, letterSpacing: "0.05em" }}>VIEWS</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: acc.color }}>{fmtNum(acc.totalViews + (platformViews[acc.platform] || 0))}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="glass-dark" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#E2EBF5", marginBottom: 14 }}>Views per Platform</div>
        {PLATFORMS.map(p => {
          const acc = accounts.find(a => a.platform === p);
          const v = platformViews[p] || 0;
          const pct = totalViewsAll > 0 ? (v / totalViewsAll) * 100 : 0;
          return (
            <div key={p} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><PlatformLogo platform={p} size={18} /><span style={{ fontSize: 12, color: "#4A6A8A", textTransform: "capitalize" }}>{p}</span></div>
                <span style={{ fontSize: 13, color: "#E2EBF5", fontWeight: 700 }}>{fmtNum(v)}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: pct + "%", background: acc?.grad || "#38BDF8", borderRadius: 4, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="glass-dark" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#E2EBF5", marginBottom: 14 }}>Distribusi Pillar</div>
        {Object.keys(pillarDist).length === 0
          ? <div style={{ fontSize: 12, color: "#1E3A5F" }}>Belum ada konten bulan ini</div>
          : Object.entries(pillarDist).map(([pillar, count]) => {
            const pct = filtered.length > 0 ? (count / filtered.length) * 100 : 0;
            const c = PILLAR_COLORS[pillar] || "#888";
            return (
              <div key={pillar} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "#4A6A8A" }}>{pillar}</span>
                  <span style={{ fontSize: 11, color: c, fontWeight: 800 }}>{count}x · {Math.round(pct)}%</span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: pct + "%", background: c, borderRadius: 3, transition: "width 0.8s", boxShadow: `0 0 8px ${c}60` }} />
                </div>
              </div>
            );
          })}
      </div>
      <div className="glass-dark">
        <div style={{ fontSize: 13, fontWeight: 700, color: "#E2EBF5", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <I n="trophy" s={15} c="#FBBF24" /> <span>Winning Content</span>
          <span style={{ fontSize: 10, color: "#1E3A5F", fontWeight: 400 }}>– top views bulan ini</span>
        </div>
        {winning.length === 0
          ? <div style={{ fontSize: 12, color: "#1E3A5F" }}>Belum ada konten posted</div>
          : winning.map((c, i) => {
            const total = PLATFORMS.reduce((s, p) => s + (c.views?.[p] || 0), 0);
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < winning.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{medals[i]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#C8D6E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: "#1E3A5F", marginTop: 1 }}>{c.date}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, background: "linear-gradient(135deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", flexShrink: 0 }}>{fmtNum(total)}</div>
              </div>
            );
          })}
      </div>
      {editAcc && <AccountModal acc={editAcc} accounts={accounts} setAccounts={setAccounts} selYear={selYear} selMonth={selMonth} onClose={() => setEditAcc(null)} />}
    </div>
  );
}

function AccountModal({ acc, accounts, setAccounts, selYear, selMonth, onClose }) {
  const curKey = monthKey(selYear, selMonth);
  const curFollowers = acc.followerHistory?.[curKey] ?? "";
  const [form, setForm] = useState({ handle: acc.handle, followers: curFollowers, totalViews: acc.totalViews || 0 });

  const doSave = () => {
    const updatedHistory = { ...(acc.followerHistory || {}) };
    if (form.followers !== "" && form.followers !== null) {
      updatedHistory[curKey] = +form.followers;
    }
    setAccounts(accounts.map(a => a.id === acc.id ? {
      ...acc,
      handle: form.handle,
      totalViews: +form.totalViews,
      followerHistory: updatedHistory,
    } : a));
    onClose();
  };

  const historyEntries = Object.entries(acc.followerHistory || {}).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PlatformLogo platform={acc.platform} size={24} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5", textTransform: "capitalize" }}>{acc.platform}</h3>
          </div>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={onClose}><I n="close" s={13} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Fld label="Handle / Username">
            <input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} />
          </Fld>
          <Fld label={`Followers ${MONTH_FULL[selMonth]} ${selYear}`}>
            <input type="number" value={form.followers} onChange={e => setForm({ ...form, followers: e.target.value })} placeholder="Jumlah followers bulan ini..." />
          </Fld>
          <Fld label="Total Views (base)">
            <input type="number" value={form.totalViews} onChange={e => setForm({ ...form, totalViews: e.target.value })} />
          </Fld>

          {/* Follower history log */}
          {historyEntries.length > 0 && (
            <div>
              <div className="lbl" style={{ marginBottom: 8 }}>Riwayat Followers</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 160, overflowY: "auto" }}>
                {historyEntries.map(([key, val], idx) => {
                  const prev = idx > 0 ? historyEntries[idx - 1][1] : null;
                  const diff = prev !== null ? val - prev : null;
                  const [yr, mo] = key.split("-");
                  return (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: "#4A6A8A" }}>{MONTH_FULL[+mo - 1]} {yr}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {diff !== null && <span style={{ fontSize: 10, fontWeight: 700, color: diff >= 0 ? "#22C55E" : "#EF4444" }}>{diff >= 0 ? "▲" : "▼"}{Math.abs(diff).toLocaleString("id-ID")}</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#E2EBF5" }}>{val.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className="btn-primary" style={{ justifyContent: "center", marginTop: 4 }} onClick={doSave}>
            <I n="save" s={13} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CONTENT PLAN ──────────────────────────────────────────────────────────────
const CONTENT_FILTERS = ["Scheduled", "Archive", "Behind The Timeline", "60Second Edit", "Random"];

function ContentPlan({ contents, setContents }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Scheduled");
  const [archiveOnly, setArchiveOnly] = useState(false);

  const filtered = contents.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const hasDate = c.date && c.date.trim() !== "";
    let matchFilter = false;
    if (activeFilter === "Scheduled") matchFilter = hasDate;
    else if (activeFilter === "Archive") matchFilter = !hasDate;
    else matchFilter = c.type === activeFilter;
    const matchArchive = archiveOnly ? !hasDate : true;
    return matchFilter && matchSearch && matchArchive;
  }).sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });
  const del = id => setContents(contents.filter(c => c.id !== id));
  const doSave = item => {
    if (item.id && contents.find(c => c.id === item.id)) { setContents(contents.map(c => c.id === item.id ? item : c)); }
    else { setContents([...contents, { ...item, id: Date.now().toString(), status: "Pending", views: {} }]); }
    setShowModal(false); setEditItem(null);
  };
  const counts = {
    Scheduled: contents.filter(c => c.date && c.date.trim() !== "").length,
    Archive: contents.filter(c => !c.date || c.date.trim() === "").length,
    "Behind The Timeline": contents.filter(c => c.type === "Behind The Timeline").length,
    "60Second Edit": contents.filter(c => c.type === "60Second Edit").length,
    Random: contents.filter(c => c.type === "Random").length,
  };
  const countCards = [
    { label: "Scheduled", count: counts.Scheduled, color: "#38BDF8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.2)", icon: "📅" },
    { label: "Archive", count: counts.Archive, color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", icon: "📦" },
    { label: "Behind The Timeline", count: counts["Behind The Timeline"], color: "#A78BFA", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)", icon: "🎬" },
    { label: "60Second Edit", count: counts["60Second Edit"], color: "#34D399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)", icon: "⚡" },
    { label: "Random", count: counts.Random, color: "#F472B6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.2)", icon: "🎲" },
  ];
  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "linear-gradient(90deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 2 }}>Planning</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#E2EBF5" }}>Content Plan</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setArchiveOnly(v => !v)} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${archiveOnly ? "#F59E0B" : "rgba(255,255,255,0.1)"}`, background: archiveOnly ? "rgba(245,158,11,0.15)" : "transparent", color: archiveOnly ? "#F59E0B" : "#4A6A8A", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Poppins',sans-serif", transition: "all 0.18s" }}>📦 Show Archive Only</button>
          <button className="btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}><I n="plus" s={13} /> Tambah Konten</button>
        </div>
      </div>

      {/* Summary count cards */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {countCards.map(c => (
          <div key={c.label} onClick={() => setActiveFilter(c.label)} style={{ display: "flex", alignItems: "center", gap: 8, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "8px 14px", cursor: "pointer", transition: "all 0.18s", transform: activeFilter === c.label ? "translateY(-1px)" : "none", boxShadow: activeFilter === c.label ? `0 4px 14px ${c.border}` : "none" }}>
            <span style={{ fontSize: 14 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.count}</div>
              <div style={{ fontSize: 9, color: c.color, opacity: 0.7, fontWeight: 600, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{c.label.toUpperCase()}</div>
            </div>
          </div>
        ))}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Cari konten..." style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
        {CONTENT_FILTERS.map(f => {
          const isArchive = f === "Archive";
          return (
            <button key={f} className={`pill-opt ${activeFilter === f ? "sel" : ""}`}
              style={activeFilter === f && isArchive ? { borderColor: "#F59E0B", background: "rgba(245,158,11,0.15)", color: "#F59E0B" } : {}}
              onClick={() => setActiveFilter(f)}>
              {f === "Scheduled" ? "📅 Scheduled" : f === "Archive" ? "📦 Archive" : f}
            </button>
          );
        })}
      </div>
      {filtered.length === 0
        ? <div className="glass-dark" style={{ textAlign: "center", padding: 40, color: "#1E3A5F" }}><div style={{ fontSize: 28, marginBottom: 10 }}>📋</div><div style={{ fontSize: 14, fontWeight: 600 }}>Belum ada konten</div></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(c => (
            <div key={c.id} className="glass-dark" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px" }}>
              <div style={{ width: 3, borderRadius: 2, background: PILLAR_COLORS[c.pillar] || "#38BDF8", alignSelf: "stretch", flexShrink: 0, boxShadow: `0 0 8px ${PILLAR_COLORS[c.pillar] || "#38BDF8"}60` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E2EBF5", marginBottom: 6 }}>{c.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  <span className="tag" style={{ background: (PILLAR_COLORS[c.pillar] || "#38BDF8") + "22", color: PILLAR_COLORS[c.pillar] || "#38BDF8" }}>{c.pillar}</span>
                  <span className="tag" style={{ background: "rgba(255,255,255,0.06)", color: "#4A6A8A" }}>{c.type}</span>
                  <span className="tag" style={{ background: STATUS_BG[c.status], color: STATUS_COLORS[c.status] }}>{c.status}</span>
                </div>
                <div style={{ fontSize: 11, color: "#1E5F8A" }}>
                  {c.date ? c.date : <span style={{ color: "#F59E0B", fontWeight: 600 }}>📦 Archive</span>}
                  {c.script ? ` · ${c.script.slice(0, 60)}${c.script.length > 60 ? "..." : ""}` : ""}
                </div>
                {c.reference && <div style={{ fontSize: 11, color: "#0EA5E9", marginTop: 4 }}>🔗 {c.reference}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn-ghost" style={{ padding: "6px 8px" }} onClick={() => { setEditItem(c); setShowModal(true); }}><I n="edit" s={12} /></button>
                <button className="btn-ghost" style={{ padding: "6px 8px", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }} onClick={() => del(c.id)}><I n="trash" s={12} /></button>
              </div>
            </div>
          ))}
        </div>}
      {showModal && <ContentFormModal item={editItem} onSave={doSave} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}

function ContentFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { title: "", date: "", pillar: "", type: "", script: "", reference: "" });
  const valid = form.title && form.pillar && form.type;
  const isArchive = !form.date || form.date.trim() === "";
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5" }}>{item ? "Edit Konten" : "Tambah Konten Baru"}</h3>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={onClose}><I n="close" s={13} /></button>
        </div>
        {isArchive && (
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📦</span>
            <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>Tanggal kosong → otomatis masuk Archive. Isi tanggal untuk di-schedule.</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Fld label="Tanggal (kosongkan untuk Archive)">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </Fld>
          <Fld label="Judul Konten *"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Judul konten..." /></Fld>
          <Fld label="Konten Pillar *"><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{PILLARS.map(p => <button key={p} className={`pill-opt ${form.pillar === p ? "sel" : ""}`} onClick={() => setForm({ ...form, pillar: p })}>{p}</button>)}</div></Fld>
          <Fld label="Jenis Konten *"><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{TYPES.map(t => <button key={t} className={`pill-opt ${form.type === t ? "sel" : ""}`} onClick={() => {
            const prefix = TYPE_PREFIX[t];
            const currentTitle = form.title;
            // Replace or set prefix
            let newTitle = currentTitle;
            if (prefix) {
              const oldPrefix = TYPES.filter(x => TYPE_PREFIX[x]).find(x => currentTitle.startsWith(TYPE_PREFIX[x] + " | "));
              if (oldPrefix) {
                newTitle = prefix + " | " + currentTitle.slice(TYPE_PREFIX[oldPrefix].length + 3);
              } else if (!currentTitle || currentTitle.trim() === "") {
                newTitle = prefix + " | ";
              } else if (!TYPES.some(x => TYPE_PREFIX[x] && currentTitle.startsWith(TYPE_PREFIX[x]))) {
                newTitle = prefix + " | " + currentTitle;
              }
            }
            setForm({ ...form, type: t, title: newTitle });
          }}>{t}</button>)}</div></Fld>
          <Fld label="Script Konten"><textarea value={form.script} onChange={e => setForm({ ...form, script: e.target.value })} rows={4} placeholder="Tulis script konten di sini..." style={{ resize: "vertical" }} /></Fld>
          <Fld label="Referensi Konten"><input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="URL atau nama referensi..." /></Fld>
          <button className="btn-primary" style={{ justifyContent: "center", marginTop: 4, opacity: valid ? 1 : 0.4 }} onClick={() => valid && onSave(form)} disabled={!valid}>
            <I n="save" s={13} /> {item ? "Update Konten" : isArchive ? "Simpan ke Archive" : "Simpan & Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CONTENT CALENDAR ──────────────────────────────────────────────────────────
const CAL_BG = { Pending: "rgba(239,68,68,0.18)", Record: "rgba(245,158,11,0.18)", Posted: "rgba(34,197,94,0.18)", Deleted: "rgba(107,114,128,0.1)" };
const CAL_BORDER = { Pending: "rgba(239,68,68,0.5)", Record: "rgba(245,158,11,0.5)", Posted: "rgba(34,197,94,0.5)", Deleted: "rgba(107,114,128,0.3)" };

function ContentCalendar({ contents, updateContent, accounts, selYear, selMonth, setSelYear, setSelMonth }) {
  const [selected, setSelected] = useState(null);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const firstDay = new Date(selYear, selMonth, 1).getDay();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  while (cells.length % 7 !== 0) cells.push(null);
  const byDate = {};
  contents.forEach(c => { const d = new Date(c.date); if (d.getFullYear() === selYear && d.getMonth() === selMonth) { const day = d.getDate(); if (!byDate[day]) byDate[day] = []; byDate[day].push(c); } });
  const today = new Date();
  const prev = () => { if (selMonth === 0) { setSelMonth(11); setSelYear(y => y - 1); } else setSelMonth(m => m - 1); };
  const next = () => { if (selMonth === 11) { setSelMonth(0); setSelYear(y => y + 1); } else setSelMonth(m => m + 1); };
  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "linear-gradient(90deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 2 }}>Jadwal</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#E2EBF5" }}>Content Calendar</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <button className="btn-ghost" style={{ padding: "7px 10px" }} onClick={prev}><I n="chevL" s={13} /></button>
          <select value={selMonth} onChange={e => setSelMonth(+e.target.value)} style={{ width: "auto", padding: "7px 10px", fontSize: 12 }}>{MONTH_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
          <select value={selYear} onChange={e => setSelYear(+e.target.value)} style={{ width: "auto", padding: "7px 10px", fontSize: 12 }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
          <button className="btn-ghost" style={{ padding: "7px 10px" }} onClick={next}><I n="chevR" s={13} /></button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ s: "Pending", c: STATUS_COLORS.Pending }, { s: "Record", c: STATUS_COLORS.Record }, { s: "Posted", c: STATUS_COLORS.Posted }, { s: "Deleted", c: STATUS_COLORS.Deleted }].map(l => (
          <div key={l.s} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: l.c, boxShadow: `0 0 6px ${l.c}80` }} /><span style={{ fontSize: 10, color: "#4A6A8A", fontWeight: 600 }}>{l.s}</span></div>
        ))}
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(110px,1fr))", gap: 4, marginBottom: 4, minWidth: 700 }}>
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#1E3A5F", letterSpacing: "0.08em", padding: "5px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(110px,1fr))", gap: 4, minWidth: 700 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 76, borderRadius: 8 }} />;
          const items = byDate[day] || [];
          const isToday = today.getFullYear() === selYear && today.getMonth() === selMonth && today.getDate() === day;
          const dominantStatus = items[0]?.status || null;
          return (
            <div key={i} onClick={() => items.length > 0 && setSelected(items[0])} style={{ minHeight: 76, background: dominantStatus && items.length > 0 ? CAL_BG[dominantStatus] : "rgba(255,255,255,0.02)", border: `1px solid ${isToday ? "#38BDF8" : dominantStatus && items.length > 0 ? CAL_BORDER[dominantStatus] : "rgba(255,255,255,0.05)"}`, borderRadius: 8, padding: "6px 5px", cursor: items.length > 0 ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 3, transition: "all 0.2s" }}
              onMouseEnter={e => { if (items.length > 0) e.currentTarget.style.transform = "scale(1.02)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? "#38BDF8" : "#2E4A6A", textAlign: "right", paddingRight: 2 }}>{day}</div>
              {items.slice(0, 2).map(c => <div key={c.id} style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, lineHeight: 1.4, background: "rgba(0,0,0,0.3)", color: STATUS_COLORS[c.status] || "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{c.title}</div>)}
              {items.length > 2 && <div style={{ fontSize: 9, color: "rgba(200,214,232,0.3)", textAlign: "center" }}>+{items.length - 2}</div>}
            </div>
          );
        })}
      </div>
      </div>
      {selected && <CalendarDetailModal item={selected} accounts={accounts} updateContent={updateContent} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CalendarDetailModal({ item, accounts, updateContent, onClose }) {
  const [form, setForm] = useState({ status: item.status || "Pending", views: { instagram: item.views?.instagram || 0, tiktok: item.views?.tiktok || 0, youtube: item.views?.youtube || 0 } });
  const doSave = () => { updateContent(item.id, { status: form.status, views: form.views }); onClose(); };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "#1E5F8A", marginBottom: 4 }}>{item.date}</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5" }}>{item.title}</h3>
            <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
              <span className="tag" style={{ background: (PILLAR_COLORS[item.pillar] || "#38BDF8") + "22", color: PILLAR_COLORS[item.pillar] || "#38BDF8" }}>{item.pillar}</span>
              <span className="tag" style={{ background: "rgba(255,255,255,0.06)", color: "#4A6A8A" }}>{item.type}</span>
            </div>
          </div>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={onClose}><I n="close" s={13} /></button>
        </div>
        {item.script && <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14, marginBottom: 16 }}><div className="lbl">Script</div><div style={{ fontSize: 12, color: "#4A6A8A", lineHeight: 1.7 }}>{item.script}</div></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Fld label="Status Konten"><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{STATUSES.map(s => <button key={s} className={`pill-opt ${form.status === s ? "sel" : ""}`} style={form.status === s ? { borderColor: STATUS_COLORS[s], background: STATUS_BG[s], color: STATUS_COLORS[s] } : {}} onClick={() => setForm({ ...form, status: s })}>{s}</button>)}</div></Fld>
          <div><div className="lbl">Views per Platform</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PLATFORMS.map(p => <div key={p} style={{ display: "flex", alignItems: "center", gap: 10 }}><PlatformLogo platform={p} size={20} /><span style={{ flex: 1, fontSize: 12, color: "#4A6A8A", textTransform: "capitalize" }}>{p}</span><input type="number" value={form.views[p]} onChange={e => setForm({ ...form, views: { ...form.views, [p]: +e.target.value } })} style={{ width: 120 }} /></div>)}
            </div>
          </div>
          <button className="btn-primary" style={{ justifyContent: "center", marginTop: 4 }} onClick={doSave}><I n="save" s={13} /> Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
}

// ── NOTEBOOK ──────────────────────────────────────────────────────────────────
function Notebook({ notebook, setNotebook }) {
  const [activeTab, setActiveTab] = useState("notes");
  const [editItem, setEditItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const items = notebook[activeTab] || [];
  const doSave = item => {
    const list = notebook[activeTab] || [];
    if (item.id && list.find(x => x.id === item.id)) { setNotebook({ ...notebook, [activeTab]: list.map(x => x.id === item.id ? item : x) }); }
    else { setNotebook({ ...notebook, [activeTab]: [...list, { ...item, id: Date.now().toString(), createdAt: new Date().toLocaleDateString("id-ID") }] }); }
    setShowModal(false); setEditItem(null);
  };
  const del = id => setNotebook({ ...notebook, [activeTab]: (notebook[activeTab] || []).filter(x => x.id !== id) });
  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "linear-gradient(90deg,#38BDF8,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 2 }}>Notes</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#E2EBF5" }}>My Notebook</h1>
        </div>
        <button className="btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}><I n="plus" s={13} /> Tambah {activeTab === "notes" ? "Catetan" : "Plan"}</button>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 12, padding: 4, width: "fit-content", backdropFilter: "blur(12px)" }}>
        {[["notes", "📝  Catetan"], ["plans", "🗺️  Plan"]].map(([k, l]) => <button key={k} onClick={() => setActiveTab(k)} style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 600, transition: "all 0.2s", background: activeTab === k ? "linear-gradient(135deg,#0EA5E9,#6366F1)" : "transparent", color: activeTab === k ? "#fff" : "#2E4A6A", boxShadow: activeTab === k ? "0 2px 12px rgba(14,165,233,0.4)" : "none" }}>{l}</button>)}
      </div>
      {items.length === 0
        ? <div className="glass-dark" style={{ textAlign: "center", padding: 40, color: "#1E3A5F" }}><div style={{ fontSize: 28, marginBottom: 10 }}>{activeTab === "notes" ? "📝" : "🗺️"}</div><div style={{ fontSize: 14, fontWeight: 600 }}>Belum ada {activeTab === "notes" ? "catetan" : "plan"}</div></div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
          {items.map(item => (
            <NotebookCard key={item.id} item={item} onEdit={() => { setEditItem(item); setShowModal(true); }} onDelete={() => del(item.id)} />
          ))}
        </div>}
      {showModal && <NoteModal activeTab={activeTab} item={editItem} onSave={doSave} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}

function NotebookCard({ item, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LEN = 120;
  const isLong = item.body && item.body.length > PREVIEW_LEN;
  const preview = isLong ? item.body.slice(0, PREVIEW_LEN).trimEnd() + "..." : item.body;

  return (
    <div className="glass-dark" style={{ transition: "all 0.25s", display: "flex", flexDirection: "column", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.2)"; e.currentTarget.style.background = "rgba(56,189,248,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.1)"; e.currentTarget.style.background = "rgba(2,8,22,0.6)"; }}
      onClick={() => isLong && setExpanded(v => !v)}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#E2EBF5", flex: 1, marginRight: 8 }}>{item.title}</h4>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button className="btn-ghost" style={{ padding: "4px 7px" }} onClick={onEdit}><I n="edit" s={11} /></button>
          <button className="btn-ghost" style={{ padding: "4px 7px", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }} onClick={onDelete}><I n="trash" s={11} /></button>
        </div>
      </div>

      {/* Tag */}
      {item.tag && <span className="tag" style={{ background: "rgba(14,165,233,0.15)", color: "#38BDF8", marginBottom: 10, width: "fit-content" }}>#{item.tag}</span>}

      {/* Body: preview or full */}
      <p style={{ fontSize: 12, color: "#4A6A8A", lineHeight: 1.8, whiteSpace: "pre-wrap", flex: 1 }}>
        {expanded ? item.body : preview}
      </p>

      {/* Expand/collapse hint */}
      {isLong && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#38BDF8", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          {expanded ? <><I n="chevL" s={11} c="#38BDF8" /> Tutup</> : <><I n="chevR" s={11} c="#38BDF8" /> Baca selengkapnya</>}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#1E2D4A", marginTop: 10 }}>{item.createdAt}</div>
    </div>
  );
}

function NoteModal({ activeTab, item, onSave, onClose }) {
  const [form, setForm] = useState(item || { title: "", body: "", tag: "" });
  const valid = form.title && form.body;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5" }}>{item ? "Edit" : "Tambah"} {activeTab === "notes" ? "Catetan" : "Plan"}</h3>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={onClose}><I n="close" s={13} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Fld label="Judul *"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Judul..." /></Fld>
          <Fld label="Tag"><input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} placeholder="ide, referensi, script..." /></Fld>
          <Fld label="Isi *"><textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={6} placeholder="Tulis di sini..." style={{ resize: "vertical" }} /></Fld>
          <button className="btn-primary" style={{ justifyContent: "center", marginTop: 4, opacity: valid ? 1 : 0.4 }} onClick={() => valid && onSave(form)} disabled={!valid}><I n="save" s={13} /> Simpan</button>
        </div>
      </div>
    </div>
  );
}

// ── MY PRODUCT ────────────────────────────────────────────────────────────────
function MyProduct({ products, setProducts }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sellModal, setSellModal] = useState(null); // product to update sold count

  // Dashboard stats
  const totalProducts = products.length;
  const released = products.filter(p => p.status === "Released");
  const pending = products.filter(p => p.status === "Pending");
  const totalSold = products.reduce((sum, p) => sum + (p.sold || 0), 0);
  const totalRevenue = products.reduce((sum, p) => sum + ((p.sold || 0) * (p.price || 0)), 0);

  const del = id => setProducts(products.filter(p => p.id !== id));

  const doSave = item => {
    if (item.id && products.find(p => p.id === item.id)) {
      setProducts(products.map(p => p.id === item.id ? item : p));
    } else {
      setProducts([...products, { ...item, id: Date.now().toString(), sold: 0, createdAt: new Date().toLocaleDateString("id-ID") }]);
    }
    setShowModal(false); setEditItem(null);
  };

  const doUpdateSold = (id, sold) => {
    setProducts(products.map(p => p.id === id ? { ...p, sold: Math.max(0, sold) } : p));
    setSellModal(null);
  };

  const statCards = [
    { label: "Total Produk", val: totalProducts, color: "#38BDF8", grad: "linear-gradient(135deg,rgba(14,165,233,0.2),rgba(99,102,241,0.1))", border: "rgba(56,189,248,0.3)", icon: <I n="box" s={18} c="#38BDF8" /> },
    { label: "Produk Terjual", val: totalSold, color: "#22C55E", grad: "linear-gradient(135deg,rgba(34,197,94,0.2),rgba(16,185,129,0.1))", border: "rgba(34,197,94,0.3)", icon: <I n="chart" s={18} c="#22C55E" /> },
    { label: "Total Pendapatan", val: fmtRupiah(totalRevenue), color: "#FBBF24", grad: "linear-gradient(135deg,rgba(251,191,36,0.2),rgba(234,179,8,0.1))", border: "rgba(251,191,36,0.3)", icon: <I n="money" s={18} c="#FBBF24" />, wide: true },
    { label: "Belum Rilis", val: pending.length, color: "#F472B6", grad: "linear-gradient(135deg,rgba(244,114,182,0.2),rgba(236,72,153,0.1))", border: "rgba(244,114,182,0.3)", icon: <I n="product" s={18} c="#F472B6" /> },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "linear-gradient(90deg,#F472B6,#FBBF24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 2 }}>Products</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#E2EBF5", letterSpacing: "-0.5px" }}>My Product</h1>
        </div>
        <button className="btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}><I n="plus" s={13} /> Tambah Produk</button>
      </div>

      {/* Dashboard Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 20 }}>
        {statCards.map((s, idx) => (
          <div key={s.label} style={{ background: s.grad, border: `1px solid ${s.border}`, borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(16px)", position: "relative", overflow: "hidden", gridColumn: s.wide ? "1 / -1" : "auto" }}>
            <div style={{ position: "absolute", top: -10, right: -10, opacity: 0.08, transform: "scale(2.5)" }}>{s.icon}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "rgba(200,214,232,0.5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: s.wide ? 28 : 30, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: s.wide ? "-0.5px" : "-1px" }}>{s.val}</div>
              </div>
              <div style={{ padding: 10, background: "rgba(0,0,0,0.25)", borderRadius: 12, display: "flex" }}>{s.icon}</div>
            </div>
            {s.wide && totalRevenue > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                {released.filter(p => p.sold > 0).sort((a, b) => (b.sold * b.price) - (a.sold * a.price)).slice(0, 3).map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FBBF24" }} />
                    <span style={{ fontSize: 10, color: "rgba(200,214,232,0.6)" }}>{p.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#FBBF24" }}>{fmtRupiah(p.sold * p.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Product List */}
      {products.length === 0 ? (
        <div className="glass-dark" style={{ textAlign: "center", padding: 50, color: "#1E3A5F" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#2E4A6A" }}>Belum ada produk</div>
          <div style={{ fontSize: 12, color: "#1E3A5F" }}>Tambahkan produk pertamamu!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {products.map(p => {
            const revenue = (p.sold || 0) * (p.price || 0);
            return (
              <div key={p.id} className="glass-dark" style={{ padding: "16px 18px", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(244,114,182,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.1)"; }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  {/* Status stripe */}
                  <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", flexShrink: 0, background: p.status === "Released" ? "linear-gradient(180deg,#22C55E,#16A34A)" : "linear-gradient(180deg,#F59E0B,#D97706)", boxShadow: `0 0 8px ${p.status === "Released" ? "#22C55E" : "#F59E0B"}60` }} />

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5" }}>{p.name}</div>
                      <span className="tag" style={{ background: PRODUCT_STATUS_BG[p.status], color: PRODUCT_STATUS_COLORS[p.status], border: `1px solid ${PRODUCT_STATUS_COLORS[p.status]}40` }}>{p.status}</span>
                    </div>

                    {/* Metrics row */}
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 9, color: "#1E3A5F", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Harga</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: p.status === "Released" ? "#38BDF8" : "#4A6A8A", marginTop: 2 }}>
                          {p.price ? fmtRupiah(p.price) : <span style={{ fontSize: 11, color: "#1E3A5F" }}>–</span>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "#1E3A5F", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Terjual</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#22C55E", marginTop: 2 }}>{p.sold || 0}</div>
                      </div>
                      {p.status === "Released" && p.price > 0 && (
                        <div>
                          <div style={{ fontSize: 9, color: "#1E3A5F", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Revenue</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#FBBF24", marginTop: 2 }}>{fmtRupiah(revenue)}</div>
                        </div>
                      )}
                    </div>

                    {/* Progress bar sold / target */}
                    {p.target > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: "#1E3A5F", fontWeight: 700, letterSpacing: "0.06em" }}>PROGRESS TARGET</span>
                          <span style={{ fontSize: 9, color: "#22C55E", fontWeight: 700 }}>{Math.min(100, Math.round(((p.sold || 0) / p.target) * 100))}%</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: Math.min(100, ((p.sold || 0) / p.target) * 100) + "%", background: "linear-gradient(90deg,#22C55E,#38BDF8)", borderRadius: 3, transition: "width 0.8s" }} />
                        </div>
                        <div style={{ fontSize: 9, color: "#1E3A5F", marginTop: 3 }}>{p.sold || 0} / {p.target} target</div>
                      </div>
                    )}

                    {p.notes && <div style={{ fontSize: 11, color: "#4A6A8A", marginTop: 8, lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 8 }}>{p.notes}</div>}
                    <div style={{ fontSize: 9, color: "#1E2D4A", marginTop: 6 }}>Ditambahkan {p.createdAt}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button className="btn-ghost" style={{ padding: "6px 10px", fontSize: 11, color: "#22C55E", borderColor: "rgba(34,197,94,0.25)" }} onClick={() => setSellModal(p)}>
                      <I n="chart" s={12} c="#22C55E" /> Jual
                    </button>
                    <button className="btn-ghost" style={{ padding: "6px 10px" }} onClick={() => { setEditItem(p); setShowModal(true); }}>
                      <I n="edit" s={12} />
                    </button>
                    <button className="btn-ghost" style={{ padding: "6px 10px", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }} onClick={() => del(p.id)}>
                      <I n="trash" s={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <ProductFormModal item={editItem} onSave={doSave} onClose={() => { setShowModal(false); setEditItem(null); }} />}
      {sellModal && <SellModal product={sellModal} onSave={doUpdateSold} onClose={() => setSellModal(null)} />}
    </div>
  );
}

function ProductFormModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item || { name: "", status: "Pending", price: "", target: "", notes: "" });
  const valid = form.name && form.status;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5" }}>{item ? "Edit Produk" : "Tambah Produk Baru"}</h3>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={onClose}><I n="close" s={13} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Fld label="Nama Produk *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nama produk..." /></Fld>
          <Fld label="Status *">
            <div style={{ display: "flex", gap: 8 }}>
              {PRODUCT_STATUSES.map(s => (
                <button key={s} className={`pill-opt ${form.status === s ? "sel" : ""}`}
                  style={form.status === s ? { borderColor: PRODUCT_STATUS_COLORS[s], background: PRODUCT_STATUS_BG[s], color: PRODUCT_STATUS_COLORS[s] } : {}}
                  onClick={() => setForm({ ...form, status: s })}>{s}</button>
              ))}
            </div>
          </Fld>
          <Fld label="Harga (Rp)">
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} placeholder="0" />
          </Fld>
          <Fld label="Target Penjualan">
            <input type="number" value={form.target} onChange={e => setForm({ ...form, target: +e.target.value })} placeholder="0 (opsional)" />
          </Fld>
          <Fld label="Catatan">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Deskripsi singkat, link, dll..." style={{ resize: "vertical" }} />
          </Fld>
          <button className="btn-primary" style={{ justifyContent: "center", marginTop: 4, opacity: valid ? 1 : 0.4 }} onClick={() => valid && onSave(form)} disabled={!valid}>
            <I n="save" s={13} /> {item ? "Update Produk" : "Simpan Produk"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SellModal({ product, onSave, onClose }) {
  const [sold, setSold] = useState(product.sold || 0);
  const [delta, setDelta] = useState(1);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E2EBF5" }}>Update Penjualan</h3>
          <button className="btn-ghost" style={{ padding: "5px 8px" }} onClick={onClose}><I n="close" s={13} /></button>
        </div>
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: "#4A6A8A", marginBottom: 4 }}>{product.name}</div>
          {product.price > 0 && <div style={{ fontSize: 11, color: "#22C55E" }}>Harga: {fmtRupiah(product.price)}</div>}
        </div>
        <Fld label="Tambah Penjualan Baru">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn-ghost" style={{ padding: "8px 14px", flexShrink: 0, fontSize: 16, fontWeight: 700 }} onClick={() => setDelta(d => Math.max(1, d - 1))}>−</button>
            <input type="number" value={delta} onChange={e => setDelta(Math.max(1, +e.target.value))} style={{ textAlign: "center" }} min={1} />
            <button className="btn-ghost" style={{ padding: "8px 14px", flexShrink: 0, fontSize: 16, fontWeight: 700 }} onClick={() => setDelta(d => d + 1)}>+</button>
          </div>
        </Fld>
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Fld label="Set Total Terjual Manual">
            <input type="number" value={sold} onChange={e => setSold(Math.max(0, +e.target.value))} min={0} />
          </Fld>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => onSave(product.id, sold + delta)}>
            <I n="plus" s={13} /> +{delta} Terjual
          </button>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => onSave(product.id, sold)}>
            <I n="save" s={13} /> Set Manual
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#1E3A5F", textAlign: "center" }}>
          Saat ini terjual: <span style={{ color: "#22C55E", fontWeight: 700 }}>{product.sold || 0}</span>
          {product.price > 0 && <> · Revenue: <span style={{ color: "#FBBF24", fontWeight: 700 }}>{fmtRupiah((product.sold || 0) * product.price)}</span></>}
        </div>
      </div>
    </div>
  );
}

// ── SHARED HELPERS ─────────────────────────────────────────────────────────────
function Fld({ label, children }) {
  return <div><div className="lbl">{label}</div>{children}</div>;
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n?.toString() || "0";
}

function fmtRupiah(n) {
  if (!n || n === 0) return "Rp 0";
  if (n >= 1000000000) return "Rp " + (n / 1000000000).toFixed(1) + "M";
  if (n >= 1000000) return "Rp " + (n / 1000000).toFixed(1) + " jt";
  if (n >= 1000) return "Rp " + (n / 1000).toFixed(0) + " rb";
  return "Rp " + n.toLocaleString("id-ID");
}
