import { isLocalChain } from '@starter/shared/chains'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { targetChainId } from '@/lib/env'
import { AdminPanel } from './admin-panel'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

/** Hidden local-only test controls. On any chain other than 31337 this route is a 404. */
export default function AdminPage() {
  if (!isLocalChain(targetChainId)) notFound()
  return <AdminPanel />
}
