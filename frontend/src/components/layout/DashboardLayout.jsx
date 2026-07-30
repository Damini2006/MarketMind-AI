import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import useAuth from "../../context/useAuth";
import {
  Brain,
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Receipt,
  Settings,
  LogOut,
  Calendar,
  Bell,
  ChevronDown,
  
} from "lucide-react";
 
// ---- Design tokens ----
const ink = "#2B2A3D";
const muted = "#8683A6";
const surface = "#FFFFFF";
const appBg = "#F7F6FC";
const border = "#ECEAF6";
const primary = "#7C6FEE";

 
// ---- Nav items, gated by the Access Matrix in the project brief ----
// NOTE: Analytics / AI Forecast are intentionally left out for now —
// those belong to the Forecasting & Recommendation modules, which are
// Milestone 2 / 3 work. Only Milestone 1 modules (RBAC, sales
// dashboard, inventory, customers, invoices, reports) are wired up.
const navItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    // Sales Dashboard: BO Yes, SM Yes, SE Limited, Admin Yes
    roles: ["business_owner", "store_manager", "sales_executive", "admin"],
  },
  {
    name: "Inventory",
    path: "/dashboard/inventory",
    icon: Package,
    // Inventory Management: BO View, SM Yes, SE No, Admin Yes
    roles: ["business_owner", "store_manager", "admin"],
  },
  {
    name: "Customers",
    path: "/dashboard/customers",
    icon: Users,
    // Customer Segmentation: BO Yes, SM Yes, SE Limited, Admin Yes
    roles: ["business_owner", "store_manager", "sales_executive", "admin"],
  },
  {
    name: "Invoices",
    path: "/dashboard/invoices",
    icon: Receipt,
    // Invoice Management: BO View, SM View, SE Yes, Admin Yes
    // (previously missing business_owner / store_manager — fixed)
    roles: ["business_owner", "store_manager", "sales_executive", "admin"],
  },
  {
    name: "Reports",
    path: "/dashboard/reports",
    icon: FileText,
    // BO exports business reports, SM generates operational reports,
    // SE accesses personal sales reports, Admin has full access.
    // (previously missing store_manager — fixed)
    roles: ["business_owner", "store_manager", "sales_executive", "admin"],
  },
];
 
const bottomNavItems = [
  {
    name: "Settings",
    path: "/dashboard/settings",
    icon: Settings,
    // Platform administration is admin-only, no exceptions.
    roles: ["admin"],
  },
];
 
const pageTitles = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  customers: "Customers",
  invoices: "Invoices",
  reports: "Reports",
  settings: "Settings",
};
 
const Avatar = ({ name }) => {
  const initial = name?.charAt(0)?.toUpperCase() ?? "?";
  return (
    <div
      className="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold text-sm shrink-0"
      style={{ backgroundColor: primary }}
    >
      {initial}
    </div>
  );
};
 
const NavLink = ({ item, active }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all"
      style={
        active
          ? { backgroundColor: primary, color: "#fff", boxShadow: "0 8px 16px -6px rgba(124,111,238,0.45)" }
          : { color: muted }
      }
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "#F1EFFB";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <Icon size={18} />
      {item.name}
    </Link>
  );
};
 
const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
 
  const handleLogout = () => {
    logout();
    navigate("/");
  };
 
  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role)
  );
  const visibleBottomItems = bottomNavItems.filter((item) =>
    item.roles.includes(user?.role)
  );
 
  const slug =
    location.pathname.split("/").filter(Boolean).pop() || "dashboard";
  const pageTitle = pageTitles[slug] ?? "Dashboard";
 
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
 
  return (
    // overflow-hidden keeps the whole app pinned to the viewport so
    // tall page content can't stretch this container and drag the
    // sidebar's bottom section out of view.
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: appBg }}>
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col shrink-0 border-r"
        style={{ backgroundColor: surface, borderColor: border }}
      >
        {/* Brand */}
        <div className="px-6 py-6 flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ backgroundColor: "#F1EFFB", color: primary }}>
            <Brain size={20} />
          </div>
          <h1 className="text-[17px] font-bold tracking-tight" style={{ color: ink }}>
            MarketMind <span style={{ color: primary }}>AI</span>
          </h1>
        </div>
 
        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-4 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink key={item.name} item={item} active={location.pathname === item.path} />
          ))}
        </nav>
 
        {/* Lower nav: settings / logout */}
        <div className="px-4 space-y-1 pt-2">
          {visibleBottomItems.map((item) => (
            <NavLink key={item.name} item={item} active={location.pathname === item.path} />
          ))}
 
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-2xl text-sm font-medium transition"
            style={{ color: muted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#FFF0EE";
              e.currentTarget.style.color = "#E0654F";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = muted;
            }}
          >
            <LogOut size={25} />
            Logout
          </button>
        </div>
 
        
      </aside>
 
      {/* Main Area */}
      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Top Navbar */}
        <header
          className="h-[72px] shrink-0 flex items-center justify-between px-8 border-b"
          style={{ backgroundColor: surface, borderColor: border }}
        >
          <h2 className="text-xl font-bold tracking-tight" style={{ color: ink }}>
            {pageTitle}
          </h2>
 
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-sm" style={{ color: muted }}>
              <Calendar size={16} />
              {today}
            </div>
 
            <button className="relative" style={{ color: muted }}>
              <Bell size={20} />
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center"
                style={{ backgroundColor: "#FF6B6B" }}
              >
                3
              </span>
            </button>
 
            <button className="flex items-center gap-2">
              <Avatar name={user?.name} />
              <ChevronDown size={16} style={{ color: muted }} />
            </button>
          </div>
        </header>
 
        {/* Page Content — the scroll container, not the page itself */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto px-8 py-7">
          <Outlet />
        </main>
      </section>
    </div>
  );
};
 
export default DashboardLayout;