'use client';

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  writeBatch,
  increment,
  deleteDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { GroupMembership, StudyGroup, GroupMember } from './types';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function getUserGroupStats(
  db: Firestore,
  userId: string
): Promise<{ testsCompleted: number; showOnLeaderboard: boolean }> {
  const [completionsSnap, profileSnap] = await Promise.all([
    getDocs(collection(db, 'users', userId, 'testCompletions')),
    getDoc(doc(db, 'users', userId)),
  ]);

  return {
    testsCompleted: completionsSnap.size,
    showOnLeaderboard: profileSnap.exists()
      ? profileSnap.data()?.showOnLeaderboard ?? true
      : true,
  };
}

function buildMemberData(
  user: User,
  stats: { testsCompleted: number; showOnLeaderboard: boolean }
): GroupMember {
  return {
    userId: user.uid,
    displayName: user.displayName || 'Anonymous User',
    photoURL: user.photoURL,
    testsCompleted: stats.testsCompleted,
    showOnLeaderboard: stats.showOnLeaderboard,
  };
}

export async function createStudyGroup(
  db: Firestore,
  user: User,
  name: string
): Promise<StudyGroup> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Group name is required');

  const groupRef = doc(collection(db, 'study_groups'));
  const inviteCode = generateInviteCode();

  const groupData = {
    name: trimmed,
    inviteCode,
    createdBy: user.uid,
    memberCount: 1,
    createdAt: Timestamp.now(),
  };

  await setDoc(groupRef, groupData);

  const stats = await getUserGroupStats(db, user.uid);
  const memberData = buildMemberData(user, stats);

  await setDoc(doc(db, 'study_groups', groupRef.id, 'members', user.uid), memberData);
  await setDoc(doc(db, 'users', user.uid, 'groupMemberships', groupRef.id), {
    groupId: groupRef.id,
    groupName: trimmed,
    inviteCode,
    joinedAt: Timestamp.now(),
  } satisfies Omit<GroupMembership, 'joinedAt'> & { joinedAt: Timestamp });

  return {
    id: groupRef.id,
    name: groupData.name,
    inviteCode: groupData.inviteCode,
    createdBy: groupData.createdBy,
    memberCount: groupData.memberCount,
    createdAt: groupData.createdAt.toDate(),
  };
}

export async function joinStudyGroup(
  db: Firestore,
  user: User,
  inviteCode: string
): Promise<StudyGroup> {
  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) throw new Error('Invite code is required');

  const groupsQuery = query(
    collection(db, 'study_groups'),
    where('inviteCode', '==', normalized),
    limit(1)
  );
  const snapshot = await getDocs(groupsQuery);
  if (snapshot.empty) throw new Error('Invalid invite code');

  const groupDoc = snapshot.docs[0];
  const group = { id: groupDoc.id, ...(groupDoc.data() as Omit<StudyGroup, 'id'>) };

  const memberRef = doc(db, 'study_groups', group.id, 'members', user.uid);
  const existingMember = await getDoc(memberRef);
  if (existingMember.exists()) return group;

  const stats = await getUserGroupStats(db, user.uid);

  await setDoc(memberRef, buildMemberData(user, stats));

  await setDoc(doc(db, 'users', user.uid, 'groupMemberships', group.id), {
    groupId: group.id,
    groupName: group.name,
    inviteCode: group.inviteCode,
    joinedAt: Timestamp.now(),
  });

  await setDoc(
    doc(db, 'study_groups', group.id),
    { memberCount: increment(1) },
    { merge: true }
  );

  return group;
}

export async function updateGroupMemberStats(
  db: Firestore,
  user: User,
  testsCompleted: number,
  showOnLeaderboard: boolean
): Promise<void> {
  const membershipsSnap = await getDocs(
    collection(db, 'users', user.uid, 'groupMemberships')
  );
  if (membershipsSnap.empty) return;

  const batch = writeBatch(db);
  for (const membershipDoc of membershipsSnap.docs) {
    const groupId = membershipDoc.id;
    batch.set(
      doc(db, 'study_groups', groupId, 'members', user.uid),
      {
        userId: user.uid,
        displayName: user.displayName || 'Anonymous User',
        photoURL: user.photoURL,
        testsCompleted,
        showOnLeaderboard,
      },
      { merge: true }
    );
  }
  await batch.commit();
}

/** Refreshes the current user's stats in every group they belong to. */
export async function syncUserGroupMemberStats(
  db: Firestore,
  user: User
): Promise<void> {
  const stats = await getUserGroupStats(db, user.uid);
  await updateGroupMemberStats(
    db,
    user,
    stats.testsCompleted,
    stats.showOnLeaderboard
  );
}

export async function leaveStudyGroup(
  db: Firestore,
  user: User,
  groupId: string
): Promise<void> {
  await deleteDoc(doc(db, 'study_groups', groupId, 'members', user.uid));
  await deleteDoc(doc(db, 'users', user.uid, 'groupMemberships', groupId));

  const groupRef = doc(db, 'study_groups', groupId);
  const membersSnap = await getDocs(
    collection(db, 'study_groups', groupId, 'members')
  );

  if (membersSnap.empty) {
    await deleteDoc(groupRef);
    return;
  }

  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;

  const updates: Record<string, unknown> = { memberCount: membersSnap.size };
  if (groupSnap.data().createdBy === user.uid) {
    updates.createdBy = membersSnap.docs[0].id;
  }

  await setDoc(groupRef, updates, { merge: true });
}

/** Only the group creator can delete the group for everyone. */
export async function deleteStudyGroup(
  db: Firestore,
  user: User,
  groupId: string
): Promise<void> {
  const groupRef = doc(db, 'study_groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error('Group not found');
  if (groupSnap.data().createdBy !== user.uid) {
    throw new Error('Only the group creator can delete this group');
  }

  await deleteDoc(doc(db, 'study_groups', groupId, 'members', user.uid));
  await deleteDoc(doc(db, 'users', user.uid, 'groupMemberships', groupId));
  await deleteDoc(groupRef);
}

export async function removeUserFromAllGroups(
  db: Firestore,
  userId: string
): Promise<void> {
  const membershipsSnap = await getDocs(
    collection(db, 'users', userId, 'groupMemberships')
  );
  if (membershipsSnap.empty) return;

  const batch = writeBatch(db);
  for (const membershipDoc of membershipsSnap.docs) {
    const groupId = membershipDoc.id;
    batch.delete(doc(db, 'study_groups', groupId, 'members', userId));
    batch.delete(membershipDoc.ref);
  }
  await batch.commit();
}

export function buildShareText(testName: string | undefined, totalScore: number): string {
  const base = `I scored ${totalScore}/150`;
  if (testName) {
    return `${base} on ${testName} using ΜΑΘPractice!`;
  }
  return `${base} on ΜΑΘPractice!`;
}
