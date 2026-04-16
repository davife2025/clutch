import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clutch — Your wallets. Always there.',
  description: 'A unified pocket for all your crypto wallets.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
