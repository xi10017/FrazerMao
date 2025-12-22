'use client';
import React, { useMemo, useState } from 'react';
import {
  useCollection,
  useFirebase,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  DocumentData,
} from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaderboardEntry } from '@/lib/types';
import { Trophy } from 'lucide-react';

function getInitials(name?: string | null) {
  if (!name) return '?';
  const names = name.split(' ');
  const initials = names.map((n) => n[0]).join('');
  return initials.length > 2 ? initials.substring(0, 2) : initials;
}

const LeaderboardTable = ({
  entries,
  isLoading,
  title,
}: {
  entries: (LeaderboardEntry & { id: string })[] | null;
  isLoading: boolean;
  title: string;
}) => {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-400';
      case 2:
        return 'text-gray-400';
      case 3:
        return 'text-orange-400';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }
  
  if (!entries || entries.length === 0) {
      return (
          <div className="text-center text-muted-foreground py-10">
              No leaderboard data available yet.
          </div>
      )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Tests Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => {
          const rank = index + 1;
          return (
            <TableRow key={entry.id}>
              <TableCell>
                <div className="flex items-center justify-center">
                  <span
                    className={`text-xl font-bold ${getRankColor(rank)}`}
                  >
                    {rank <= 3 ? <Trophy className="h-5 w-5" /> : rank}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={entry.photoURL ?? undefined} />
                    <AvatarFallback>{getInitials(entry.displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {entry.displayName || 'Anonymous User'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {title} Division
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right text-lg font-bold text-primary">
                {entry.testsCompleted}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const DivisionLeaderboard = ({ division }: { division: string }) => {
  const firestore = useFirestore();
  const leaderBoardQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(
        collection(firestore, 'leaderboard_by_division'),
        orderBy('testsCompleted', 'desc'),
        limit(25)
      );
    },
    [firestore]
  );
  
  const {
    data: leaderboardData,
    isLoading: isLeaderboardLoading,
  } = useCollection<LeaderboardEntry>(leaderBoardQuery);
  
  const filteredEntries = useMemo(() => {
      return leaderboardData?.filter(entry => entry.division === division) || [];
  }, [leaderboardData, division])

  return (
    <LeaderboardTable
      entries={filteredEntries}
      isLoading={isLeaderboardLoading}
      title={division}
    />
  );
};

export const Leaderboard = () => {
  const firestore = useFirestore();

  const overallLeaderboardQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(
        collection(firestore, 'leaderboard_overall'),
        orderBy('testsCompleted', 'desc'),
        limit(100)
      );
    },
    [firestore]
  );
  const {
    data: overallData,
    isLoading: isOverallLoading,
  } = useCollection<LeaderboardEntry>(overallLeaderboardQuery);

  const divisions = ['Stats', 'Calculus', 'Pre-calculus', 'Algebra 2', 'Geometry'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          See who has completed the most tests. Rankings are updated periodically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overall">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="by_division">By Division</TabsTrigger>
          </TabsList>
          <TabsContent value="overall">
            <LeaderboardTable
              entries={overallData}
              isLoading={isOverallLoading}
              title="Overall"
            />
          </TabsContent>
          <TabsContent value="by_division">
            <Tabs defaultValue="Stats" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                {divisions.map((div) => (
                  <TabsTrigger key={div} value={div}>
                    {div}
                  </TabsTrigger>
                ))}
              </TabsList>
              {divisions.map((div) => (
                <TabsContent key={div} value={div}>
                  <DivisionLeaderboard division={div} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
