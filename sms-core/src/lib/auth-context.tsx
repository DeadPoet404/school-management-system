"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { apiClient, ApiClientError } from "./api-client"

interface AuthUser {
  email: string
  role: string
  entityType: string
  entityInternalId: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("sms_token")
      const storedUser = localStorage.getItem("sms_user")
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch {
      localStorage.removeItem("sms_token")
      localStorage.removeItem("sms_user")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    localStorage.setItem("sms_token", response.token)
    localStorage.setItem("sms_user", JSON.stringify(response.user))
    setToken(response.token)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("sms_token")
    localStorage.removeItem("sms_user")
    setToken(null)
    setUser(null)
    window.location.href = "/login"
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
