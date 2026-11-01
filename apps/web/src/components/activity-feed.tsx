'use client'

import { explorerTxUrl } from '@starter/shared/chains'
import { activityResponseSchema, type ActivityEntry } from '@starter/shared/schemas'
import { useQuery } from '@tanstack/react-query'
import type { Hash } from 'viem'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { serverUrl, targetChain } from '@/lib/env'

/** Polls the server's activity feed (chain events, API requests, admin actions). */
export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const { data, error } = useQuery({
    queryKey: ['activity', limit],
    queryFn: async () => {
      const res = await fetch(`${serverUrl}/api/activity?limit=${limit}`)
      return activityResponseSchema.parse(await res.json()).entries
    },
    refetchInterval: 2_000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Live from apps/server · newest first</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm">Server unreachable at {serverUrl}</p>}
        {data?.length === 0 && <p className="text-muted-foreground text-sm">Nothing yet.</p>}
        <ul className="flex flex-col gap-2">
          {data?.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Row({ entry }: { entry: ActivityEntry }) {
  const url = entry.txHash ? explorerTxUrl(targetChain, entry.txHash as Hash) : undefined
  const ref = entry.txHash ?? entry.requestId
  return (
    <li className="flex flex-wrap items-baseline gap-2 text-sm">
      <span className="text-muted-foreground w-16 shrink-0 text-xs tabular-nums">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
      <Badge variant={entry.kind === 'chain' ? 'default' : 'secondary'}>{entry.kind}</Badge>
      <span className="min-w-0 break-all">{entry.message}</span>
      {ref &&
        (url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground text-xs underline"
          >
            {ref.slice(0, 10)}…
          </a>
        ) : (
          <code className="text-muted-foreground text-xs" title={ref}>
            {ref.slice(0, 10)}…
          </code>
        ))}
    </li>
  )
}
