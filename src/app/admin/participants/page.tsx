'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '@/supabase';
import { SeasonAwardParticipants } from '@/components/pages/admin/SeasonAwardParticipants';
import { Button } from '@/components/ui/button';

export default function ParticipantDetailsPage() {
  const { supabase } = useSupabase();
  const [season, setSeason] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setError(false);
    const { data, error } = await supabase.rpc('get_season_rollover_settings');
    if (error) { setError(true); return; }
    setSeason(data.currentSeason);
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <div role="alert" className="space-y-2"><p>Could not load the current season. Check the database migration and try again.</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div>;
  return season === null ? <p role="status">Loading season…</p> : <SeasonAwardParticipants currentSeason={season} />;
}
