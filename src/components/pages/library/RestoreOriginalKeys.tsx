'use client';

import { useState } from 'react';
import { useSupabase } from '@/supabase';
import { useAnswerKeyOverridesContext } from '@/contexts/AnswerKeyOverridesContext';
import { formatAnswerKeyValue } from '@/lib/answer-key-reports';
import { getCatalogAnswerForQuestion } from '@/lib/test-logic';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function RestoreOriginalKeyButton({ testId, question }: { testId: string; question: number }) {
  const { supabase } = useSupabase();
  const { overridesByTestId, refresh, isLoading } = useAnswerKeyOverridesContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const current = overridesByTestId[testId]?.[question];
  const original = getCatalogAnswerForQuestion(testId, question);
  if (isLoading) return <Button variant="outline" size="sm" disabled>Loading key…</Button>;
  if (current === undefined) return <Button variant="outline" size="sm" disabled title="There is no active correction for this question.">Original key active</Button>;
  return <div className="space-y-2">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {message && <p role="status">{message}</p>}
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={busy || original === null}>Restore original key</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Restore original key?</AlertDialogTitle><AlertDialogDescription>Question {question} will change from {formatAnswerKeyValue(current)} to {original === null ? 'the original answer' : formatAnswerKeyValue(original)}. This removes the active correction and records who restored it. Existing attempts follow the usual regrading behavior.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={async () => {
                setBusy(true); setError(null); setMessage(null);
                try {
                  const { error } = await supabase.rpc('restore_original_answer_key', { target_test_id: testId, target_question: question, expected_answer: current });
                  if (error) throw error;
                  await refresh(); setMessage(`Original key restored for Q${question}.`);
                } catch (error) {
                  setError((error as { message?: string })?.message ?? 'Could not restore the original key.');
                } finally { setBusy(false); }
              }}>Restore original key</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
    </div>;
}
