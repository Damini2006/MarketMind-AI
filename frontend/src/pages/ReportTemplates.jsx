import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { Loading, PageHeader, Badge } from '../components/ui.jsx'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'
import {
  FileText, Download, Eye, Settings, CheckCircle2, BarChart3,
  ShoppingCart, Users, Boxes, IndianRupee, Calendar, Plus, Trash2,
  LayoutTemplate, Copy, X,
} from 'lucide-react'

// ─── Built-in report templates ────────────────────────────────────────
const BUILTIN_TEMPLATES = [
  {
    id: 'sales-summary',
    name: 'Sales Summary',
    description: 'Total sales, revenue, top products, and trends',
    icon: ShoppingCart,
    color: 'indigo',
    sections: ['kpi_cards', 'top_products', 'sales_by_date', 'recent_sales'],
    category: 'Sales',
  },
  {
    id: 'inventory-status',
    name: 'Inventory Status',
    description: 'Stock levels, low-stock alerts, and product catalog',
    icon: Boxes,
    color: 'amber',
    sections: ['kpi_cards', 'low_stock_alerts', 'product_list', 'category_breakdown'],
    category: 'Inventory',
  },
  {
    id: 'customer-analysis',
    name: 'Customer Analysis',
    description: 'Customer segments, CLV predictions, and engagement',
    icon: Users,
    color: 'blue',
    sections: ['kpi_cards', 'segment_breakdown', 'top_customers', 'clv_analysis'],
    category: 'Customers',
  },
  {
    id: 'financial-overview',
    name: 'Financial Overview',
    description: 'Revenue, expenses, invoices, and cash flow',
    icon: IndianRupee,
    color: 'green',
    sections: ['kpi_cards', 'revenue_trend', 'invoice_status', 'expense_breakdown'],
    category: 'Finance',
  },
  {
    id: 'anomaly-report',
    name: 'Anomaly Report',
    description: 'Detected anomalies, severity breakdown, and trends',
    icon: BarChart3,
    color: 'red',
    sections: ['anomaly_summary', 'severity_breakdown', 'top_anomalies', 'timeline'],
    category: 'Analytics',
  },
  {
    id: 'executive-dashboard',
    name: 'Executive Dashboard',
    description: 'High-level KPIs and business health overview',
    icon: LayoutTemplate,
    color: 'purple',
    sections: ['kpi_cards', 'business_pulse', 'revenue_trend', 'top_products', 'segment_breakdown'],
    category: 'Executive',
  },
]

const SECTION_LABELS = {
  kpi_cards: 'Key Performance Indicators',
  top_products: 'Top Products by Revenue',
  sales_by_date: 'Sales by Date',
  recent_sales: 'Recent Sales Transactions',
  low_stock_alerts: 'Low Stock Alerts',
  product_list: 'Product Catalog',
  category_breakdown: 'Category Breakdown',
  segment_breakdown: 'Customer Segments',
  top_customers: 'Top Customers',
  clv_analysis: 'Customer Lifetime Value',
  revenue_trend: 'Revenue Trend',
  invoice_status: 'Invoice Status',
  expense_breakdown: 'Expense Breakdown',
  anomaly_summary: 'Anomaly Summary',
  severity_breakdown: 'Severity Breakdown',
  top_anomalies: 'Top Anomalies',
  timeline: 'Anomaly Timeline',
  business_pulse: 'Business Health Score',
}

// ─── Preview Panel ────────────────────────────────────────────────────
function ReportPreview({ template, data, format }) {
  if (!data) return <div className="text-center py-10 text-slate-400">Loading preview data...</div>

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Report Header */}
      <div className="bg-indigo-600 text-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <template.icon size={24} />
          <h2 className="text-xl font-bold">{template.name}</h2>
        </div>
        <p className="text-indigo-200 text-sm">{template.description}</p>
        <p className="text-indigo-300 text-xs mt-2">Generated: {new Date().toLocaleString()} · MarketMind AI</p>
      </div>

      {/* Report Sections */}
      <div className="p-6 space-y-6">
        {template.sections.map((sectionKey) => (
          <PreviewSection key={sectionKey} sectionKey={sectionKey} data={data} />
        ))}
      </div>

      {/* Report Footer */}
      <div className="bg-slate-50 dark:bg-slate-800 px-6 py-3 border-t border-slate-200 dark:border-slate-700">
        <p className="text-[10px] text-slate-400 text-center">
          MarketMind AI — {template.name} Report — Page 1 of 1
        </p>
      </div>
    </div>
  )
}

function PreviewSection({ sectionKey, data }) {
  const label = SECTION_LABELS[sectionKey] || sectionKey

  const renderContent = () => {
    switch (sectionKey) {
      case 'kpi_cards':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPIPreview label="Total Revenue" value={`₹${(data.kpis?.total_revenue || 0).toLocaleString('en-IN')}`} color="text-emerald-600" />
            <KPIPreview label="Total Sales" value={data.kpis?.total_sales || 0} color="text-indigo-600" />
            <KPIPreview label="Customers" value={data.kpis?.total_customers || 0} color="text-blue-600" />
            <KPIPreview label="Products" value={data.kpis?.total_products || 0} color="text-purple-600" />
          </div>
        )
      case 'top_products':
        return (
          <div className="space-y-2">
            {(data.kpis?.top_products || []).slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.product}</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">₹{Number(p.revenue || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )
      case 'sales_by_date':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 text-slate-500">Date</th>
                  <th className="text-right py-2 text-slate-500">Sales</th>
                  <th className="text-right py-2 text-slate-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data.salesByDate || []).slice(0, 7).map((d, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-1.5 text-slate-600 dark:text-slate-400">{d.date}</td>
                    <td className="py-1.5 text-right font-medium">{d.count}</td>
                    <td className="py-1.5 text-right font-medium text-emerald-600">₹{Number(d.revenue || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'recent_sales':
        return (
          <div className="space-y-1">
            {(data.recentSales || []).slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-slate-500">{s.date}</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{s.product}</span>
                <span className="font-semibold">₹{Number(s.amount || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )
      case 'low_stock_alerts':
        return (
          <div className="space-y-2">
            {(data.lowStock || []).slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-bold">{p.stock} left</span>
                  <Badge tone="red">Low</Badge>
                </div>
              </div>
            ))}
          </div>
        )
      case 'product_list':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 text-slate-500">Product</th>
                  <th className="text-left py-2 text-slate-500">Category</th>
                  <th className="text-right py-2 text-slate-500">Price</th>
                  <th className="text-right py-2 text-slate-500">Stock</th>
                </tr>
              </thead>
              <tbody>
                {(data.products || []).slice(0, 8).map((p, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-1.5 font-medium">{p.name}</td>
                    <td className="py-1.5 text-slate-500">{p.category || '—'}</td>
                    <td className="py-1.5 text-right">₹{p.price}</td>
                    <td className="py-1.5 text-right">
                      <span className={p.stock_quantity <= p.reorder_threshold ? 'text-red-600 font-bold' : ''}>{p.stock_quantity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'segment_breakdown':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['high', 'medium', 'low', 'at_risk'].map(seg => (
              <div key={seg} className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-lg font-bold">{data.clvSummary?.[`${seg}_value`] || data.clvSummary?.[seg] || 0}</p>
                <p className="text-[10px] text-slate-500 capitalize">{seg.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        )
      case 'top_customers':
        return (
          <div className="space-y-2">
            {(data.topCustomers || []).slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                </div>
                <span className="text-sm font-bold text-indigo-600">₹{Number(c.total_spent || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )
      case 'clv_analysis':
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
              <p className="text-lg font-bold text-indigo-600">₹{Number(data.clvSummary?.avg_clv || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-500">Avg CLV</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
              <p className="text-lg font-bold text-emerald-600">{data.clvSummary?.high_value || 0}</p>
              <p className="text-[10px] text-slate-500">High Value</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <p className="text-lg font-bold text-red-600">{data.clvSummary?.at_risk || 0}</p>
              <p className="text-[10px] text-slate-500">At Risk</p>
            </div>
          </div>
        )
      case 'revenue_trend':
        return (
          <div className="space-y-1">
            {(data.revenueByDay || []).slice(-7).map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 w-20">{d.date}</span>
                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (d.revenue / Math.max(...data.revenueByDay.map(x => x.revenue || 1))) * 100)}%` }} />
                </div>
                <span className="font-medium w-20 text-right">₹{Number(d.revenue || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )
      case 'invoice_status':
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <p className="text-lg font-bold text-green-600">{data.invoices?.paid || 0}</p>
              <p className="text-[10px] text-slate-500">Paid</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <p className="text-lg font-bold text-amber-600">{data.invoices?.pending || 0}</p>
              <p className="text-[10px] text-slate-500">Pending</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <p className="text-lg font-bold text-red-600">{data.invoices?.overdue || 0}</p>
              <p className="text-[10px] text-slate-500">Overdue</p>
            </div>
          </div>
        )
      case 'expense_breakdown':
        return <p className="text-xs text-slate-400 italic">Expense data available with accounting integration.</p>
      case 'anomaly_summary':
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <p className="text-lg font-bold text-red-600">{data.anomalies?.total || 0}</p>
              <p className="text-[10px] text-slate-500">Total</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <p className="text-lg font-bold text-amber-600">{data.anomalies?.high || 0}</p>
              <p className="text-[10px] text-slate-500">High</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <p className="text-lg font-bold text-blue-600">{data.anomalies?.accuracy || '—'}</p>
              <p className="text-[10px] text-slate-500">Accuracy</p>
            </div>
          </div>
        )
      case 'severity_breakdown':
        return (
          <div className="space-y-2">
            {['high', 'medium', 'low'].map(sev => (
              <div key={sev} className="flex items-center gap-2">
                <span className="text-xs font-medium capitalize w-16">{sev}</span>
                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${sev === 'high' ? 'bg-red-500' : sev === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${((data.anomalies?.[sev] || 0) / Math.max(data.anomalies?.total || 1, 1)) * 100}%` }} />
                </div>
                <span className="text-xs font-bold w-6 text-right">{data.anomalies?.[sev] || 0}</span>
              </div>
            ))}
          </div>
        )
      case 'top_anomalies':
        return (
          <div className="space-y-1">
            {(data.topAnomalies || []).slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                <Badge tone={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'blue'}>{a.severity}</Badge>
                <span className="text-slate-600 dark:text-slate-400 flex-1 mx-2 truncate">{a.description}</span>
                <span className="text-slate-500">{a.confidence}%</span>
              </div>
            ))}
          </div>
        )
      case 'timeline':
        return <p className="text-xs text-slate-400 italic">See full timeline in Anomaly Detection page.</p>
      case 'business_pulse':
        return (
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-3xl font-bold text-indigo-600">{data.pulse?.score || '—'}</p>
            <p className="text-xs text-slate-500 mt-1">Business Health Score</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{data.pulse?.band || 'N/A'}</p>
          </div>
        )
      default:
        return <p className="text-xs text-slate-400">Section data not available.</p>
    }
  }

  return (
    <div>
      <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <CheckCircle2 size={12} className="text-green-500" />
        {label}
      </h3>
      {renderContent()}
    </div>
  )
}

function KPIPreview({ label, value, color }) {
  return (
    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function ReportTemplates() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState([])

  // Load saved templates from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('reportTemplates') || '[]')
      setSavedTemplates(saved)
    } catch { /* ignore */ }
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/analytics/kpis').catch(() => ({ data: {} })),
      api.get('/sales/').catch(() => ({ data: [] })),
      api.get('/inventory/products').catch(() => ({ data: [] })),
      api.get('/customers/').catch(() => ({ data: [] })),
      api.get('/invoices/').catch(() => ({ data: [] })),
      api.get('/ai/anomalies').catch(() => ({ data: { alerts: [] } })),
      api.get('/ai/clv').catch(() => ({ data: {} })),
      api.get('/analytics/pulse').catch(() => ({ data: {} })),
    ]).then(([kpis, sales, products, customers, invoices, anomalies, clv, pulse]) => {
      const salesData = Array.isArray(sales.data) ? sales.data : []
      const productsData = Array.isArray(products.data) ? products.data : []
      const customersData = Array.isArray(customers.data) ? customers.data : []
      const invoiceData = Array.isArray(invoices.data) ? invoices.data : (invoices.data?.items || [])
      const alerts = Array.isArray(anomalies.data?.alerts) ? anomalies.data.alerts : []

      // Build sales by date
      const salesByDate = {}
      salesData.forEach(s => {
        const d = s.sale_date?.slice(0, 10) || 'unknown'
        if (!salesByDate[d]) salesByDate[d] = { date: d, count: 0, revenue: 0 }
        salesByDate[d].count++
        salesByDate[d].revenue += s.total_amount || 0
      })

      // Build revenue by day
      const revenueByDay = Object.values(salesByDate).sort((a, b) => a.date.localeCompare(b.date))

      // Build recent sales
      const recentSales = salesData
        .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
        .slice(0, 10)
        .map(s => ({
          date: s.sale_date?.slice(0, 10),
          product: productsData.find(p => p.id === s.product_id)?.name || `#${s.product_id}`,
          amount: s.total_amount,
        }))

      // Build low stock
      const lowStock = productsData
        .filter(p => p.stock_quantity <= p.reorder_threshold)
        .map(p => ({ name: p.name, stock: p.stock_quantity }))

      // Build top customers
      const customerSpending = {}
      salesData.forEach(s => {
        if (!customerSpending[s.customer_id]) customerSpending[s.customer_id] = { total: 0 }
        customerSpending[s.customer_id].total += s.total_amount || 0
      })
      const topCustomers = Object.entries(customerSpending)
        .map(([id, data]) => ({
          name: customersData.find(c => c.id === Number(id))?.name || `#${id}`,
          total_spent: data.total,
        }))
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10)

      // Build anomaly data
      const anomalyCounts = { total: alerts.length, high: 0, medium: 0, low: 0 }
      alerts.forEach(a => { if (anomalyCounts[a.severity] !== undefined) anomalyCounts[a.severity]++ })

      // Invoice counts
      const invoiceCounts = { paid: 0, pending: 0, overdue: 0 }
      invoiceData.forEach(inv => { if (invoiceCounts[inv.status] !== undefined) invoiceCounts[inv.status]++ })

      // Convert salesByDate object to sorted array
      const salesByDateArr = Object.values(salesByDate).sort((a, b) => a.date.localeCompare(b.date))

      setData({
        kpis: kpis.data,
        salesByDate: salesByDateArr,
        revenueByDay,
        recentSales,
        lowStock,
        products: productsData,
        topCustomers,
        clvSummary: clv.data?.summary || {},
        anomalies: {
          ...anomalyCounts,
          accuracy: anomalies.data?.detection_accuracy ? `${(anomalies.data.detection_accuracy * 100).toFixed(0)}%` : '—',
        },
        topAnomalies: alerts.slice(0, 10),
        invoices: invoiceCounts,
        pulse: pulse.data || {},
      })
    })
    .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const allTemplates = [...BUILTIN_TEMPLATES, ...savedTemplates]

  const handlePreview = (template) => {
    setSelectedTemplate(template)
    setShowPreview(true)
  }

  const handleExportPDF = () => {
    if (!selectedTemplate || !data) return
    const headers = ['Section', 'Details']
    const rows = selectedTemplate.sections.map(s => [SECTION_LABELS[s] || s, 'Included'])
    exportToPDF({
      title: selectedTemplate.name + ' Report',
      subtitle: selectedTemplate.description,
      headers,
      rows,
      filename: `${selectedTemplate.id}-report`,
    })
  }

  const handleExportExcel = () => {
    if (!selectedTemplate || !data) return
    const headers = ['Section', 'Details']
    const rows = selectedTemplate.sections.map(s => [SECTION_LABELS[s] || s, 'Included'])
    exportToExcel({
      title: selectedTemplate.name + ' Report',
      headers,
      rows,
      filename: `${selectedTemplate.id}-report`,
    })
  }

  const handleSaveCustomTemplate = () => {
    const name = prompt('Enter template name:')
    if (!name) return
    const newTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description: 'Custom report template',
      icon: FileText,
      color: 'slate',
      sections: ['kpi_cards', 'top_products'],
      category: 'Custom',
      builtin: false,
    }
    const updated = [...savedTemplates, newTemplate]
    setSavedTemplates(updated)
    localStorage.setItem('reportTemplates', JSON.stringify(updated))
  }

  const handleDeleteTemplate = (templateId) => {
    const updated = savedTemplates.filter(t => t.id !== templateId)
    setSavedTemplates(updated)
    localStorage.setItem('reportTemplates', JSON.stringify(updated))
  }

  if (loading) return <Loading label="Loading report data..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Report Templates"
        subtitle={`${allTemplates.length} templates available · Click to preview and export`}
        action={
          <button onClick={handleSaveCustomTemplate} className="btn-primary flex items-center gap-2 text-xs">
            <Plus size={14} /> New Template
          </button>
        }
      />

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allTemplates.map((template) => {
          const Icon = template.icon || FileText
          const colorMap = {
            indigo: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 border-indigo-200 dark:border-indigo-800',
            amber: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-amber-200 dark:border-amber-800',
            blue: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 border-blue-200 dark:border-blue-800',
            green: 'bg-green-50 dark:bg-green-950/20 text-green-600 border-green-200 dark:border-green-800',
            red: 'bg-red-50 dark:bg-red-950/20 text-red-600 border-red-200 dark:border-red-800',
            purple: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 border-purple-200 dark:border-purple-800',
            slate: 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700',
          }
          return (
            <div key={template.id} className={`card hover:shadow-md transition-all cursor-pointer border-2 ${colorMap[template.color] || colorMap.slate}`}
              onClick={() => handlePreview(template)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={20} />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{template.name}</h3>
                    <Badge tone="slate">{template.category}</Badge>
                  </div>
                </div>
                {!template.builtin && template.id.startsWith('custom-') && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id) }}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{template.description}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {template.sections.slice(0, 3).map(s => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 bg-white/80 dark:bg-slate-800/80 rounded text-slate-500">{SECTION_LABELS[s]}</span>
                ))}
                {template.sections.length > 3 && (
                  <span className="text-[9px] text-slate-400">+{template.sections.length - 3} more</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                <button className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                  <Eye size={10} /> Preview
                </button>
                <button className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  <Download size={10} /> Export
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <LayoutTemplate size={20} className="text-indigo-500" />
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedTemplate.name} — Preview</h2>
                  <p className="text-[10px] text-slate-400">{selectedTemplate.sections.length} sections included</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <FileText size={12} /> PDF
                </button>
                <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Download size={12} /> Excel
                </button>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <ReportPreview template={selectedTemplate} data={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
