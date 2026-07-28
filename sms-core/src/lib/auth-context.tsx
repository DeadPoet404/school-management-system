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
  login: (email: string, password: string) => Promise<AuthUser>
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
    const apiBase = API_URL.replace(/\/$/, "")
    const loginUrl = `${apiBase}/auth/login`
    const normalizedEmail = email.trim()

    let res: Response

    try {
      res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail, password }),
      })
    } catch (error) {
      throw new ApiClientError(
        0,
        "Unable to reach the authentication service. Confirm the backend is running on port 5000 and restart the frontend dev server.",
        { cause: error instanceof Error ? error.message : String(error) }
      )
    }

    const responseText = await res.text()
    let json: { success?: boolean; message?: string; data?: { user?: AuthUser } } | null = null

    try {
      json = responseText ? JSON.parse(responseText) : null
    } catch {
      throw new ApiClientError(
        res.status,
        `Authentication service returned an invalid response. HTTP ${res.status}`,
        { body: responseText }
      )
    }

    if (!res.ok || !json?.success) {
      throw new ApiClientError(res.status, json?.message || `Login failed. HTTP ${res.status}`, json)
    }

    if (!json.data?.user) {
      throw new ApiClientError(res.status, "Login succeeded but no user profile was returned.", json)
    }

    const authUser = json.data.user
    setUser(authUser)
    return authUser
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
