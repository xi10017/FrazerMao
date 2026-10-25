'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/supabase';
import { cn } from '@/lib/utils';

const sections = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/answer-keys', label: 'Answer key reports' },
  { href: '/admin/seasons', label: 'Season settings' },
  { href: '/admin/participants', label: 'Participant details' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin, isUserLoading } = useUser();
  const pathname = usePathname();
  if (isUserLoading) return <p className="p-6" role="status">Loading admin access…</p>;
  if (!isAdmin) return <div className="container mx-auto space-y-3 p-6"><h1 className="text-2xl font-bold">Admin access required</h1><p>This section is available only to administrators.</p><Link href="/" className="text-primary underline">Back to library</Link></div>;
  return <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="space-y-4">
      <h1 className="text-3xl font-bold">Admin</h1>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-2 border-b pb-4">
        {sections.map(section => {
          const active = pathname.replace(/\/$/, '') === section.href;
          return <Link key={section.href} href={section.href} aria-current={active ? 'page' : undefined}
            className={cn('rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent', active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground')}>{section.label}</Link>;
        })}
      </nav>
    </header>
    {children}
  </div>;
}
