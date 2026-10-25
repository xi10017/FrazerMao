'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSupabase, useUser } from '@/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RolloverSettings { currentSeason: number; nextYear: number; nextRollover: string; month: number; day: number }
export default function SeasonSettingsPage() {
  const { supabase } = useSupabase();
  const { isAdmin, isUserLoading } = useUser();
  const [settings, setSettings] = useState<RolloverSettings | null>(null);
  const [month, setMonth] = useState('4');
  const [day, setDay] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_season_rollover_settings');
    if (error) { setError('Could not load season settings. Check the database migration and try again.'); return; }
    const next = data as RolloverSettings;
    setSettings(next); setMonth(String(next.month)); setDay(String(next.day)); setError(null);
  }, [supabase]);
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  if (isUserLoading) return <p className="p-6">Loading…</p>;
  if (!isAdmin) return <p className="p-6">Admin access required.</p>;
  const preview = settings ? `${settings.nextYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';
  return <div className="container mx-auto max-w-2xl p-4 sm:p-6">
    <Card>
      <CardHeader><CardTitle>Season rollover</CardTitle><CardDescription>Changes affect only rollovers that have not happened yet. Completed seasons, points, and participation stay unchanged.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Reload settings</Button></div>}
        {!settings && !error && <p>Loading settings…</p>}
        {settings && <form className="space-y-4" onSubmit={async event => {
          event.preventDefault(); setSaving(true); setMessage(null); setError(null);
          try {
            const { data, error } = await supabase.rpc('set_season_rollover_settings', {
              rollover_month: Number(month), rollover_day: Number(day), expected_next_year: settings.nextYear,
            });
            if (error) throw error;
            const next = data as RolloverSettings;
            setSettings(next); setMessage(`Saved. Next rollover: ${next.nextRollover} at midnight Eastern.`);
          } catch (error) {
            setError(error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Could not save settings. Please try again.');
          } finally { setSaving(false); }
        }}>
          <p>Currently scheduled: <strong>{settings.nextRollover}</strong> at midnight Eastern.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="rollover-month">Month (1–12)</Label><Input id="rollover-month" type="number" min="1" max="12" step="1" required value={month} onChange={e => setMonth(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="rollover-day">Day</Label><Input id="rollover-day" type="number" min="1" max="31" step="1" required value={day} onChange={e => setDay(e.target.value)} /></div>
          </div>
          <p>Saving will schedule <strong>{preview}</strong> at midnight Eastern, then repeat that month and day annually.</p>
          <p className="text-sm text-muted-foreground">If April 1 has already passed and the season rolled over, changing to April 18 affects next year. Past dates and February 29 are not accepted.</p>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save rollover date'}</Button>
        </form>}
        {message && <p role="status">{message}</p>}
      </CardContent>
    </Card>
  </div>;
}
