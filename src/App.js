import React, { useEffect, useState } from "react";
import "./App.css";
import ParanaNetworkMap from "./ParanaNetworkMap";
import AdminConsole from "./admin/AdminConsole";
import DebugGlpiId from "./DebugGlpiId";
import Dashboard from "./Dashboard";

// Client-side guard for CRA dev: if not authenticated, show a fallback with a manual link to /Login
// Prefer same-origin; in CRA dev (port 3000) point explicitly to backend 5000 to reach /Login assets.
const resolveApiBase = () => {
  const candidate = process.env.REACT_APP_API_URL
    ? String(process.env.REACT_APP_API_URL).replace(/\/$/, "")
    : "";

  if (typeof window !== "undefined") {
    const hostname = window.location && window.location.hostname;
    const isPublicTunnel = /\.trycloudflare\.com$/i.test(hostname || "");
    const isLocalCandidate = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(candidate);

    // No Cloudflare quick tunnel, NUNCA aponte o browser para localhost:5000
    // (isso vira o localhost do visitante e também cria CORS).
    if (isPublicTunnel && isLocalCandidate) return "";
    // Prefer same-origin por padrão (CRA proxy / mesma origem).
    return candidate || "";
  }

  return candidate || "";
};

const API_BASE = resolveApiBase();

function App() {
  const [authStatus, setAuthStatus] = useState("loading"); // loading | ok | fail

  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === "undefined") return;
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (res.ok) {
          setAuthStatus("ok");
          return;
        }
      } catch (e) {
        // ignore; will fall through to fail state
      }
      setAuthStatus("fail");
      // still attempt redirect, but keep UI visible — use relative path to preserve origin
      const next = encodeURIComponent(window.location.pathname || "/");
      window.location.href = `/Login/?next=${next}`;
    };
    checkAuth();
  }, []);

  if (authStatus === "loading") return null;

  if (authStatus === "fail") {
    const next = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname || "/") : "%2F";
    const loginUrl = `/Login/?next=${next}`;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "12px", fontFamily: "sans-serif" }}>
        <h2>Redirecionando para login…</h2>
        <p>Se não redirecionar, clique no botão abaixo.</p>
        <a href={loginUrl} style={{ padding: "10px 16px", background: "#2563eb", color: "white", borderRadius: "8px", textDecoration: "none" }}>Ir para Login</a>
      </div>
    );
  }

  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/glpi_id") return <DebugGlpiId />;
  if (path === "/dashboard") return <Dashboard />;
  if (path === "/admin") return <AdminConsole apiBaseUrl={API_BASE} />;
  return <ParanaNetworkMap />;
}

export default App;
