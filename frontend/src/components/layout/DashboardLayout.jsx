import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import useAuth from "../../context/useAuth";

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", roles: ["business_owner", "store_manager", "sales_executive", "admin"] },
    { name: "Inventory", path: "/dashboard/inventory", roles: ["business_owner", "store_manager", "admin"] },
    { name: "Forecast Reports", path: "/dashboard/forecast", roles: ["business_owner", "admin"] },
    { name: "Customer Segmentation", path: "/dashboard/segmentation", roles: ["business_owner", "store_manager", "admin"] },
    { name: "Recommendation Insights", path: "/dashboard/recommendations", roles: ["business_owner", "store_manager", "sales_executive", "admin"] },
    { name: "Invoices", path: "/dashboard/invoices", roles: ["sales_executive", "admin"] },
    { name: "User Management", path: "/dashboard/users", roles: ["admin"] },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-6 text-2xl font-extrabold text-indigo-600 tracking-tight">
          MarketMind AI
        </div>
        <div className="px-6 pb-4 text-sm text-gray-500">
          Welcome, <span className="font-semibold text-gray-700">{user?.name}</span>
          <br />
          <span className="capitalize text-indigo-500 font-medium text-xs bg-indigo-50 px-2 py-1 rounded-full mt-2 inline-block">
            {user?.role?.replace("_", " ")}
          </span>
        </div>
        <nav className="flex-1 mt-6 space-y-3 px-4 overflow-y-auto">
          {navItems.map(
            (item) =>
              item.roles.includes(user?.role) && (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`block px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm ${
                    location.pathname === item.path
                      ? "bg-indigo-50 text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:bg-indigo-50/50 hover:text-indigo-600 hover:translate-x-1.5"
                  }`}
                >
                  {item.name}
                </Link>
              )
          )}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center px-8 z-10">
          <h2 className="text-xl font-bold text-gray-800 capitalize tracking-tight">
            {location.pathname.split("/").pop() || "Dashboard"}
          </h2>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
