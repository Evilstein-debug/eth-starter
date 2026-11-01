'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { ChainSwitcher } from '@/components/chain-switcher'

export function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold">
            eth-starter
          </Link>
          <Link href="/debug" className="text-muted-foreground hover:text-foreground">
            Debug
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ChainSwitcher />
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      </div>
    </header>
  )
}
