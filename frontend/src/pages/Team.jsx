import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import api from "../services/api";
import { PageHeader, ErrorBanner, Loading } from "../components/ui";

const ROLES = [
  { value: "store_manager", label: "Store Manager" },
  { value: "sales_executive", label: "Sales Executive" },
  { value: "admin", label: "System Administrator" },
];

export default function Team() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role_name: "sales_executive",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startFetching() {
      try {
        const res = await api.get("/users/");
        if (!cancelled) setUsers(res.data);
      } catch {
        if (!cancelled) setError("Failed to fetch team members.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    startFetching();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/users/", form);
      setUsers([...users, res.data]);
      setShowModal(false);
      setForm({ full_name: "", email: "", password: "", role_name: "sales_executive" });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to remove user");
    }
  };

  const ROLE_LABELS = {
    business_owner: "Business Owner",
    store_manager: "Store Manager",
    sales_executive: "Sales Executive",
    admin: "System Administrator",
  };

  return (
    <div>
      <PageHeader
        title="Team Management"
        subtitle="Manage your employees and their roles."
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Invite Member
          </button>
        }
      />

      <ErrorBanner message={error} />

      {loading ? (
        <div className="flex justify-center p-8">
          <Loading />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium">{u.full_name}</td>
                  <td className="py-3 px-4">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {u.role !== "business_owner" && (
                      <button
                        onClick={() => handleRemove(u.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Invite Team Member</h3>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  required
                  className="input"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Email</label>
                <input
                  required
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Password</label>
                <input
                  required
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Role</label>
                <select
                  className="input"
                  value={form.role_name}
                  onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Inviting..." : "Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
