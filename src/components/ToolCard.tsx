import Link from 'next/link';
import type { ToolDefinition } from '@/lib/tools/types';
import { toolHref } from '@/lib/tools/hubs';

export default function ToolCard({ tool }: { tool: Pick<ToolDefinition, 'slug' | 'path' | 'name' | 'icon' | 'shortDescription'> }) {
  return (
    <Link href={toolHref(tool)} className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
      <span aria-hidden className="text-3xl">{tool.icon}</span>
      <span>
        <strong className="block leading-snug">{tool.name}</strong>
        <span className="mt-1 block text-sm text-muted">{tool.shortDescription}</span>
      </span>
    </Link>
  );
}

export function ToolGrid({ tools }: { tools: ToolDefinition[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => <li key={t.slug}><ToolCard tool={t} /></li>)}
    </ul>
  );
}
