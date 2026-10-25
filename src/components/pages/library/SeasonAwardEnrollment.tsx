'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SeasonAwardEnrollment({ season, participating, onChanged }: {
  season: number; participating: boolean; onChanged: () => void;
}) {
  const { supabase } = useSupabase();
  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    void supabase.rpc('get_my_season_award_details').then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data || data.seasonYear !== season) setError('Could not load award details. Refresh and try again.');
      else { setFullName(data.fullName); setSchool(data.school); setConfirmed(data.confirmed); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase, season, reload]);
  const leave = async () => {
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.rpc('set_season_participation', { join_season: false });
      if (error) throw error;
      onChanged();
    } catch { setError('Could not leave this season. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-md border p-4">
    <p className="font-medium">{participating ? 'You’re participating this season.' : 'Join the season activity award'}</p>
    <p className="text-sm text-muted-foreground">Your display name and season points will be public. Your full name and school are private and visible only to you and award administrators. Joining enters you into award consideration; earlier practice this season counts.</p>
    {loading ? <p role="status">Loading your details…</p> : (!participating || !confirmed || editing) ? <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(null);
      try {
        const { error } = await supabase.rpc('join_season_award', { full_name_input: fullName, school_input: school, expected_season: season });
        if (error) throw error;
        setConfirmed(true); setEditing(false); onChanged();
      } catch (error) { setError((error as { message?: string })?.message ?? 'Could not confirm your details.'); }
      finally { setBusy(false); }
    }}>
      <div className="space-y-2"><Label htmlFor="award-full-name">Full name (private)</Label><Input id="award-full-name" autoComplete="name" required maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="award-school">School (private)</Label><Input id="award-school" autoComplete="organization" required maxLength={160} value={school} onChange={e=>setSchool(e.target.value)} /></div>
      <p className="text-sm text-muted-foreground">Confirm these details each season. Your previous details are prefilled when available.</p>
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : participating ? 'Confirm award details' : 'Confirm details and join'}</Button>
    </form> : <div className="space-y-2"><p className="text-sm">Award details confirmed for this season.</p><Button variant="outline" disabled={busy} onClick={()=>setEditing(true)}>Edit private details</Button></div>}
    {participating && <Button variant="outline" disabled={busy || loading} onClick={()=>void leave()}>Leave this season</Button>}
    {error && <div role="alert"><p className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={busy} onClick={()=>setReload(n=>n+1)}>Reload details</Button></div>}
  </div>;
}
