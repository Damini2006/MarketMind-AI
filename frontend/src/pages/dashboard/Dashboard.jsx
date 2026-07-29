import useAuth from "../../context/useAuth";

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Overview
        </h2>
        <p className="text-gray-600">
          Welcome to MarketMind AI! Below is a summary of the metrics available to your role.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sales Widget - Visible to all, but restricted actions for some */}
        <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-800">Sales summary</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">$24,500</p>
          <p className="text-sm text-green-600 mt-2">↑ 12% from last month</p>
        </div>

        {/* Inventory Widget */}
        {["business_owner", "store_manager", "admin"].includes(user?.role) && (
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-orange-500">
            <h3 className="text-lg font-semibold text-gray-800">Low Stock Alerts</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">14</p>
            <p className="text-sm text-red-600 mt-2">Requires immediate attention</p>
          </div>
        )}

        {/* Forecast Widget */}
        {["business_owner", "admin"].includes(user?.role) && (
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-purple-500">
            <h3 className="text-lg font-semibold text-gray-800">Revenue Forecast</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">$32,100</p>
            <p className="text-sm text-gray-500 mt-2">Projected for next month</p>
          </div>
        )}

        {/* Churn Prediction Widget */}
        {["business_owner", "admin"].includes(user?.role) && (
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-red-500">
            <h3 className="text-lg font-semibold text-gray-800">High Risk Customers</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">8</p>
            <p className="text-sm text-gray-500 mt-2">Action recommended</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
