'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSupabase, useUser } from '@/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { FIRST_AWARD_SEASON } from '@/lib/season-activity';
import { SeasonAwardEnrollment } from './SeasonAwardEnrollment';
import { PersonalSeasonActivity, type PersonalActivity } from './PersonalSeasonActivity';

interface Season {
  startYear: number;
  entries: { userId: string; displayName: string; photoURL: string | null; points: number; rank: number }[];
}
interface Standings { myActivity?: PersonalActivity; currentSeason: number; participating: boolean; nextRollover?: string; seasons: Season[] }

interface OwnRow { userId: string; displayName: string; photoURL: string | null; points: number; rank: number | null; participating: boolean }
function Rankings({ season, own }: { season: Season; own?: OwnRow }) {
  const others = season.entries.filter(entry => entry.points > 0 && entry.userId !== own?.userId);
  if (!own && others.length === 0) return <p className="py-6 text-center text-muted-foreground">No points recorded yet this season.</p>;
  return <Table>
    <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Season points</TableHead></TableRow></TableHeader>
    <TableBody>
      {own && <TableRow className="border-b-2 border-primary/30 bg-primary/10 hover:bg-primary/10">
        <TableCell>{own.rank ?? '—'}{!own.participating && own.rank !== null && <span className="block text-xs text-muted-foreground">If you join</span>}</TableCell>
        <TableCell><div className="flex items-center gap-3"><Avatar><AvatarImage src={own.photoURL ?? undefined} alt="" /><AvatarFallback>{getInitials(own.displayName)}</AvatarFallback></Avatar>
          <div><p className="font-medium">{own.displayName} <span className="text-muted-foreground">(You)</span></p>
          <p className="text-xs text-muted-foreground">{own.points === 0 ? 'Complete a test to earn your first point' : own.participating ? 'Participating' : 'Not participating'}</p></div>
        </div></TableCell>
        <TableCell className="text-right font-semibold">{own.points}</TableCell>
      </TableRow>}
      {others.map(entry=><TableRow key={entry.userId}>
        <TableCell>{entry.rank}</TableCell><TableCell><div className="flex items-center gap-3">
          <Avatar><AvatarImage src={entry.photoURL ?? undefined} alt="" /><AvatarFallback>{getInitials(entry.displayName)}</AvatarFallback></Avatar>
          <span className="font-medium">{entry.displayName}</span>
        </div></TableCell><TableCell className="text-right font-semibold">{entry.points}</TableCell>
      </TableRow>)}
    </TableBody>
  </Table>;
}

const label = (year: number) => `${year}–${year + 1}`;

export function SeasonLeaderboard() {
  const { supabase } = useSupabase();
  const { user } = useUser();
  const [standings, setStandings] = useState<Standings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const { data, error: rpcError } = await supabase.rpc('get_season_activity_leaderboard');
        if (cancelled) return;
        if (rpcError) throw rpcError;
        setStandings(data as Standings);
        setError(null);
      } catch {
        if (!cancelled) setError('Season standings could not be loaded. Please try again.');
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    // Refresh visible standings, including automatic season rollover, without a job.
    const interval = setInterval(() => void load(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [supabase, refresh]);

  const retry = useCallback(() => { setLoading(true); setRefresh(value => value + 1); }, []);
  const current = standings?.seasons.find(season => season.startYear === standings.currentSeason);
  const past = standings?.seasons.filter(season => season.startYear >= FIRST_AWARD_SEASON && season.startYear < standings.currentSeason) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Season Activity Leaderboard</CardTitle>
          <CardDescription>Earn 1 point per completed attempt, including retakes, up to 6 points per day. Days end at midnight Eastern. {standings?.nextRollover ? `Next season starts ${standings.nextRollover} at midnight Eastern.` : ''}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p role="status">Loading standings…</p>}
          {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div>}
          {standings?.myActivity && !error && <PersonalSeasonActivity activity={standings.myActivity} />}
          {current && <><h3 className="font-semibold">Current season · {label(current.startYear)}</h3><Rankings season={current} own={user && standings?.myActivity ? {
            userId: user.uid, displayName: user.displayName || 'You', photoURL: user.photoURL,
            points: standings.myActivity.seasonPoints, rank: standings.myActivity.rank,
            participating: standings.participating,
          } : undefined} /></>}
          {standings && !standings.participating && <p className="text-sm text-muted-foreground">Your row is private until you join. The rank shown is where your points would place on the leaderboard.</p>}
          {standings && !error && <SeasonAwardEnrollment season={standings.currentSeason} participating={standings.participating} onChanged={() => setRefresh(value => value + 1)} />}
          <p className="text-sm text-muted-foreground">Tied scores share the same rank.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Past seasons</CardTitle><CardDescription>Final standings from previous seasons.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {!loading && !error && past.length === 0 && <p className="text-muted-foreground">No completed seasons yet.</p>}
          {past.map(season => <details key={season.startYear} className="rounded-md border p-3"><summary className="cursor-pointer font-semibold">{label(season.startYear)} · Final standings</summary><Rankings season={season} /></details>)}
        </CardContent>
      </Card>
    </div>
  );
}
