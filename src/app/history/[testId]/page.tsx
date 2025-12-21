'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase';
import type { FamatTest, TestSubmission, AnyFamatTest } from '@/lib/types';
import famatTests from '@/data/famat_tests.json';
import { getTestId, getTestName } from '@/lib/test-logic';
import { getSubmissionsForUser } from '@/lib/localStorage';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft } from 'lucide-react';
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

  const { user, isUserLoading } = useUser();
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const test = useMemo(() => {
    return (famatTests as AnyFamatTest[])
      .filter((t) => t.document_type === 'Test')
      .map((t) => ({ ...t, id: getTestId(t) }))
      .find((t) => t.id === testId) as FamatTest | undefined;
  }, [testId]);

  useEffect(() => {
    setIsLoading(true);
    if (user && testId) {
      const allSubmissions = getSubmissionsForUser(user.uid);
      const testSubmissions = allSubmissions
        .filter((sub) => sub.testId === testId)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      setSubmissions(testSubmissions);
    } else {
      setSubmissions([]);
    }
    setIsLoading(false);
  }, [user, testId]);

  if (isLoading || isUserLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center">
           <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/2" />
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
    // Pass the specific answers from that submission to the practice page for review.
    const submissionData = encodeURIComponent(JSON.stringify(submission.answers));
    router.push(`/practice/${testId}?fromHistory=true&submission=${submissionData}`);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
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
          {submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Date Taken</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center text-green-400">Correct</TableHead>
                  <TableHead className="text-center text-red-400">Incorrect</TableHead>
                  <TableHead className="text-center text-yellow-400">Omitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {format(sub.submittedAt, 'PPP p')}
                    </TableCell>
                    <TableCell className="text-center text-lg font-bold text-primary">
                      {sub.score.totalScore}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {sub.score.correctCount}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {sub.score.incorrectCount}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {sub.score.omitCount}
                    </TableCell>
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
