import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

// Skeleton Base: animated pulse block for placeholder content
const SKELETON_BASE = 'animate-pulse rounded bg-slate-200 dark:bg-slate-800'

function Skeleton({ className = '', style = {} }) {
  return <div className={SKELETON_BASE + ' ' + className} style={style} />
}

function SkeletonText({ width = '100%', height = '0.75rem', className = '' }) {
  return <Skeleton className={className} style={{ width, height }} />
}

function SkeletonCircle({ size = '2.5rem', className = '' }) {
  return <Skeleton className={'rounded-full ' + className} style={{ width: size, height: size, flexShrink: 0 }} />
}

function SkeletonCard({ children, className = '' }) {
  return (
    <div className={'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 ' + className}>
      {children}
    </div>
  )
}

// Dashboard Skeleton: KPI cards + chart + table
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-3">
              <SkeletonCircle size="2.75rem" />
              <div className="space-y-2 flex-1">
                <SkeletonText width="40%" height="1.5rem" />
                <SkeletonText width="70%" height="0.875rem" />
                <SkeletonText width="55%" height="0.625rem" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard className="lg:col-span-2">
          <SkeletonText width="35%" height="1.125rem" className="mb-4" />
          <Skeleton style={{ height: '220px' }} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonText width="50%" height="1.125rem" className="mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonCircle size="2rem" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonText width="80%" />
                  <SkeletonText width="60%" height="0.5rem" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <SkeletonCard>
        <SkeletonText width="25%" height="1.125rem" className="mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <SkeletonCircle size="2rem" />
              <SkeletonText width="20%" />
              <SkeletonText width="15%" />
              <SkeletonText width="10%" />
              <div className="flex-1" />
              <SkeletonText width="80px" height="1.5rem" className="rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

// Table Skeleton: toolbar + 5 animated table rows
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonText width="240px" height="2.25rem" className="rounded-lg" />
        <div className="flex-1" />
        <SkeletonText width="100px" height="2.25rem" className="rounded-lg" />
        <SkeletonText width="80px" height="2.25rem" className="rounded-lg" />
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonText key={i} width={i === 0 ? '30%' : (60 + (i % 3) * 20) + 'px'} height="0.625rem" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <SkeletonCircle size="1.75rem" />
            {Array.from({ length: columns - 1 }).map((_, c) => (
              <SkeletonText key={c} width={(60 + ((r + c) % 4) * 25) + 'px'} />
            ))}
            <div className="flex-1" />
            <SkeletonText width="60px" height="1.5rem" className="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Cards Skeleton: grid of stat/content cards
export function CardsSkeleton({ count = 6, cols = 3 }) {
  const colClass = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <div className={'grid ' + (colClass[cols] || colClass[3]) + ' gap-4'}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="2.5rem" />
              <SkeletonText width="60%" height="1.125rem" />
            </div>
            <SkeletonText width="90%" />
            <SkeletonText width="75%" />
            <SkeletonText width="45%" height="0.625rem" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  )
}

// Chart Skeleton: chart area + sidebar stats
export function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SkeletonCard className="lg:col-span-2">
        <SkeletonText width="30%" height="1.125rem" className="mb-4" />
        <Skeleton style={{ height: '260px' }} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonText width="45%" height="1.125rem" className="mb-4" />
        <div className="space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <SkeletonText width="60%" />
                <SkeletonText width="25%" />
              </div>
              <Skeleton style={{ height: '6px' }} className="rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

// Full Page Skeleton: header + content variant
export function PageSkeleton({ variant = 'table', rows, columns, count, cols }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonText width="200px" height="1.75rem" />
          <SkeletonText width="320px" height="0.875rem" />
        </div>
        <SkeletonText width="120px" height="2.25rem" className="rounded-lg" />
      </div>
      {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
      {variant === 'cards' && <CardsSkeleton count={count} cols={cols} />}
      {variant === 'chart' && <ChartSkeleton />}
      {variant === 'dashboard' && <DashboardSkeleton />}
    </div>
  )
}

// Loading spinner (kept for non-data contexts)
export function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 py-16">
      <Loader2 className="animate-spin" size={20} />
      <span>{label}</span>
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand' }) {
  const toneClasses = {
    brand: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',
  }
  return (
    <div className="card flex items-center gap-4">
      {Icon && <div className={'p-3 rounded-lg ' + toneClasses[tone]}><Icon size={22} /></div>}
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const toneClasses = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    green: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
    blue: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
    purple: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  }
  return <span className={'badge ' + (toneClasses[tone] || toneClasses.slate)}>{children}</span>
}

export function EmptyState({ message }) {
  return <div className="text-center text-slate-400 dark:text-slate-500 py-16 text-sm">{message}</div>
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 text-sm mb-4">
      {message}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
