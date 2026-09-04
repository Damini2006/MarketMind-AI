import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import api from '../services/api'
import { Loading, PageHeader, Badge } from '../components/ui.jsx'
import {
  Plus, Trash2, Save, RotateCcw, Settings, Move,
  ShoppingCart, IndianRupee, Users, Boxes, TrendingUp, AlertTriangle,
  LayoutTemplate, Download, Eye, EyeOff, GripVertical, PieChart as PieIcon,
  BarChart3, Activity, Zap, Target, Layers, Star, Clock, Shield, Search,
} from 'lucide-react'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// ─── Widget Registry ──────────────────────────────────────────────────
const WIDGET_REGISTRY = {
  // KPI Widgets
  kpi_revenue: { name: 'Total Revenue', icon: IndianRupee, color: 'emerald', defaultW: 3, defaultH: 2, category: 'KPIs' },
  kpi_sales: { name: 'Total Sales', icon: ShoppingCart, color: 'indigo', defaultW: 3, defaultH: 2, category: 'KPIs' },
  kpi_customers: { name: 'Total Customers', icon: Users, color: 'blue', defaultW: 3, defaultH: 2, category: 'KPIs' },
  kpi_products: { name: 'Total Products', icon: Boxes, color: 'purple', defaultW: 3, defaultH: 2, category: 'KPIs' },
  kpi_lowstock: { name: 'Low Stock Alert', icon: AlertTriangle, color: 'red', defaultW: 3, defaultH: 2, category: 'KPIs' },
  kpi_avg_order: { name: 'Avg Order Value', icon: Target, color: 'amber', defaultW: 3, defaultH: 2, category: 'KPIs' },
  // Chart Widgets
  chart_revenue: { name: 'Revenue Trend', icon: TrendingUp, color: 'indigo', defaultW: 6, defaultH: 4, category: 'Charts' },
  chart_products: { name: 'Top Products', icon: BarChart3, color: 'amber', defaultW: 6, defaultH: 4, category: 'Charts' },
  chart_category: { name: 'Sales by Category', icon: PieIcon, color: 'purple', defaultW: 4, defaultH: 4, category: 'Charts' },
  chart_segmentation: { name: 'Customer Segments', icon: PieIcon, color: 'pink', defaultW: 4, defaultH: 4, category: 'Charts' },
  chart_inventory: { name: 'Stock Distribution', icon: Boxes, color: 'teal', defaultW: 4, defaultH: 4, category: 'Charts' },
  chart_sales_area: { name: 'Sales Over Time', icon: Activity, color: 'cyan', defaultW: 6, defaultH: 4, category: 'Charts' },
  chart_radar: { name: 'Performance Radar', icon: Zap, color: 'violet', defaultW: 4, defaultH: 4, category: 'Charts' },
  // Table Widgets
  table_sales: { name: 'Recent Sales', icon: ShoppingCart, color: 'indigo', defaultW: 6, defaultH: 4, category: 'Tables' },
  table_inventory: { name: 'Low Stock Items', icon: AlertTriangle, color: 'red', defaultW: 6, defaultH: 4, category: 'Tables' },
  table_top_customers: { name: 'Top Customers', icon: Star, color: 'amber', defaultW: 6, defaultH: 4, category: 'Tables' },
  table_activity: { name: 'Recent Activity', icon: Clock, color: 'slate', defaultW: 6, defaultH: 4, category: 'Tables' },
}

const WIDGET_COLORS = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', fill: '#10b981' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', fill: '#6366f1' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', fill: '#3b82f6' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', fill: '#a855f7' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', fill: '#f59e0b' },
  red: { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800', fill: '#ef4444' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', fill: '#64748b' },
  pink: { bg: 'bg-pink-50 dark:bg-pink-950/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', fill: '#ec4899' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800', fill: '#14b8a6' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', fill: '#06b6d4' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', fill: '#8b5cf6' },
}

const API_BASE = '/user-data'

// ─── Layout Templates ─────────────────────────────────────────────────
const LAYOUT_TEMPLATES = {
  executive: {
    name: 'Executive Overview',
    description: 'High-level KPIs and revenue trends',
    layout: [
      { i: 'kpi_revenue', x: 0, y: 0, w: 3, h: 2 },
      { i: 'kpi_sales', x: 3, y: 0, w: 3, h: 2 },
      { i: 'kpi_customers', x: 6, y: 0, w: 3, h: 2 },
      { i: 'kpi_avg_order', x: 9, y: 0, w: 3, h: 2 },
      { i: 'chart_revenue', x: 0, y: 2, w: 8, h: 4 },
      { i: 'chart_radar', x: 8, y: 2, w: 4, h: 4 },
      { i: 'table_top_customers', x: 0, y: 6, w: 12, h: 4 },
    ],
  },
  sales: {
    name: 'Sales Focus',
    description: 'Sales performance, products, and categories',
    layout: [
      { i: 'kpi_sales', x: 0, y: 0, w: 4, h: 2 },
      { i: 'kpi_revenue', x: 4, y: 0, w: 4, h: 2 },
      { i: 'kpi_avg_order', x: 8, y: 0, w: 4, h: 2 },
      { i: 'chart_sales_area', x: 0, y: 2, w: 8, h: 4 },
      { i: 'chart_category', x: 8, y: 2, w: 4, h: 4 },
      { i: 'chart_products', x: 0, y: 6, w: 6, h: 4 },
      { i: 'table_sales', x: 6, y: 6, w: 6, h: 4 },
    ],
  },
  operations: {
    name: 'Operations',
    description: 'Inventory health, stock levels, and alerts',
    layout: [
      { i: 'kpi_products', x: 0, y: 0, w: 4, h: 2 },
      { i: 'kpi_lowstock', x: 4, y: 0, w: 4, h: 2 },
      { i: 'kpi_customers', x: 8, y: 0, w: 4, h: 2 },
      { i: 'chart_inventory', x: 0, y: 2, w: 6, h: 4 },
      { i: 'chart_segmentation', x: 6, y: 2, w: 6, h: 4 },
      { i: 'table_inventory', x: 0, y: 6, w: 12, h: 4 },
    ],
  },
  custom: {
    name: 'Blank Canvas',
    description: 'Start from scratch',
    layout: [],
  },
}

const DEFAULT_LAYOUT = LAYOUT_TEMPLATES.executive.layout

// ─── Widget Renderer ──────────────────────────────────────────────────
function WidgetRenderer({ widgetId, data }) {
  const kpis = data?.kpis
  const sales = data?.sales || []
  const products = data?.products || []
  const customers = data?.customers || []
  const invoices = data?.invoices || []

  switch (widgetId) {
    // ── KPI Widgets ──
    case 'kpi_revenue':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <IndianRupee size={20} className="text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{(kpis?.total_revenue || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 uppercase">Total Revenue</p>
        </div>
      )
    case 'kpi_sales':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <ShoppingCart size={20} className="text-indigo-500 mb-1" />
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{kpis?.total_sales || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase">Total Sales</p>
        </div>
      )
    case 'kpi_customers':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Users size={20} className="text-blue-500 mb-1" />
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{kpis?.total_customers || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase">Customers</p>
        </div>
      )
    case 'kpi_products':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Boxes size={20} className="text-purple-500 mb-1" />
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{kpis?.total_products || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase">Products</p>
        </div>
      )
    case 'kpi_lowstock': {
      const lowCount = products.filter(p => p.stock_quantity <= p.reorder_threshold).length
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <AlertTriangle size={20} className="text-red-500 mb-1" />
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{lowCount}</p>
          <p className="text-[10px] text-slate-500 uppercase">Low Stock Items</p>
        </div>
      )
    }
    case 'kpi_avg_order': {
      const avg = sales.length > 0 ? sales.reduce((s, x) => s + (x.total_amount || 0), 0) / sales.length : 0
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Target size={20} className="text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">₹{Math.round(avg).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 uppercase">Avg Order Value</p>
        </div>
      )
    }

    // ── Chart Widgets ──
    case 'chart_revenue': {
      const revenueData = (kpis?.revenue_by_day || []).slice(-14)
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Revenue Trend (14 days)</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    case 'chart_products': {
      const topProducts = (kpis?.top_products || []).slice(0, 6)
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Top Products by Revenue</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="product" tick={{ fontSize: 9 }} width={100} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    case 'chart_category': {
      const categoryMap = {}
      sales.forEach(s => {
        const p = products.find(pr => pr.id === s.product_id)
        const cat = p?.category || 'Other'
        categoryMap[cat] = (categoryMap[cat] || 0) + (s.total_amount || 0)
      })
      const catData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))
      const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e']
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Sales by Category</p>
          <div className="flex-1 min-h-0 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    case 'chart_segmentation': {
      // Customer segments based on total spend
      const segMap = { VIP: 0, Loyal: 0, Regular: 0, New: 0 }
      customers.forEach(c => {
        const total = sales.filter(s => s.customer_id === c.id).reduce((sum, s) => sum + (s.total_amount || 0), 0)
        if (total >= 10000) segMap.VIP++
        else if (total >= 5000) segMap.Loyal++
        else if (total >= 1000) segMap.Regular++
        else segMap.New++
      })
      const segData = Object.entries(segMap).map(([name, value]) => ({ name, value }))
      const COLORS = ['#f59e0b', '#10b981', '#6366f1', '#94a3b8']
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Customer Segments</p>
          <div className="flex-1 min-h-0 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                  {segData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    case 'chart_inventory': {
      const stockData = products.slice(0, 8).map(p => ({
        name: p.name?.slice(0, 12),
        stock: p.stock_quantity,
        threshold: p.reorder_threshold,
      }))
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Stock Distribution</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="stock" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="threshold" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    case 'chart_sales_area': {
      const revenueData = (kpis?.revenue_by_day || []).slice(-14)
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Sales Over Time</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    case 'chart_radar': {
      // Performance metrics radar
      const totalProducts = products.length || 1
      const inStock = products.filter(p => p.stock_quantity > 0).length
      const metrics = [
        { metric: 'Revenue', value: Math.min(100, (kpis?.total_revenue || 0) / 10000) },
        { metric: 'Sales', value: Math.min(100, (kpis?.total_sales || 0) / 10) },
        { metric: 'Customers', value: Math.min(100, (kpis?.total_customers || 0) * 5) },
        { metric: 'Stock', value: Math.round((inStock / totalProducts) * 100) },
        { metric: 'Products', value: Math.min(100, totalProducts * 8) },
        { metric: 'Invoices', value: Math.min(100, invoices.length * 5) },
      ]
      return (
        <div className="h-full flex flex-col">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Performance Radar</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metrics}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis tick={{ fontSize: 8 }} />
                <Radar name="Performance" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }

    // ── Table Widgets ──
    case 'table_sales': {
      const recentSales = sales.slice(-10).reverse()
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent Sales</p>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-1 text-slate-500">Date</th>
                <th className="text-left py-1 text-slate-500">Product</th>
                <th className="text-right py-1 text-slate-500">Amount</th>
              </tr></thead>
              <tbody>
                {recentSales.map((s, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-1 text-slate-500">{s.sale_date?.slice(5, 10)}</td>
                    <td className="py-1 font-medium truncate max-w-[120px]">{products.find(p => p.id === s.product_id)?.name || `#${s.product_id}`}</td>
                    <td className="py-1 text-right font-semibold">₹{Number(s.total_amount || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    case 'table_inventory': {
      const lowStock = products.filter(p => p.stock_quantity <= p.reorder_threshold).slice(0, 8)
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Low Stock Items</p>
          <div className="flex-1 overflow-y-auto">
            {lowStock.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">All items in stock ✓</p>
            ) : (
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-1 text-slate-500">Product</th>
                  <th className="text-right py-1 text-slate-500">Stock</th>
                  <th className="text-right py-1 text-slate-500">Reorder</th>
                </tr></thead>
                <tbody>
                  {lowStock.map((p, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-1 font-medium truncate max-w-[120px]">{p.name}</td>
                      <td className="py-1 text-right text-red-600 font-bold">{p.stock_quantity}</td>
                      <td className="py-1 text-right text-slate-500">{p.reorder_threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )
    }
    case 'table_top_customers': {
      // Compute customer totals
      const custTotals = customers.map(c => {
        const cSales = sales.filter(s => s.customer_id === c.id)
        const total = cSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
        return { ...c, totalSpent: total, orderCount: cSales.length }
      }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10)
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Top Customers</p>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-1 text-slate-500">#</th>
                <th className="text-left py-1 text-slate-500">Name</th>
                <th className="text-right py-1 text-slate-500">Orders</th>
                <th className="text-right py-1 text-slate-500">Total</th>
              </tr></thead>
              <tbody>
                {custTotals.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-1 text-slate-400">{i + 1}</td>
                    <td className="py-1 font-medium truncate max-w-[120px]">{c.name || c.email}</td>
                    <td className="py-1 text-right text-slate-500">{c.orderCount}</td>
                    <td className="py-1 text-right font-semibold text-amber-600">₹{c.totalSpent.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    case 'table_activity': {
      const recentSales = sales.slice(-8).reverse()
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent Activity</p>
          <div className="flex-1 overflow-y-auto space-y-2">
            {recentSales.map((s, i) => {
              const prod = products.find(p => p.id === s.product_id)
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <ShoppingCart size={10} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium truncate">{prod?.name || 'Product'} sold</p>
                    <p className="text-[9px] text-slate-400">{s.sale_date?.slice(0, 10)}</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">₹{Number(s.total_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    default:
      return <p className="text-xs text-slate-400 text-center py-4">Widget not found</p>
  }
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function DashboardBuilder() {
  const { t } = useTranslation()
  const [measuredWidth, setMeasuredWidth] = useState(800)
  useEffect(() => {
    const measure = () => {
      const main = document.querySelector('main')
      if (main) {
        const w = main.offsetWidth - 48
        if (w > 0) setMeasuredWidth(w)
      }
    }
    measure()
    const obs = new ResizeObserver(() => measure())
    const main = document.querySelector('main')
    if (main) obs.observe(main)
    window.addEventListener('resize', measure)
    return () => { obs.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [layout, setLayout] = useState([])
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [hiddenWidgets, setHiddenWidgets] = useState(new Set())
  const [widgetSearch, setWidgetSearch] = useState('')
  const [activeTemplate, setActiveTemplate] = useState('executive')
  const [showTemplates, setShowTemplates] = useState(false)

  // Load saved layout from Neon or use default
  useEffect(() => {
    api.get(`${API_BASE}/dashboard-layouts`)
      .then(res => {
        const layouts = Array.isArray(res.data) ? res.data : []
        const active = layouts.find(l => l.is_active)
        if (active && active.layout_json) {
          const parsed = JSON.parse(active.layout_json)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLayout(parsed)
            return
          }
        }
        // No saved layout — load the executive template as default
        setLayout(DEFAULT_LAYOUT.map(w => ({ ...w })))
      })
      .catch(() => setLayout(DEFAULT_LAYOUT.map(w => ({ ...w }))))
  }, [])

  // Load data
  const load = useCallback(() => {
    Promise.all([
      api.get('/analytics/kpis').catch(() => ({ data: {} })),
      api.get('/sales/').catch(() => ({ data: [] })),
      api.get('/inventory/products').catch(() => ({ data: [] })),
      api.get('/customers/').catch(() => ({ data: [] })),
      api.get('/invoices/').catch(() => ({ data: [] })),
    ]).then(([kpis, sales, products, customers, invoices]) => {
      setData({
        kpis: kpis.data,
        sales: Array.isArray(sales.data) ? sales.data : sales.data.items || [],
        products: Array.isArray(products.data) ? products.data : [],
        customers: Array.isArray(customers.data) ? customers.data : [],
        invoices: Array.isArray(invoices.data) ? invoices.data : [],
      })
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const visibleLayout = useMemo(() => {
    return layout.filter(item => !hiddenWidgets.has(item.i))
  }, [layout, hiddenWidgets])

  const onLayoutChange = useCallback((newLayout) => {
    if (!editMode) return
    setLayout(prev => {
      const merged = newLayout.map(nl => {
        const old = prev.find(p => p.i === nl.i)
        return { ...old, ...nl }
      })
      // Keep items in prev that aren't in newLayout (hidden widgets)
      const newIds = new Set(newLayout.map(n => n.i))
      const kept = prev.filter(p => !newIds.has(p.i))
      return [...merged, ...kept]
    })
  }, [editMode])

  const addWidget = useCallback((widgetId) => {
    const widget = WIDGET_REGISTRY[widgetId]
    if (!widget) return
    // Check if already on layout
    if (layout.find(l => l.i === widgetId)) return
    const y = layout.length > 0 ? Math.max(...layout.map(l => l.y + l.h)) : 0
    setLayout(prev => [...prev, { i: widgetId, x: 0, y, w: widget.defaultW, h: widget.defaultH }])
    setHiddenWidgets(prev => { const next = new Set(prev); next.delete(widgetId); return next })
  }, [layout])

  const removeWidget = useCallback((widgetId) => {
    setLayout(prev => prev.filter(l => l.i !== widgetId))
  }, [])

  const toggleWidget = useCallback((widgetId) => {
    setHiddenWidgets(prev => {
      const next = new Set(prev)
      if (next.has(widgetId)) next.delete(widgetId)
      else next.add(widgetId)
      return next
    })
  }, [])

  const applyTemplate = useCallback((templateKey) => {
    const tmpl = LAYOUT_TEMPLATES[templateKey]
    if (!tmpl) return
    setLayout(tmpl.layout.map(w => ({ ...w })))
    setHiddenWidgets(new Set())
    setActiveTemplate(templateKey)
    setShowTemplates(false)
    // Save to Neon
    api.post(`${API_BASE}/dashboard-layouts`, {
      name: templateKey, layout_json: JSON.stringify(tmpl.layout), is_active: true,
    }).catch(() => {})
  }, [])

  const resetLayout = useCallback(() => {
    const tmpl = LAYOUT_TEMPLATES[activeTemplate] || LAYOUT_TEMPLATES.executive
    setLayout(tmpl.layout.map(w => ({ ...w })))
    setHiddenWidgets(new Set())
    api.post(`${API_BASE}/dashboard-layouts`, {
      name: activeTemplate, layout_json: JSON.stringify(tmpl.layout), is_active: true,
    }).catch(() => {})
  }, [activeTemplate])

  const saveLayout = useCallback(() => {
    api.post(`${API_BASE}/dashboard-layouts`, {
      name: 'custom', layout_json: JSON.stringify(layout), is_active: true,
    }).catch(() => {})
  }, [layout])

  // Export
  const handleExportPDF = () => {
    const headers = ['Widget', 'Type']
    const rows = layout.map(l => [WIDGET_REGISTRY[l.i]?.name || l.i, WIDGET_REGISTRY[l.i]?.category || ''])
    exportToPDF({ title: 'Dashboard Layout', subtitle: 'Widget Configuration', headers, rows, filename: 'dashboard-layout' })
  }
  const handleExportExcel = () => {
    const headers = ['Widget', 'Type']
    const rows = layout.map(l => [WIDGET_REGISTRY[l.i]?.name || l.i, WIDGET_REGISTRY[l.i]?.category || ''])
    exportToExcel({ title: 'Dashboard Layout', headers, rows, filename: 'dashboard-layout' })
  }

  // Widget library filtered
  const filteredWidgets = useMemo(() => {
    const search = widgetSearch.toLowerCase()
    return Object.entries(WIDGET_REGISTRY).filter(([id, w]) => {
      if (search && !w.name.toLowerCase().includes(search) && !w.category.toLowerCase().includes(search)) return false
      return true
    })
  }, [widgetSearch])

  const widgetCategories = useMemo(() => {
    const cats = {}
    filteredWidgets.forEach(([id, w]) => {
      if (!cats[w.category]) cats[w.category] = []
      cats[w.category].push({ id, ...w })
    })
    return cats
  }, [filteredWidgets])

  if (loading) return <Loading label="Loading dashboard data..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Builder"
        subtitle={`${layout.length} widgets · ${editMode ? 'Drag to rearrange, resize to customize' : 'Click Edit Layout to customize'}`}
        action={
          <div className="flex items-center gap-2">
            {/* Templates */}
            <div className="relative">
              <button onClick={() => setShowTemplates(v => !v)} className="btn-secondary flex items-center gap-1.5 text-xs">
                <LayoutTemplate size={14} /> Templates
              </button>
              {showTemplates && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Layout Templates</p>
                  {Object.entries(LAYOUT_TEMPLATES).map(([key, tmpl]) => (
                    <button key={key} onClick={() => applyTemplate(key)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${activeTemplate === key ? 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tmpl.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{tmpl.description} · {tmpl.layout.length} widgets</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { setEditMode(v => !v); if (editMode) saveLayout() }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${editMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'btn-primary'}`}>
              {editMode ? <><Save size={14} /> Save Layout</> : <><Settings size={14} /> Edit Layout</>}
            </button>

            {editMode && (
              <>
                <button onClick={resetLayout} className="btn-secondary flex items-center gap-1.5 text-xs text-orange-600">
                  <RotateCcw size={14} /> Reset
                </button>
                <button onClick={() => setShowWidgetPanel(v => !v)} className="btn-secondary flex items-center gap-1.5 text-xs">
                  <Plus size={14} /> Add Widget
                </button>
              </>
            )}

            <div className="relative group">
              <button className="btn-secondary flex items-center gap-1.5 text-xs"><Download size={14} /> Export</button>
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800">Export PDF</button>
                <button onClick={handleExportExcel} className="w-full text-left px-3 py-2 text-xs text-green-600 hover:bg-slate-50 dark:hover:bg-slate-800">Export Excel</button>
              </div>
            </div>
          </div>
        }
      />

      {/* Widget Library Panel */}
      {showWidgetPanel && editMode && (
        <div className="card border-2 border-dashed border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Widget Library</h3>
            <button onClick={() => setShowWidgetPanel(false)} className="text-slate-400 hover:text-slate-600"><EyeOff size={16} /></button>
          </div>
          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={widgetSearch} onChange={e => setWidgetSearch(e.target.value)} placeholder="Search widgets..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white" />
          </div>
          {/* Categories */}
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {Object.entries(widgetCategories).map(([cat, widgets]) => (
              <div key={cat}>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {widgets.map(w => {
                    const Icon = w.icon
                    const alreadyAdded = layout.find(l => l.i === w.id)
                    return (
                      <button key={w.id} onClick={() => addWidget(w.id)} disabled={alreadyAdded}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${alreadyAdded ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm'}`}>
                        <Icon size={12} className={WIDGET_COLORS[w.color]?.text || ''} />
                        {w.name}
                        {alreadyAdded && <span className="text-[9px] text-slate-400">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className={`relative ${editMode ? 'ring-2 ring-indigo-400/30 ring-offset-2 dark:ring-offset-slate-950 rounded-xl' : ''}`}>
        {editMode && (
          <div className="absolute top-2 left-4 z-10 flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
            <Move size={10} className="text-indigo-500" />
            <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400">Drag to rearrange · Resize from corners</span>
          </div>
        )}

        {visibleLayout.length > 0 ? (
          <GridLayout
            className="layout"
            layout={visibleLayout}
            cols={12}
            rowHeight={60}
            width={measuredWidth}
            onLayoutChange={onLayoutChange}
            isDraggable={editMode}
            isResizable={editMode}
            draggableHandle=".drag-handle"
            margin={[12, 12]}
          >
            {visibleLayout.map((item) => {
              const widget = WIDGET_REGISTRY[item.i]
              if (!widget) return <div key={item.i} />
              const Icon = widget.icon
              const colors = WIDGET_COLORS[widget.color] || WIDGET_COLORS.slate
              return (
                <div key={item.i} className={`card overflow-hidden flex flex-col ${colors.border} border-2`}>
                  <div className={`flex items-center justify-between px-3 py-2 border-b ${colors.border} ${colors.bg} shrink-0`}>
                    <div className="flex items-center gap-2">
                      {editMode && <GripVertical size={12} className="drag-handle text-slate-400 cursor-grab" />}
                      <Icon size={12} className={colors.text} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">{widget.name}</span>
                    </div>
                    {editMode && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleWidget(item.i)} className="p-0.5 hover:bg-white/50 dark:hover:bg-slate-700 rounded" title="Hide">
                          <EyeOff size={10} className="text-slate-400" />
                        </button>
                        <button onClick={() => removeWidget(item.i)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Remove">
                          <Trash2 size={10} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 min-h-0 overflow-hidden">
                    <WidgetRenderer widgetId={item.i} data={data} />
                  </div>
                </div>
              )
            })}
          </GridLayout>
        ) : (
          <div className="card text-center py-16">
            <LayoutTemplate size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No widgets on dashboard</p>
            <p className="text-xs text-slate-400 mt-1">Click "Edit Layout" then "Add Widget" to get started</p>
          </div>
        )}
      </div>

      {/* Hidden Widgets */}
      {hiddenWidgets.size > 0 && editMode && (
        <div className="card">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Hidden Widgets</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(hiddenWidgets).map(id => {
              const widget = WIDGET_REGISTRY[id]
              if (!widget) return null
              const Icon = widget.icon
              return (
                <button key={id} onClick={() => toggleWidget(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] transition-colors">
                  <Eye size={12} /> {widget.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
