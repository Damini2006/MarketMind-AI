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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-indigo-800 text-center">
          MarketMind AI
        </div>
        <div className="p-4 text-sm text-indigo-200">
          Welcome, {user?.name}
          <br />
          <span className="capitalize opacity-75">{user?.role?.replace("_", " ")}</span>
        </div>
        <nav className="flex-1 mt-4 space-y-2 px-2 overflow-y-auto">
          {navItems.map(
            (item) =>
              item.roles.includes(user?.role) && (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`block px-4 py-2 rounded transition-colors ${
                    location.pathname === item.path
                      ? "bg-indigo-700 font-semibold"
                      : "hover:bg-indigo-800"
                  }`}
                >
                  {item.name}
                </Link>
              )
          )}
        </nav>
        <div className="p-4 border-t border-indigo-800">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 hover:bg-indigo-800 rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center px-6">
          <h2 className="text-xl font-semibold text-gray-800 capitalize">
            {location.pathname.split("/").pop() || "Dashboard"}
          </h2>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
