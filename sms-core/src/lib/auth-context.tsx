"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { fetchWithAuth, ApiClientError } from "./fetch-with-auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AuthUser {
  email: string
  role: string
  entityType: string
  entityInternalId: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Validate session on mount via httpOnly cookies ──
  // fetchWithAuth sends cookies and handles token refresh automatically.
  // On failure (no cookie, expired, refresh failed), user stays null.
  // The middleware and ProtectedRoute handle redirects — we never
  // redirect from here to avoid infinite loops on /login.
  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      try {
        const res = await fetchWithAuth("/auth/me")
        if (cancelled) return

        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data?.user) {
            setUser(json.data.user)
          }
        }
        // If not ok, user stays null = unauthenticated. No redirect.
      } catch {
        // Network error — user stays null
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    validateSession()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Login is a public endpoint — use raw fetch, no auth wrapper needed
    // Backend sets httpOnly cookies on success
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })

    const json = await res.json()

    if (!res.ok || !json.success) {
      throw new ApiClientError(res.status, json.message || "Login failed", json)
    }

    // Backend returns user metadata (no token in body — that's in the cookie)
    if (json.data?.user) {
      setUser(json.data.user)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      // Tell backend to revoke refresh token and clear cookies
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch {
      // Even if logout call fails, clear local state
    } finally {
      setUser(null)
      window.location.href = "/login"
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
