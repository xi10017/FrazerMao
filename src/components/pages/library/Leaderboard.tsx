'use client';
import React, { useMemo } from 'react';
import { useEffect, useState } from 'react';
import { useSupabase } from '@/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDivisionLabel, DIVISIONS } from '@/lib/test-logic';
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
import { StudyGroups } from './StudyGroups';

function toLeaderboardEntry(row: Record<string, any>): LeaderboardEntry {
  return {
    userId: row.user_id,
    division: row.division,
    testsCompleted: row.tests_completed ?? 0,
    displayName: row.display_name ?? 'Anonymous User',
    photoURL: row.photo_url ?? null,
    showOnLeaderboard: row.show_on_leaderboard ?? true,
  };
}

const LeaderboardTable = ({
  entries,
  hiddenCount,
  isLoading,
  title,
}: {
  entries: LeaderboardEntry[] | null;
  hiddenCount?: number;
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
      <div className="text-center text-muted-foreground py-10 flex flex-col gap-2">
        <span>No one is sharing their score on the leaderboard yet.</span>
        {hiddenCount !== undefined && hiddenCount > 0 && (
          <span className="text-sm">
            ({hiddenCount} {hiddenCount === 1 ? 'user has' : 'users have'} their results hidden)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
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
      {hiddenCount !== undefined && hiddenCount > 0 && (
        <div className="text-center text-sm text-muted-foreground mt-4 py-3 border-t">
          {hiddenCount} {hiddenCount === 1 ? 'user has' : 'users have'} their results hidden.
        </div>
      )}
    </div>
  );
};

const DivisionLeaderboard = ({ division }: { division: string }) => {
  const { supabase } = useSupabase();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[] | null>(null);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLeaderboardLoading(true);
    supabase
      .from('leaderboard_by_division')
      .select('*')
      .order('tests_completed', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLeaderboardData(error ? [] : (data ?? []).map(toLeaderboardEntry));
        setIsLeaderboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);
    
  // Filter on the client-side
  const filteredData = useMemo(() => {
      if (!leaderboardData) return null;
      return leaderboardData
        .filter(entry => entry.showOnLeaderboard && entry.division === division && entry.testsCompleted > 0)
        .slice(0, 25);
  }, [leaderboardData, division]);

  const hiddenCount = useMemo(() => {
      if (!leaderboardData) return 0;
      return leaderboardData.filter(entry => entry.division === division && (!entry.showOnLeaderboard || entry.testsCompleted === 0)).length;
  }, [leaderboardData, division]);

  return (
    <LeaderboardTable
      entries={filteredData}
      hiddenCount={hiddenCount}
      isLoading={isLeaderboardLoading}
      title={division}
    />
  );
};

export const Leaderboard = () => {
  const { supabase } = useSupabase();
  const [overallData, setOverallData] = useState<LeaderboardEntry[] | null>(null);
  const [isOverallLoading, setIsOverallLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsOverallLoading(true);
    supabase
      .from('leaderboard_overall')
      .select('*')
      .order('tests_completed', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        setOverallData(error ? [] : (data ?? []).map(toLeaderboardEntry));
        setIsOverallLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filteredOverallData = useMemo(() => {
      // Filter on the client-side for privacy
      return overallData?.filter(entry => entry.showOnLeaderboard && entry.testsCompleted > 0).slice(0, 100) || null;
  }, [overallData]);

  const overallHiddenCount = useMemo(() => {
      if (!overallData) return 0;
      return overallData.filter(entry => !entry.showOnLeaderboard || entry.testsCompleted === 0).length;
  }, [overallData]);

  const divisions = [...DIVISIONS];

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overall">Rankings</TabsTrigger>
            <TabsTrigger value="by_division">By Division</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="overall" className="space-y-4 mt-4">
            <LeaderboardTable
              entries={filteredOverallData}
              hiddenCount={overallHiddenCount}
              isLoading={isOverallLoading}
              title="Overall"
            />
          </TabsContent>
          <TabsContent value="by_division" className="mt-4">
            <Tabs defaultValue={divisions[0]} className="mt-4">
              <TabsList className="flex h-auto w-full flex-wrap gap-1">
                {divisions.map((div) => (
                  <TabsTrigger key={div} value={div} className="flex-1 min-w-[5.5rem]">
                    {getDivisionLabel(div)}
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
          <TabsContent value="groups" className="mt-4">
            <StudyGroups />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
