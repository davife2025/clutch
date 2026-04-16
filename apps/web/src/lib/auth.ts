'use client'
import { api } from './api'

export function saveToken(token: string) {
  localStorage.setItem('clutch_token', token)
}

export function clearToken() {
  localStorage.removeItem('clutch_token')
  localStorage.removeItem('clutch_userId')
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('clutch_token')
}

export function isAuthenticated(): boolean {
  return !!getStoredToken()
}

export async function loginUser(email: string, password: string) {
  const data = await api.login(email, password)
  saveToken(data.token)
  localStorage.setItem('clutch_userId', data.userId)
  return data
}

export async function registerUser(email: string, password: string) {
  const data = await api.register(email, password)
  saveToken(data.token)
  localStorage.setItem('clutch_userId', data.userId)
  return data
}

export function logoutUser() {
  clearToken()
  window.location.href = '/auth/login'
}
