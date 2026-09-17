"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "../../../components/auth-shell";
import { Admin, apiRequest } from "../../../lib/api";

interface DashboardData {
  data: {
    admin: Admin;
    summary: { totalUsers: number; activeUsers: number; recentActivity: number; systemStatus: string };
  };
}

const navItems = [
  { label: "Overview", icon: "grid", active: true },
  { label: "Users", icon: "users" },
  { label: "Activity", icon: "pulse" },
  { label: "Settings", icon: "settings" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData["data"] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    apiRequest<DashboardData>("/api/admin/dashboard")
      .then((response) => setData(response.data))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    try { await apiRequest("/api/auth/logout", { method: "POST", body: "{}" }, true); }
    finally { router.replace("/login"); router.refresh(); }
  }

  if (!data) return <div className="page-loader"><span className="spinner spinner-dark" /> Verifying secure session…</div>;

  const displayName = [data.admin.firstName, data.admin.lastName].filter(Boolean).join(" ") || data.admin.username;
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const cards = [
    { label: "Total Users", value: data.summary.totalUsers, note: "User management ready", icon: "users" },
    { label: "Active Users", value: data.summary.activeUsers, note: "Currently enabled", icon: "active" },
    { label: "Recent Activity", value: data.summary.recentActivity, note: "Events today", icon: "pulse" },
    { label: "System Status", value: data.summary.systemStatus, note: "All services healthy", icon: "shield" },
  ];

  return (
    <div className="dashboard-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><BrandMark /></div>
        <nav aria-label="Admin navigation">
          <p className="nav-label">WORKSPACE</p>
          {navItems.map((item) => <button key={item.label} className={`nav-item ${item.active ? "active" : ""}`} type="button"><NavIcon name={item.icon} />{item.label}</button>)}
        </nav>
        <div className="sidebar-security"><span><NavIcon name="shield" /></span><div><strong>Secure session</strong><small>Protected with enterprise security</small></div></div>
      </aside>
      {menuOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><NavIcon name="menu" /></button>
          <div><p className="header-kicker">LEEFORD ADMIN PORTAL</p><h1>Dashboard</h1></div>
          <div className="profile-area">
            <button className="profile-button" type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
              <span className="avatar">{initials}</span><span className="profile-copy"><strong>{displayName}</strong><small>{data.admin.role.replaceAll("_", " ")}</small></span><span aria-hidden="true">⌄</span>
            </button>
            {profileOpen && <div className="profile-menu"><div><strong>{displayName}</strong><small>{data.admin.email}</small></div><button type="button" onClick={logout}><NavIcon name="logout" /> Sign out</button></div>}
          </div>
        </header>
        <main className="dashboard-content">
          <section className="welcome-strip"><div><p className="eyebrow">OVERVIEW</p><h2>Welcome back, {data.admin.firstName || data.admin.username}</h2><p>Your secure administration workspace is ready.</p></div><span className="status-pill"><i /> Systems operational</span></section>
          <section className="stat-grid" aria-label="System summary">
            {cards.map((card) => <article className="stat-card" key={card.label}><span className="stat-icon"><NavIcon name={card.icon} /></span><p>{card.label}</p><strong className={typeof card.value === "string" ? "status-value" : ""}>{card.value}</strong><small>{card.note}</small></article>)}
          </section>
          <section className="dashboard-panel"><div className="panel-heading"><div><h2>Recent Activity</h2><p>Administrative events will appear here.</p></div><button type="button">View audit log</button></div><div className="empty-state"><span><NavIcon name="pulse" /></span><h3>No recent activity</h3><p>New administrative actions will be recorded securely.</p></div></section>
        </main>
      </div>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    active: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    pulse: <path d="M3 12h4l2.2-6 4.2 12 2.4-6H21"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4"/>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
