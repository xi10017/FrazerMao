'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '@/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FIRST_AWARD_SEASON } from '@/lib/season-activity';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
interface Participant { userId: string; displayName: string; fullName: string | null; school: string | null; participating: boolean; confirmedAt: string | null }
export function SeasonAwardParticipants({ currentSeason }: { currentSeason: number }) {
  const { supabase } = useSupabase();
  const [year, setYear] = useState(String(currentSeason));
  const [rows, setRows] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (season: number) => {
    if (!Number.isInteger(season) || season < FIRST_AWARD_SEASON) {
      setError('The first official award season is 2026–2027.'); setRows([]); return;
    }
    setLoading(true); setError(null); setRows([]);
    const { data, error } = await supabase.rpc('get_season_award_participants', { target_season: season });
    if (error) setError('Could not load private award details. Check the migration and try again.');
    else setRows(data as Participant[]);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { setYear(String(currentSeason)); void load(currentSeason); }, [currentSeason, load]);
  return <Card className="mt-6">
    <CardHeader><CardTitle>Private award participants</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Full names and schools are visible only to admins. These are student-confirmed details; verify eligibility before awarding anything.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();void load(Number(year));}}>
        <div><Label htmlFor="participant-season">Season start year</Label><Input id="participant-season" type="number" required min={FIRST_AWARD_SEASON} max="9998" step="1" value={year} onChange={e=>setYear(e.target.value)} /></div>
        <Button disabled={loading}>Load participants</Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading…</p> : <Table>
        <TableHeader><TableRow><TableHead>Display name</TableHead><TableHead>Full name</TableHead><TableHead>School</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(row=><TableRow key={row.userId}><TableCell>{row.displayName}</TableCell><TableCell>{row.fullName ?? 'Not confirmed'}</TableCell><TableCell>{row.school ?? 'Not confirmed'}</TableCell><TableCell>{!row.participating ? 'Left season' : row.confirmedAt ? 'Details confirmed' : 'Needs confirmation'}</TableCell></TableRow>)}</TableBody>
      </Table>}
      {!loading && !error && rows.length === 0 && <p>No participants recorded for this season.</p>}
    </CardContent>
  </Card>;
}
