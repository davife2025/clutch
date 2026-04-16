'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerUser } from '@/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await registerUser(email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🫙</div>
          <h1 className="text-2xl font-bold text-white">Create your Clutch</h1>
          <p className="text-zinc-400 mt-1 text-sm">One pocket. All your wallets.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
            <input className="input" type="password" placeholder="Min. 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Have an account?{' '}
          <Link href="/auth/login" className="text-green-400 hover:text-green-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
