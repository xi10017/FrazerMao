'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Preview {
  currentSeason: number;
  entries: { displayName: string; points: number; rank: number }[];
}

export function PublicSeasonPreview({ onJoin }: { onJoin: React.ReactNode }) {
  const { supabase } = useSupabase();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void supabase.rpc('get_public_season_preview').then(({ data, error }) => {
      if (cancelled) return;
      if (error) setFailed(true);
      else setPreview(data as Preview);
    }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [supabase, attempt]);

  return <section className="py-8" aria-label="Season leaderboard preview">
    <Card>
      <CardHeader>
        <CardTitle>Season leaderboard</CardTitle>
        <CardDescription>
          {preview && `${preview.currentSeason}–${preview.currentSeason + 1} · `}
          Each completed test earns 1 point, including retakes, up to 6 points per day. The daily limit resets at midnight Eastern.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">The student with the most points at the season cutoff receives the activity award at FAMAT States. Join the leaderboard to participate.</p>
        {failed ? <div role="alert"><p>Standings are temporarily unavailable.</p><Button variant="outline" className="mt-2" onClick={() => setAttempt(value => value + 1)}>Try again</Button></div>
          : !preview ? <p role="status">Loading standings…</p>
          : preview.entries.length === 0 ? <p className="text-muted-foreground">No standings yet this season.</p>
          : <Table>
            <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Points</TableHead></TableRow></TableHeader>
            <TableBody>{preview.entries.filter(entry => entry.points > 0 && entry.rank <= 5).map((entry, index) => <TableRow key={`${entry.rank}-${index}`}>
              <TableCell>{entry.rank}</TableCell><TableCell className="font-medium break-words">{entry.displayName}</TableCell><TableCell className="text-right font-semibold">{entry.points}</TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        <p className="text-sm text-muted-foreground">Top 5 places, including ties.</p>
        {onJoin}
      </CardContent>
    </Card>
  </section>;
}
