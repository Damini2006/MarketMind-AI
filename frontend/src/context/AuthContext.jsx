import React, { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('marketmind_user')
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const form = new URLSearchParams()
      form.append('username', email)
      form.append('password', password)
      const res = await api.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      localStorage.setItem('marketmind_token', res.data.access_token)
      localStorage.setItem('marketmind_user', JSON.stringify(res.data.user))
      setUser(res.data.user)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
      return false
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

export function useAuth() {
  return useContext(AuthContext)
}
