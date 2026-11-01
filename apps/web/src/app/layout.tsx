import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/header'
import { WrongNetworkBanner } from '@/components/wrong-network-banner'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'eth-starter',
  description: 'EVM hackathon starter',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <Header />
          <WrongNetworkBanner />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
