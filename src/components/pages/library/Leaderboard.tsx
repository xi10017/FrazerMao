'use client';
import React, { useMemo } from 'react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  where
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
import { getInitials } from '@/lib/utils';

const LeaderboardTable = ({
  entries,
  isLoading,
  title,
}: {
  entries: LeaderboardEntry[] | null;
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
        No one is sharing their score on the leaderboard yet.
      </div>
    );
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
            <TableRow key={entry.userId + (entry.division || '')}>
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
                      {title !== 'Overall' ? `${title} Division` : 'Overall'}
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
  
  // Query only by ordering, remove the 'where' clause to avoid needing a composite index.
  const leaderBoardQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'leaderboard_by_division'),
      orderBy('testsCompleted', 'desc'),
      limit(200) // Fetch more to allow for client-side filtering
    );
  }, [firestore]);

  const { data: leaderboardData, isLoading: isLeaderboardLoading } =
    useCollection<LeaderboardEntry>(leaderBoardQuery);
    
  // Filter on the client-side
  const filteredData = useMemo(() => {
      if (!leaderboardData) return null;
      return leaderboardData
        .filter(entry => entry.showOnLeaderboard && entry.division === division)
        .slice(0, 25);
  }, [leaderboardData, division]);

  return (
    <LeaderboardTable
      entries={filteredData}
      isLoading={isLeaderboardLoading}
      title={division}
    />
  );
};

export const Leaderboard = () => {
  const firestore = useFirestore();

  const overallLeaderboardQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Query without `where` to avoid needing a composite index
    return query(
      collection(firestore, 'leaderboard_overall'),
      orderBy('testsCompleted', 'desc'),
      limit(200) // Fetch more to allow for client-side filtering
    );
  }, [firestore]);
  
  const { data: overallData, isLoading: isOverallLoading } =
    useCollection<LeaderboardEntry>(overallLeaderboardQuery);

  const filteredOverallData = useMemo(() => {
      // Filter on the client-side for privacy
      return overallData?.filter(entry => entry.showOnLeaderboard).slice(0, 100) || null;
  }, [overallData]);

  const divisions = ['Stats', 'Calculus', 'Alpha', 'Pre-calculus', 'Algebra 2', 'Geometry'];

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
              entries={filteredOverallData}
              isLoading={isOverallLoading}
              title="Overall"
            />
          </TabsContent>
          <TabsContent value="by_division">
            <Tabs defaultValue={divisions[0]} className="mt-4">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-3 md:grid-cols-6">
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
