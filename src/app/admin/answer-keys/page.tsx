'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { isAdminUid } from '@/lib/admin';
import {
  ANSWER_KEY_ARCHIVE_DAYS,
  approveAnswerKeyReport,
  formatAnswerKeyValue,
  getArchivedAnswerKeyReports,
  getPendingAnswerKeyReports,
  groupPendingAnswerKeyReports,
  rejectAnswerKeyReport,
  reportsProposeChange,
  SUPERSEDED_REPORT_NOTE,
  type AnswerKeyReportGroup,
} from '@/lib/answer-key-reports';
import { useAnswerKeyOverridesContext } from '@/contexts/AnswerKeyOverridesContext';
import type { AnswerKeyReport } from '@/lib/types';
import {
  answerKeyValuesEqual,
  buildBrowseTestUrl,
  getCatalogAnswerForQuestion,
  getEffectiveAnswerForQuestion,
} from '@/lib/test-logic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { AlertTriangle, Check, ExternalLink, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function ReportGroupCard({
  group,
  catalogAnswer,
  effectiveAnswer,
  hasLiveOverride,
  rejectNotes,
  actingId,
  onRejectNoteChange,
  onApprove,
  onReject,
}: {
  group: AnswerKeyReportGroup;
  catalogAnswer: string | string[] | null;
  effectiveAnswer: string | string[] | null;
  hasLiveOverride: boolean;
  rejectNotes: Record<string, string>;
  actingId: string | null;
  onRejectNoteChange: (reportId: string, note: string) => void;
  onApprove: (report: AnswerKeyReport) => void;
  onReject: (reportId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{group.testName}</CardTitle>
            <CardDescription>
              Question {group.questionNumber}
              {group.reports.length > 1 &&
                ` · ${group.reports.length} reports`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {group.hasConflictingProposals && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Conflicting proposals
              </Badge>
            )}
            <Button variant="outline" size="sm" asChild>
              <a
                href={buildBrowseTestUrl(group.testId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View test
              </a>
            </Button>
            <Badge variant="outline">Pending</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Catalog (JSON): </span>
            <span className="font-medium">
              {catalogAnswer != null
                ? formatAnswerKeyValue(catalogAnswer)
                : 'Unknown'}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Current (live): </span>
            <span className="font-medium text-primary">
              {effectiveAnswer != null
                ? formatAnswerKeyValue(effectiveAnswer)
                : 'Unknown'}
            </span>
          </p>
          {hasLiveOverride && (
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              An approved override is already active for this question.
            </p>
          )}
        </div>

        <div className="space-y-4">
          {group.reports.map((report) => {
            const isNoOp =
              effectiveAnswer != null &&
              !reportsProposeChange(report, effectiveAnswer);

            return (
              <div
                key={report.id}
                className="rounded-md border p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {report.userDisplayName} ·{' '}
                    {format(report.createdAt, 'PPP p')}
                  </p>
                  {isNoOp && (
                    <Badge variant="secondary">Matches current answer</Badge>
                  )}
                </div>

                <p className="text-sm">
                  <span className="text-muted-foreground">Proposed: </span>
                  <span className="font-medium">
                    {formatAnswerKeyValue(report.proposedAnswer)}
                  </span>
                </p>

                <p className="text-sm rounded-md border bg-muted/20 p-3">
                  {report.message || (
                    <span className="text-muted-foreground italic">
                      No message provided.
                    </span>
                  )}
                </p>

                <Textarea
                  placeholder="Optional note if rejecting…"
                  value={rejectNotes[report.id] ?? ''}
                  onChange={(e) =>
                    onRejectNoteChange(report.id, e.target.value)
                  }
                  rows={2}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => onApprove(report)}
                    disabled={actingId != null}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onReject(report.id)}
                    disabled={actingId != null}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ArchiveReportCard({ report }: { report: AnswerKeyReport }) {
  const isApproved = report.status === 'approved';
  const isSuperseded = report.adminNote === SUPERSEDED_REPORT_NOTE;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{report.testName}</CardTitle>
            <CardDescription>
              Q{report.questionNumber} · {report.userDisplayName} · reviewed{' '}
              {report.reviewedAt
                ? format(report.reviewedAt, 'PPP p')
                : '—'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={buildBrowseTestUrl(report.testId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View test
              </a>
            </Button>
            <Badge variant={isApproved ? 'default' : 'secondary'}>
              {isApproved ? 'Approved' : isSuperseded ? 'Auto-closed' : 'Rejected'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Was (at report): </span>
            <span className="font-medium">
              {formatAnswerKeyValue(report.currentAnswer)}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Proposed: </span>
            <span className="font-medium">
              {formatAnswerKeyValue(report.proposedAnswer)}
            </span>
          </p>
        </div>
        {report.message && (
          <p className="rounded-md border bg-muted/20 p-3">{report.message}</p>
        )}
        {report.adminNote && (
          <p className="rounded-md border border-dashed bg-muted/10 p-3 text-sm">
            <span className="font-medium text-muted-foreground">
              {isSuperseded ? 'System note: ' : 'Admin note: '}
            </span>
            {report.adminNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAnswerKeysPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { overridesByTestId, refresh: refreshOverrides } =
    useAnswerKeyOverridesContext();

  const [tab, setTab] = useState<'pending' | 'archive'>('pending');
  const [reports, setReports] = useState<AnswerKeyReport[]>([]);
  const [archivedReports, setArchivedReports] = useState<AnswerKeyReport[]>(
    []
  );
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const isAdmin = isAdminUid(user?.uid);

  const groups = useMemo(
    () => groupPendingAnswerKeyReports(reports),
    [reports]
  );

  const groupAnswerContext = useMemo(() => {
    const context: Record<
      string,
      {
        catalogAnswer: string | string[] | null;
        effectiveAnswer: string | string[] | null;
        hasLiveOverride: boolean;
      }
    > = {};
    for (const group of groups) {
      const overrides = overridesByTestId[group.testId];
      const catalogAnswer = getCatalogAnswerForQuestion(
        group.testId,
        group.questionNumber
      );
      const effectiveAnswer = getEffectiveAnswerForQuestion(
        group.testId,
        group.questionNumber,
        overrides
      );
      context[group.key] = {
        catalogAnswer,
        effectiveAnswer,
        hasLiveOverride:
          catalogAnswer != null &&
          effectiveAnswer != null &&
          !answerKeyValuesEqual(catalogAnswer, effectiveAnswer),
      };
    }
    return context;
  }, [groups, overridesByTestId]);

  const loadPending = useCallback(async () => {
    if (!firestore || !isAdmin) return;
    setIsPendingLoading(true);
    try {
      const pending = await getPendingAnswerKeyReports(firestore);
      setReports(pending);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load reports',
        description: 'Check Firestore rules and composite indexes.',
      });
    } finally {
      setIsPendingLoading(false);
    }
  }, [firestore, isAdmin, toast]);

  const loadArchive = useCallback(async () => {
    if (!firestore || !isAdmin) return;
    setIsArchiveLoading(true);
    try {
      const archived = await getArchivedAnswerKeyReports(firestore);
      setArchivedReports(archived);
    } catch (error) {
      console.error('Failed to load archive:', error);
      const code = (error as { code?: string })?.code;
      toast({
        variant: 'destructive',
        title: 'Failed to load archive',
        description:
          code === 'permission-denied'
            ? 'Admin Firestore access required (admins/{uid} doc).'
            : code === 'failed-precondition'
              ? 'Firestore index is still building — try again in a minute.'
              : 'Could not load closed reports.',
      });
    } finally {
      setIsArchiveLoading(false);
    }
  }, [firestore, isAdmin, toast]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !isAdmin) {
      setIsPendingLoading(false);
      return;
    }
    loadPending();
  }, [user, isAdmin, isUserLoading, loadPending]);

  useEffect(() => {
    if (tab !== 'archive' || !user || !isAdmin) return;
    loadArchive();
  }, [tab, user, isAdmin, loadArchive]);

  const removeReportsForQuestion = useCallback(
    (testId: string, questionNumber: number) => {
      setReports((prev) =>
        prev.filter(
          (r) =>
            !(r.testId === testId && r.questionNumber === questionNumber)
        )
      );
    },
    []
  );

  const handleApprove = async (report: AnswerKeyReport) => {
    if (!firestore || !user) return;
    setActingId(report.id);
    try {
      const { rejectedIds } = await approveAnswerKeyReport(
        firestore,
        user.uid,
        report
      );
      await refreshOverrides();
      removeReportsForQuestion(report.testId, report.questionNumber);
      if (tab === 'archive') loadArchive();
      const closedCount = rejectedIds.length;
      toast({
        title: 'Approved',
        description:
          closedCount > 0
            ? `Q${report.questionNumber} updated. ${closedCount} other report${closedCount === 1 ? '' : 's'} auto-closed.`
            : `Q${report.questionNumber} on ${report.testName} updated live.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Approve failed',
        description: 'Could not apply override. Check admin Firestore access.',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (reportId: string) => {
    if (!firestore || !user) return;
    setActingId(reportId);
    try {
      await rejectAnswerKeyReport(
        firestore,
        user.uid,
        reportId,
        rejectNotes[reportId]
      );
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (tab === 'archive') loadArchive();
      toast({ title: 'Report rejected' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Reject failed',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleRejectNoteChange = useCallback((reportId: string, note: string) => {
    setRejectNotes((prev) => ({ ...prev, [reportId]: note }));
  }, []);

  if (isUserLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto max-w-lg p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              This page is only available to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Back to library</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Answer key reports</h1>
        <p className="text-muted-foreground mt-1">
          Review pending disputes. Archive shows approved and rejected reports
          from the last {ANSWER_KEY_ARCHIVE_DAYS} days; older closed reports are
          deleted automatically (overrides are kept).
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'pending' | 'archive')}
      >
        <TabsList>
          <TabsTrigger value="pending">
            Pending{reports.length > 0 ? ` (${reports.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-4">
          {isPendingLoading ? (
            <>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No pending reports.
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => {
              const ctx = groupAnswerContext[group.key];
              return (
                <ReportGroupCard
                  key={group.key}
                  group={group}
                  catalogAnswer={ctx?.catalogAnswer ?? null}
                  effectiveAnswer={ctx?.effectiveAnswer ?? null}
                  hasLiveOverride={ctx?.hasLiveOverride ?? false}
                  rejectNotes={rejectNotes}
                  actingId={actingId}
                  onRejectNoteChange={handleRejectNoteChange}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              );
            })
          )}
        </TabsContent>

        <TabsContent value="archive" className="mt-6 space-y-4">
          {isArchiveLoading ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : archivedReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No closed reports in the last {ANSWER_KEY_ARCHIVE_DAYS} days.
              </CardContent>
            </Card>
          ) : (
            archivedReports.map((report) => (
              <ArchiveReportCard key={report.id} report={report} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
