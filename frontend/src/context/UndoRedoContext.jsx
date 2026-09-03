import { createContext, useContext, useState, useCallback, useRef } from 'react'
import api from '../services/api'

const UndoRedoContext = createContext()

const MAX_HISTORY = 50

/**
 * Action types and their undo/redo handlers:
 * - create_sale: POST /sales/ → undo = DELETE, redo = POST again
 * - update_stock: PATCH /inventory/products/:id/stock → undo = reverse delta, redo = re-apply
 * - mark_invoice_paid: PATCH /invoices/:id/status → undo = revert status, redo = re-mark
 * - create_product: POST /inventory/products → undo = DELETE, redo = POST again
 * - create_customer: POST /customers/ → undo = DELETE, redo = POST again
 */

export function UndoRedoProvider({ children }) {
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [isUndoing, setIsUndoing] = useState(false)
  const idCounter = useRef(0)

  /**
   * Register a new action that was just performed.
   * @param {Object} action
   * @param {string} action.type - e.g. 'create_sale', 'update_stock', 'mark_invoice_paid'
   * @param {string} action.label - Human-readable label e.g. "Created sale #123"
   * @param {Object} action.data - Action-specific data for undo/redo
   * @param {Function} action.undoFn - Async function to undo the action
   * @param {Function} action.redoFn - Async function to redo the action
   */
  const pushAction = useCallback((action) => {
    const entry = {
      id: ++idCounter.current,
      timestamp: new Date().toISOString(),
      ...action,
    }
    setHistory(prev => {
      const next = [entry, ...prev]
      return next.slice(0, MAX_HISTORY)
    })
    setFuture([]) // Clear future on new action
  }, [])

  /**
   * Undo the most recent action.
   * Returns { success: boolean, message: string }
   */
  const undo = useCallback(async () => {
    if (history.length === 0 || isUndoing) return { success: false, message: 'Nothing to undo' }

    setIsUndoing(true)
    const [action, ...rest] = history

    try {
      if (action.undoFn) {
        await action.undoFn()
      }
      setHistory(rest)
      setFuture(prev => [action, ...prev])
      return { success: true, message: `Undid: ${action.label}` }
    } catch (err) {
      return { success: false, message: `Undo failed: ${err.message}` }
    } finally {
      setIsUndoing(false)
    }
  }, [history, isUndoing])

  /**
   * Redo the most recently undone action.
   * Returns { success: boolean, message: string }
   */
  const redo = useCallback(async () => {
    if (future.length === 0 || isUndoing) return { success: false, message: 'Nothing to redo' }

    setIsUndoing(true)
    const [action, ...rest] = future

    try {
      if (action.redoFn) {
        await action.redoFn()
      }
      setFuture(rest)
      setHistory(prev => [action, ...prev])
      return { success: true, message: `Redid: ${action.label}` }
    } catch (err) {
      return { success: false, message: `Redo failed: ${err.message}` }
    } finally {
      setIsUndoing(false)
    }
  }, [future, isUndoing])

  const canUndo = history.length > 0 && !isUndoing
  const canRedo = future.length > 0 && !isUndoing

  const clearHistory = useCallback(() => {
    setHistory([])
    setFuture([])
  }, [])

  const value = {
    history,
    future,
    canUndo,
    canRedo,
    isUndoing,
    pushAction,
    undo,
    redo,
    clearHistory,
  }

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  )
}

export function useUndoRedo() {
  const ctx = useContext(UndoRedoContext)
  if (!ctx) throw new Error('useUndoRedo must be used within UndoRedoProvider')
  return ctx
}

// ─── Action Creators (convenience helpers) ────────────────────────────

export function createSaleAction(saleData, reloadFn) {
  return {
    type: 'create_sale',
    label: `Created sale of ${saleData.quantity}× ${saleData.product_name || 'product'}`,
    category: 'Sales',
    data: saleData,
    undoFn: async () => {
      // Delete the most recently created sale
      const res = await api.get('/sales/')
      const sales = Array.isArray(res.data) ? res.data : []
      const latest = sales[0]
      if (latest) await api.delete(`/sales/${latest.id}`)
      if (reloadFn) await reloadFn()
    },
    redoFn: async () => {
      await api.post('/sales/', {
        product_id: saleData.product_id,
        customer_id: saleData.customer_id || null,
        quantity: saleData.quantity,
        unit_price: saleData.unit_price,
      })
      if (reloadFn) await reloadFn()
    },
  }
}

export function updateStockAction(productId, productName, delta, reloadFn) {
  return {
    type: 'update_stock',
    label: `Updated stock for ${productName} (${delta > 0 ? '+' : ''}${delta})`,
    category: 'Inventory',
    data: { productId, delta },
    undoFn: async () => {
      await api.patch(`/inventory/products/${productId}/stock`, { quantity_delta: -delta })
      if (reloadFn) await reloadFn()
    },
    redoFn: async () => {
      await api.patch(`/inventory/products/${productId}/stock`, { quantity_delta: delta })
      if (reloadFn) await reloadFn()
    },
  }
}

export function markInvoicePaidAction(invoiceId, invoiceNumber, reloadFn) {
  return {
    type: 'mark_invoice_paid',
    label: `Marked ${invoiceNumber} as paid`,
    category: 'Invoices',
    data: { invoiceId, invoiceNumber },
    undoFn: async () => {
      await api.patch(`/invoices/${invoiceId}/status`, { status: 'pending' })
      if (reloadFn) await reloadFn()
    },
    redoFn: async () => {
      await api.patch(`/invoices/${invoiceId}/status`, { status: 'paid' })
      if (reloadFn) await reloadFn()
    },
  }
}

export function createProductAction(productData, reloadFn) {
  return {
    type: 'create_product',
    label: `Added product "${productData.name}"`,
    category: 'Inventory',
    data: productData,
    undoFn: async () => {
      const res = await api.get('/inventory/products')
      const products = Array.isArray(res.data) ? res.data : []
      const latest = products.find(p => p.name === productData.name)
      if (latest) await api.delete(`/inventory/products/${latest.id}`)
      if (reloadFn) await reloadFn()
    },
    redoFn: async () => {
      await api.post('/inventory/products', {
        name: productData.name,
        category: productData.category || '',
        price: Number(productData.price),
        stock_quantity: Number(productData.stock_quantity || 0),
        reorder_threshold: Number(productData.reorder_threshold || 10),
        warehouse_location: productData.warehouse_location || '',
      })
      if (reloadFn) await reloadFn()
    },
  }
}

export function createCustomerAction(customerData, reloadFn) {
  return {
    type: 'create_customer',
    label: `Added customer "${customerData.name}"`,
    category: 'Customers',
    data: customerData,
    undoFn: async () => {
      const res = await api.get('/customers/')
      const customers = Array.isArray(res.data) ? res.data : []
      const latest = customers.find(c => c.name === customerData.name)
      if (latest) await api.delete(`/customers/${latest.id}`)
      if (reloadFn) await reloadFn()
    },
    redoFn: async () => {
      await api.post('/customers/', customerData)
      if (reloadFn) await reloadFn()
    },
  }
}
