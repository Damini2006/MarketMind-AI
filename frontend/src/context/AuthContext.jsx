import { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('marketmind_user')
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(async (email, password, selectedRole) => {
    setLoading(true)
    setError(null)
    try {
      const form = new URLSearchParams()
      form.append('username', email)
      form.append('password', password)

      const res = await api.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      // Combine API user object with selectedRole if backend doesn't provide one
      const userData = {
        ...(res.data.user || {}),
        role: selectedRole || res.data.user?.role || 'sales_executive',
      }

      localStorage.setItem('marketmind_token', res.data.access_token)
      localStorage.setItem('marketmind_user', JSON.stringify(userData))
      setUser(userData)

      // Return user data so caller (Login.jsx) has immediate access to role
      return { success: true, user: userData }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
      return { success: false }
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (payload) => {
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/register', payload)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('marketmind_token')
    localStorage.removeItem('marketmind_user')
    setUser(null)
  }, [])

  const hasRole = useCallback(
    (...roles) => !!user && roles.includes(user.role),
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, error, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}