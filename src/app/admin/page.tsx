import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return <div className="grid gap-4 md:grid-cols-3">
    <Link href="/admin/answer-keys" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-accent"><CardHeader><CardTitle>Answer key reports</CardTitle><CardDescription>Review disputes, browse the archive, and restore original answers.</CardDescription></CardHeader></Card>
    </Link>
    <Link href="/admin/seasons" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-accent"><CardHeader><CardTitle>Season settings</CardTitle><CardDescription>Configure future rollover dates without changing completed seasons.</CardDescription></CardHeader></Card>
    </Link>
    <Link href="/admin/participants" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-accent"><CardHeader><CardTitle>Participant details</CardTitle><CardDescription>Review private full names, schools, and award participation by season.</CardDescription></CardHeader></Card>
    </Link>
  </div>;
}
