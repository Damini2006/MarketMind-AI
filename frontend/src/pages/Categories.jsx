import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge } from '../components/ui.jsx'
import InteractiveTable, { DetailModal } from '../components/InteractiveTable.jsx'
import { Tags, Plus, Trash2 } from 'lucide-react'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get('/categories/'), api.get('/inventory/products').catch(() => ({ data: [] }))])
      .then(([c, p]) => { if (!cancelled) { setCategories(c.data); setProducts(p.data) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get('/categories/'), api.get('/inventory/products').catch(() => ({ data: [] }))])
      .then(([c, p]) => { setCategories(c.data); setProducts(p.data) })
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!categoryName.trim()) { setMessage('Category name is required.'); return }
    try {
      await api.post('/categories/', { category_name: categoryName.trim(), description: description.trim() || null })
      setCategoryName(''); setDescription(''); setShowForm(false); setMessage('Category added successfully.'); setLoading(true); load()
    } catch (err) { setMessage(err.response?.data?.detail || 'Failed to add category.') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return
    try { setLoading(true); await api.delete(`/categories/${id}`); load() }
    catch (err) { setMessage(err.response?.data?.detail || 'Failed to delete category.') }
  }

  if (loading) return <Loading label="Loading categories..." />

  const getCatProductCount = (catName) => products.filter(p => p.category === catName).length

  const columns = [
    { key: 'category_name', label: 'Name', render: (v) => <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span> },
    { key: 'description', label: 'Description', render: (v) => <span className="text-slate-500 dark:text-slate-400">{v || '—'}</span> },
    { key: 'product_count', label: 'Products', render: (v) => <Badge tone={v > 0 ? 'blue' : 'slate'}>{v}</Badge> },
    { key: 'actions', label: '', sortable: false, render: (_, row) => (
      <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }} className="text-red-500 hover:text-red-700 p-1" title="Delete">
        <Trash2 size={14} />
      </button>
    )},
  ]

  const enriched = categories.map(c => ({ ...c, product_count: getCatProductCount(c.category_name) }))

  return (
    <div>
      <PageHeader title="Categories" subtitle="Manage product categories."
        action={<button onClick={() => { setShowForm(!showForm); setMessage('') }} className="btn-primary flex items-center gap-2"><Plus size={16} /> {showForm ? 'Cancel' : 'Add Category'}</button>}
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center p-3"><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{categories.length}</p><p className="text-[10px] text-slate-500 uppercase">Total Categories</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-blue-600">{products.length}</p><p className="text-[10px] text-slate-500 uppercase">Total Products</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-emerald-600">{categories.filter(c => getCatProductCount(c.category_name) > 0).length}</p><p className="text-[10px] text-slate-500 uppercase">Active Categories</p></div>
      </div>

      {showForm && (
        <div className="card mb-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium">Category Name</label>
              <input type="text" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Kitchen Appliances"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2" /></div>
            <div><label className="mb-1 block text-sm font-medium">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter category description" rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2" /></div>
            <button type="submit" className="btn-primary">Save Category</button>
          </form>
        </div>
      )}

      {message && <div className="mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm">{message}</div>}

      <div className="card">
        <InteractiveTable data={enriched} columns={columns} searchableKeys={['category_name', 'description']}
          onRowClick={setSelected} emptyMessage="No categories yet." />
      </div>

      <DetailModal title={selected?.category_name || ''} subtitle="Category Details" onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <DetailModal.Row label="Name" value={selected.category_name} icon={Tags} tone="brand" />
            <DetailModal.Row label="Description" value={selected.description || 'No description'} />
            <DetailModal.Row label="Products" value={selected.product_count} />
            <DetailModal.Section title="Products in this Category">
              {products.filter(p => p.category === selected.category_name).slice(0, 10).map(p => (
                <div key={p.id} className="flex justify-between py-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{p.name}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">₹{p.price}</span>
                </div>
              ))}
              {products.filter(p => p.category === selected.category_name).length === 0 && (
                <p className="text-xs text-slate-400 py-2">No products in this category.</p>
              )}
            </DetailModal.Section>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
