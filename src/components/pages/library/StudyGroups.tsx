'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { GroupMember, GroupMembership } from '@/lib/types';
import { createStudyGroup, joinStudyGroup, syncUserGroupMemberStats } from '@/lib/study-groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';
import { Users, Copy } from 'lucide-react';

export const StudyGroups = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<{
    id: string;
    groupName: string;
    inviteCode: string;
  } | null>(null);

  const membershipsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'groupMemberships'));
  }, [firestore, user]);

  const { data: memberships, isLoading: isMembershipsLoading } =
    useCollection<GroupMembership & { id: string }>(membershipsQuery);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !selectedGroupId) return null;
    return query(
      collection(firestore, 'study_groups', selectedGroupId, 'members'),
      orderBy('testsCompleted', 'desc')
    );
  }, [firestore, selectedGroupId]);

  const { data: members, isLoading: isMembersLoading } =
    useCollection<GroupMember>(membersQuery);

  const displayMemberships = useMemo(() => {
    const fromFirestore = memberships ?? [];
    if (pendingGroup && !fromFirestore.some((m) => m.id === pendingGroup.id)) {
      return [
        {
          id: pendingGroup.id,
          groupId: pendingGroup.id,
          groupName: pendingGroup.groupName,
          inviteCode: pendingGroup.inviteCode,
          joinedAt: new Date(),
        },
        ...fromFirestore,
      ];
    }
    return fromFirestore;
  }, [memberships, pendingGroup]);

  useEffect(() => {
    if (!user || !firestore) return;
    syncUserGroupMemberStats(firestore, user).catch((error) => {
      console.error('Failed to sync group member stats:', error);
    });
  }, [user, firestore]);

  useEffect(() => {
    if (
      pendingGroup &&
      memberships?.some((membership) => membership.id === pendingGroup.id)
    ) {
      setPendingGroup(null);
    }
  }, [memberships, pendingGroup]);

  useEffect(() => {
    if (!selectedGroupId && displayMemberships.length > 0) {
      setSelectedGroupId(displayMemberships[0].id);
    }
  }, [displayMemberships, selectedGroupId]);

  const selectedMembership = displayMemberships.find(
    (m) => m.id === selectedGroupId
  );

  const visibleMembers = useMemo(() => {
    return (members ?? []).filter((m) => m.showOnLeaderboard !== false);
  }, [members]);

  const handleCreateGroup = async () => {
    if (!user || !firestore) return;
    setIsCreating(true);
    try {
      const group = await createStudyGroup(firestore, user, newGroupName);
      setNewGroupName('');
      setPendingGroup({
        id: group.id,
        groupName: group.name,
        inviteCode: group.inviteCode,
      });
      setSelectedGroupId(group.id);
      toast({
        title: 'Group created',
        description: `Invite code: ${group.inviteCode}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not create group',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!user || !firestore) return;
    setIsJoining(true);
    try {
      const group = await joinStudyGroup(firestore, user, inviteCodeInput);
      setInviteCodeInput('');
      setPendingGroup({
        id: group.id,
        groupName: group.name,
        inviteCode: group.inviteCode,
      });
      setSelectedGroupId(group.id);
      toast({ title: 'Joined group', description: group.name });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not join group',
        description: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: 'Invite code copied' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not copy code',
      });
    }
  };

  if (isMembershipsLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="group-name">Create a study group</Label>
          <div className="flex gap-2">
            <Input
              id="group-name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Chapter Mu Team"
            />
            <Button
              onClick={handleCreateGroup}
              disabled={isCreating || !newGroupName.trim()}
            >
              Create
            </Button>
          </div>
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="invite-code">Join with invite code</Label>
          <div className="flex gap-2">
            <Input
              id="invite-code"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
            <Button
              onClick={handleJoinGroup}
              disabled={isJoining || !inviteCodeInput.trim()}
            >
              Join
            </Button>
          </div>
        </div>
      </div>

      {displayMemberships.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {displayMemberships.map((membership) => (
              <Button
                key={membership.id}
                variant={selectedGroupId === membership.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedGroupId(membership.id)}
              >
                <Users className="mr-2 h-4 w-4" />
                {membership.groupName}
              </Button>
            ))}
          </div>

          {selectedGroupId && selectedMembership && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Invite code:</span>
                <code className="rounded bg-muted px-2 py-1 font-mono">
                  {selectedMembership.inviteCode}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyInviteCode(selectedMembership.inviteCode)}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              </div>

              {isMembersLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Tests Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleMembers.length > 0 ? (
                      visibleMembers.map((member, index) => (
                        <TableRow key={member.userId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <p className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.photoURL ?? undefined} />
                                <AvatarFallback>
                                  {getInitials(member.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.displayName}</span>
                            </p>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {member.testsCompleted}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-8"
                        >
                          No members visible yet. Turn on &quot;Show on
                          Leaderboards&quot; in Settings to appear here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-6">
          Create or join a group to compete with your chapter or study buddies.
        </p>
      )}
    </div>
  );
};
