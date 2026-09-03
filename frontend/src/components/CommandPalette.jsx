import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, LayoutDashboard, ShoppingCart, Boxes, FileText, Users,
  UsersRound, Tags, Truck, Database, TrendingUp, PieChart, UserMinus,
  Sparkles, ShieldAlert, ClipboardList, GitCompare, IndianRupee,
  Settings, Moon, Sun, X, ArrowRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Pages' },
  { to: '/sales', label: 'Sales', icon: ShoppingCart, category: 'Pages' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, category: 'Pages' },
  { to: '/invoices', label: 'Invoices', icon: FileText, category: 'Pages' },
  { to: '/customers', label: 'Customers', icon: Users, category: 'Pages' },
  { to: '/team', label: 'Team', icon: UsersRound, category: 'Pages' },
  { to: '/categories', label: 'Categories', icon: Tags, category: 'Pages' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, category: 'Pages' },
  { to: '/datasets', label: 'Datasets', icon: Database, category: 'Pages' },
  { to: '/forecasting', label: 'Forecasting', icon: TrendingUp, category: 'AI' },
  { to: '/segmentation', label: 'Segmentation', icon: PieChart, category: 'AI' },
  { to: '/churn', label: 'Churn Risk', icon: UserMinus, category: 'AI' },
  { to: '/recommendations', label: 'Recommendations', icon: Sparkles, category: 'AI' },
  { to: '/anomalies', label: 'Anomaly Alerts', icon: ShieldAlert, category: 'AI' },
  { to: '/comparison', label: 'Compare Periods', icon: GitCompare, category: 'Analytics' },
  { to: '/revenue-prediction', label: 'Revenue Prediction', icon: IndianRupee, category: 'Analytics' },
  { to: '/activity', label: 'Activity Log', icon: ClipboardList, category: 'Analytics' },
  { to: '/settings', label: 'Settings', icon: Settings, category: 'Account' },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return NAV_ITEMS;
    const q = query.toLowerCase();
    return NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.to.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {Object.entries(grouped).length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No results found</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-2">
                <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {category}
                </p>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      onClick={() => {
                        navigate(item.to);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <Icon size={16} className="text-slate-400 group-hover:text-indigo-500" />
                      <span className="flex-1 text-left">{t(`nav.${item.to.replace('/', '')}`, item.label)}</span>
                      <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[10px] text-slate-400">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
