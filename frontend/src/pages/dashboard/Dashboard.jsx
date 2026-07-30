import useAuth from "../../context/useAuth";
import "../../styles/dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <div className="overview-card">
        <h2>Overview</h2>
        <p>
          Welcome to MarketMind AI! Below is a summary of the metrics available to your role.
        </p>
        {user?.role && (
          <span className="role-tag">{user.role.replace("_", " ")}</span>
        )}
      </div>

      <div className="stats-grid">
        {/* Sales Widget - Visible to all, but restricted actions for some */}
        <div className="stat-card">
          <div className="icon-box blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l6-6 4 4 8-8" stroke="#7C9CF5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 7h6v6" stroke="#7C9CF5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Sales summary</h3>
          <p className="stat-value">$24,500</p>
          <p className="stat-trend up">↑ 12% from last month</p>
        </div>

        {/* Inventory Widget */}
        {["business_owner", "store_manager", "admin"].includes(user?.role) && (
          <div className="stat-card">
            <div className="icon-box orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 2 7l10 5 10-5-10-5Z" stroke="#F97316" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Low Stock Alerts</h3>
            <p className="stat-value">14</p>
            <p className="stat-trend warn">Requires immediate attention</p>
          </div>
        )}

        {/* Forecast Widget */}
        {["business_owner", "admin"].includes(user?.role) && (
          <div className="stat-card">
            <div className="icon-box purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Revenue Forecast</h3>
            <p className="stat-value">$32,100</p>
            <p className="stat-trend neutral">Projected for next month</p>
          </div>
        )}

        {/* Churn Prediction Widget */}
        {["business_owner", "admin"].includes(user?.role) && (
          <div className="stat-card">
            <div className="icon-box red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z" stroke="#EF4444" strokeWidth="2"/>
              </svg>
            </div>
            <h3>High Risk Customers</h3>
            <p className="stat-value">8</p>
            <p className="stat-trend alert">Action recommended</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
