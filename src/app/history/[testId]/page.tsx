'use client';

import React, { useMemo } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { FamatTest, TestSubmission, AnyFamatTest } from '@/lib/types';
import famatTests from '@/data/famat_tests.json';
import { getTestId, getTestName } from '@/lib/test-logic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

function HistoryPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const test = useMemo(() => {
    return (famatTests as AnyFamatTest[])
      .filter((t) => t.document_type === 'Test')
      .map((t) => ({ ...t, id: getTestId(t) }))
      .find((t) => t.id === testId) as FamatTest | undefined;
  }, [testId]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !testId) return null;
    return query(
      collection(firestore, 'users', user.uid, 'submissions'),
      where('testId', '==', testId),
      orderBy('submittedAt', 'desc')
    );
  }, [firestore, user?.uid, testId]);

  const {
    data: submissions,
    loading: submissionsLoading,
    error,
  } = useCollection<TestSubmission>(submissionsQuery);

  if (userLoading || submissionsLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-1/2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!test) {
    notFound();
  }
  
  const handleReview = (submission: TestSubmission) => {
    const submissionData = encodeURIComponent(JSON.stringify(submission.answers));
    router.push(`/practice/${testId}?fromHistory=true&submission=${submissionData}`);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
       <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Library
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            History for: <span className="text-primary">{test.division}</span>
          </CardTitle>
          <CardDescription>{getTestName(test)}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500">Error loading history: {error.message}</p>}
          {submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Date Taken</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center text-green-500">Correct</TableHead>
                  <TableHead className="text-center text-red-500">Incorrect</TableHead>
                  <TableHead className="text-center text-yellow-500">Omitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.submittedAt ? format(sub.submittedAt.toDate(), 'PPP p') : 'Just now'}
                    </TableCell>
                    <TableCell className="text-center text-lg font-bold text-primary">{sub.score.totalScore}</TableCell>
                    <TableCell className="text-center font-medium">{sub.score.correctCount}</TableCell>
                    <TableCell className="text-center font-medium">{sub.score.incorrectCount}</TableCell>
                    <TableCell className="text-center font-medium">{sub.score.omitCount}</TableCell>
                    <TableCell className="text-right">
                      <Button onClick={() => handleReview(sub)}>
                        Review <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
              <h3 className="text-xl font-semibold">No History Found</h3>
              <p className="mt-2 text-muted-foreground">
                You haven't taken this test yet.
              </p>
               <Button asChild className="mt-4">
                  <Link href={`/practice/${test.id}`}>
                    Take Test
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HistoryPage;
