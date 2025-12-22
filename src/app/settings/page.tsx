'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Laptop, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { clearAllUserData } from '@/lib/localStorage';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { doc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function getInitials(name?: string | null) {
  if (!name) return '?';
  const names = name.split(' ');
  const initials = names.map((n) => n[0]).join('');
  return initials.length > 2 ? initials.substring(0, 2) : initials;
}

function ThemeSwitcher() {
  const { setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
      <Button variant="ghost" size="sm" onClick={() => setTheme('light')}>
        <Sun className="mr-2 h-4 w-4" />
        Light
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setTheme('dark')}>
        <Moon className="mr-2 h-4 w-4" />
        Dark
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setTheme('system')}>
        <Laptop className="mr-2 h-4 w-4" />
        System
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [confirmationText, setConfirmationText] = useState('');

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } =
    useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleClearData = () => {
    if (!user) return;
    clearAllUserData(user.uid);
    toast({
      title: 'Local Data Cleared',
      description:
        'Your in-progress test data has been deleted. Submitted test history must be cleared from the database by an administrator.',
    });
    setConfirmationText(''); // Reset for next time
    router.refresh();
  };

  const handleLeaderboardVisibilityChange = async (checked: boolean) => {
    if (!userProfileRef || !user || !firestore) return;

    const updatedProfileData = { showOnLeaderboard: checked };
    const updatedLeaderboardData = { showOnLeaderboard: checked, userId: user.uid };

    try {
        const batch = writeBatch(firestore);

        // 1. Update the user's profile
        batch.set(userProfileRef, updatedProfileData, { merge: true });

        // 2. Update the overall leaderboard entry
        const overallRef = doc(firestore, 'leaderboard_overall', user.uid);
        batch.set(overallRef, updatedLeaderboardData, { merge: true });

        // 3. Update all division-specific leaderboard entries
        const divisionQuery = query(
            collection(firestore, 'leaderboard_by_division'),
            where('userId', '==', user.uid)
        );
        const divisionSnapshot = await getDocs(divisionQuery);
        divisionSnapshot.forEach((doc) => {
            batch.set(doc.ref, updatedLeaderboardData, { merge: true });
        });

        // 4. Commit all changes at once
        await batch.commit();

        toast({
            title: 'Privacy settings updated!',
            description: `You will now be ${
            checked ? 'shown on' : 'hidden from'
            } leaderboards.`,
        });

    } catch (error) {
        console.error("Error updating leaderboard visibility:", error);
        // This is a complex operation, so we create a generic error for now
        // In a real app, you might create a more specific error type for this batch write
        const permissionError = new FirestorePermissionError({
            path: `user ${user.uid} batch update`,
            operation: 'write',
            requestResourceData: updatedLeaderboardData
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const isConfirmationMatch = confirmationText === 'delete my data';

  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-1/3" />
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Don't render anything if user is not logged in, useEffect will redirect
  }

  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and app preferences.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account information.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={user.photoURL ?? ''}
                  alt={user.displayName ?? 'User'}
                />
                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <div className="font-semibold">{user.displayName}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look and feel of the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSwitcher />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>
              Control how your information is displayed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="leaderboard-switch" className="text-base">
                  Show on Leaderboards
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow your name and score to be publicly visible on
                  leaderboards.
                </p>
              </div>
              {userProfile && (
                <Switch
                  id="leaderboard-switch"
                  checked={userProfile.showOnLeaderboard ?? true}
                  onCheckedChange={handleLeaderboardVisibilityChange}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Manage your application data. This action is permanent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog onOpenChange={() => setConfirmationText('')}>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Local Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all of your saved in-progress
                    work. Submitted test history is stored in the database and
                    is not affected. To confirm, please type{' '}
                    <code className="font-mono bg-muted p-1 rounded-md text-foreground">
                      delete my data
                    </code>{' '}
                    in the box below.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <Label htmlFor="confirmation" className="sr-only">
                    Confirmation
                  </Label>
                  <Input
                    id="confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="delete my data"
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearData}
                    disabled={!isConfirmationMatch}
                    variant="destructive"
                  >
                    Yes, delete my data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
