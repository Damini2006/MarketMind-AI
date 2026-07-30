import useAuth from "../../context/useAuth";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Receipt,
  Bell,
  AlertTriangle,
  Clock3,
  UserPlus,
  ClipboardList,
  Store,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ---- Design tokens ----
const ink = "#2B2A3D";
const muted = "#8683A6";
const surface = "#FFFFFF";
const border = "#ECEAF6";
const primary = "#7C6FEE";
const eggplant = "#3B2E5A";
const eggplantSoft = "#4A3B70";

const roleLabels = {
  business_owner: "Business Owner",
  store_manager: "Store Manager",
  sales_executive: "Sales Executive",
  admin: "Admin",
};

// Sales Dashboard is marked "Limited" for Sales Executive in the
// access matrix — they see their own numbers, not company-wide
// revenue or the full customer base.
const FULL_ACCESS_ROLES = ["business_owner", "store_manager", "admin"];

// ---- Mock data (swap for real API data) ----

const revenueTrend = [{ v: 10 }, { v: 14 }, { v: 12 }, { v: 18 }, { v: 16 }, { v: 22 }, { v: 20 }];
const salesTrend = [{ v: 8 }, { v: 12 }, { v: 10 }, { v: 15 }, { v: 13 }, { v: 17 }, { v: 19 }];
const customersTrend = [{ v: 6 }, { v: 9 }, { v: 8 }, { v: 12 }, { v: 15 }, { v: 14 }, { v: 18 }];
const invoiceTrend = [{ v: 5 }, { v: 7 }, { v: 6 }, { v: 9 }, { v: 8 }, { v: 11 }, { v: 9 }];

const revenueByMonth = [
  { month: "Jan", value: 4000 },
  { month: "Feb", value: 9000 },
  { month: "Mar", value: 15000 },
  { month: "Apr", value: 22000 },
  { month: "May", value: 30000 },
  { month: "Jun", value: 27000 },
];

// Company-wide KPI set (Business Owner / Store Manager / Admin)
const fullStats = [
  { title: "Revenue", value: "$24,500", change: "+12%", icon: DollarSign, tint: "#F1ECFE", accent: "#7B5CE0", trend: revenueTrend },
  { title: "Sales", value: "1,248", unit: "Orders", change: "+8%", icon: ShoppingCart, tint: "#EAF2FF", accent: "#4C7BE0", trend: salesTrend },
  { title: "Customers", value: "5,420", unit: "Users", change: "+15%", icon: Users, tint: "#E9F8F0", accent: "#2FA968", trend: customersTrend },
  { title: "Open Invoices", value: "18", change: "+3", icon: Receipt, tint: "#FFF1E9", accent: "#E07A3F", trend: invoiceTrend },
];

// Sales Executive's own scoped numbers — no company revenue, no full
// customer base, matches the "Limited" access matrix entry.
const scopedStats = [
  { title: "My Sales", value: "146", unit: "Orders", change: "+6%", icon: ShoppingCart, tint: "#EAF2FF", accent: "#4C7BE0", trend: salesTrend },
  { title: "My Customers", value: "62", unit: "Assigned", change: "+4", icon: Users, tint: "#E9F8F0", accent: "#2FA968", trend: customersTrend },
  { title: "My Invoices", value: "9", unit: "Open", change: "+2", icon: Receipt, tint: "#FFF1E9", accent: "#E07A3F", trend: invoiceTrend },
];

// Business-logic notifications only — threshold alerts and payment
// tracking, not model output. (Demand forecasting / recommendations
// are Milestone 2–3 and intentionally not shown yet.)
const notifications = [
  {
    icon: AlertTriangle,
    tint: "rgba(255,155,140,0.18)",
    accent: "#FF9B8C",
    title: "Inventory Alert",
    body: "14 products have fallen below their reorder threshold.",
  },
  {
    icon: Clock3,
    tint: "rgba(255,214,143,0.18)",
    accent: "#FFD68F",
    title: "Invoices Overdue",
    body: "3 invoices are past their payment due date.",
  },
  {
    icon: UserPlus,
    tint: "rgba(148,224,181,0.18)",
    accent: "#94E0B5",
    title: "New Customers",
    body: "5 new customers were added this week.",
  },
];

const recentTransactions = [
  { name: "Rahul Traders", category: "Electronics", amount: "$850", status: "Completed", statusTint: "#E9F8F0", statusAccent: "#2FA968" },
  { name: "ABC Store", category: "Grocery", amount: "$420", status: "Pending", statusTint: "#FFF1E9", statusAccent: "#E07A3F" },
];

// This month's order mix — plain aggregation from transaction
// records, not a prediction.
const orderStatusThisMonth = { completed: 18, total: 23 };

// ---- Shared building blocks ----

// min-w-0 is what stops a card's content (the recharts container in
// particular) from forcing the card wider than its grid column —
// without it, a wide chart can push into the neighboring column and
// visually overlap it.
const Card = ({ className = "", style, children }) => (
  <div
    className={`min-w-0 rounded-[26px] p-6 border ${className}`}
    style={{ backgroundColor: surface, borderColor: border, ...style }}
  >
    {children}
  </div>
);

const Sparkline = ({ data, stroke }) => (
  <div className="h-14 mt-4 -mx-1">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2.25} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs border"
      style={{ backgroundColor: surface, borderColor: border, boxShadow: "0 12px 24px -8px rgba(43,42,61,0.16)" }}
    >
      <p style={{ color: muted }} className="font-medium">{label}</p>
      <p style={{ color: primary }} className="font-semibold mt-0.5">
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  );
};

const StatusRing = ({ percent, label, size = 128, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="statusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9B8CFB" />
            <stop offset="100%" stopColor="#5B7FE0" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1EFFB" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#statusGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: ink }}>{percent}%</span>
        <span className="text-xs text-center px-2" style={{ color: muted }}>{label}</span>
      </div>
    </div>
  );
};

// ---- Main component ----

const Dashboard = () => {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const hasFullAccess = FULL_ACCESS_ROLES.includes(user?.role);
  const stats = hasFullAccess ? fullStats : scopedStats;
  const completedPercent = Math.round(
    (orderStatusThisMonth.completed / orderStatusThisMonth.total) * 100
  );

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-[26px] font-bold tracking-tight" style={{ color: ink }}>
          {greeting}, {user?.name ?? "there"} 
        </h1>
        <div className="flex items-center gap-3 mt-1">
          {user?.role && (
            <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: muted }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} />
              {roleLabels[user.role] ?? user.role.replace("_", " ")}
            </span>
          )}
          {!hasFullAccess && (
            <span
              className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#F1EFFB", color: primary }}
            >
              Limited view
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="min-h-[188px] hover:shadow-[0_16px_32px_-16px_rgba(43,42,61,0.14)] transition-shadow">
              <div className="p-2.5 rounded-xl w-fit" style={{ backgroundColor: item.tint, color: item.accent }}>
                <Icon size={20} />
              </div>

              <h3 className="text-sm mt-4" style={{ color: muted }}>{item.title}</h3>
              <p className="text-2xl font-bold mt-1" style={{ color: ink }}>
                {item.value}
                {item.unit && (
                  <span className="text-sm font-medium ml-1" style={{ color: muted }}>{item.unit}</span>
                )}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: "#2FA968" }}>
                ↑ {item.change} this month
              </p>

              <Sparkline data={item.trend} stroke={item.accent} />
            </Card>
          );
        })}
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Sales Performance — historical revenue trend, plain aggregation */}
        <Card className="lg:col-span-2">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: ink }}>Sales Performance</h2>
              <p className="text-sm" style={{ color: muted }}>Revenue Growth</p>
            </div>
            <button
              className="flex items-center gap-1 text-sm rounded-xl px-3 py-1.5 border shrink-0"
              style={{ color: ink, borderColor: border }}
            >
              This Year
              <span className="text-xs" style={{ color: muted }}>▾</span>
            </button>
          </div>

          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#F1EFFB" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: muted, fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: muted, fontSize: 12 }}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={primary}
                  strokeWidth={2.5}
                  fill="url(#revenueFill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Notifications — threshold alerts & payment tracking only.
            No forecast/recommendation copy: that's Milestone 2–3. */}
        <div
          className="min-w-0 rounded-[26px] p-6 text-white"
          style={{ background: `linear-gradient(160deg, ${eggplant} 0%, ${eggplantSoft} 100%)` }}
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
              <Bell size={18} />
            </div>
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>

          <div className="space-y-3">
            {notifications.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg h-fit" style={{ backgroundColor: item.tint, color: item.accent }}>
                      <Icon size={16} />
                    </div>
                    <p className="text-sm">
                      <span className="font-semibold">{item.title}</span>
                      <br />
                      <span style={{ color: "rgba(255,255,255,0.75)" }}>{item.body}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Order Status — this month's completed vs. pending mix,
            counted from actual records (not a forecast). */}
        <Card>
          <h2 className="text-lg font-semibold" style={{ color: ink }}>Order Status</h2>
          <p className="text-sm mb-6" style={{ color: muted }}>This Month</p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: "#EAF2FF", color: "#4C7BE0" }}>
                <ClipboardList size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm" style={{ color: muted }}>Completed</p>
                <p className="text-2xl font-bold" style={{ color: ink }}>
                  {orderStatusThisMonth.completed}
                  <span className="text-sm font-medium ml-1" style={{ color: muted }}>
                    / {orderStatusThisMonth.total}
                  </span>
                </p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: "#2FA968" }}>
                  ↑ on pace with last month
                </p>
              </div>
            </div>

            <StatusRing percent={completedPercent} label="Completed" />
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold" style={{ color: ink }}>Recent Transactions</h2>
            <a href="#" className="text-sm font-medium shrink-0" style={{ color: primary }}>View All</a>
          </div>

          <div className="space-y-1">
            {recentTransactions.map((sale) => (
              <div
                key={sale.name}
                className="flex items-center justify-between gap-4 p-3 rounded-2xl transition"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9F8FC")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: "#EAF2FF", color: "#4C7BE0" }}>
                    <Store size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: ink }}>{sale.name}</p>
                    <p className="text-sm truncate" style={{ color: muted }}>{sale.category}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <span className="font-semibold" style={{ color: ink }}>{sale.amount}</span>
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: sale.statusTint, color: sale.statusAccent }}
                  >
                    {sale.status}
                  </span>
                  <button style={{ color: muted }}>⋮</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;