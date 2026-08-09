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
import { useSupabase, useUser } from '@/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Laptop, Trash2, Mail } from 'lucide-react';
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
import { clearAllLocalData, deleteAllUserCloudData, updateLeaderboardVisibility } from '@/lib/user-data';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { UserProfile } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { FEEDBACK_EMAIL, FEEDBACK_MAILTO } from '@/lib/feedback';


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
  const { supabase } = useSupabase();
  const router = useRouter();
  const { toast } = useToast();
  const [confirmationText, setConfirmationText] = useState('');
  const [cloudConfirmationText, setCloudConfirmationText] = useState('');
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [isLeaderboardSaving, setIsLeaderboardSaving] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setIsProfileLoading(false);
      return;
    }
    let cancelled = false;
    setIsProfileLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setUserProfile({
            uid: data.id,
            displayName: data.display_name,
            email: data.email ?? user.email ?? '',
            photoURL: data.photo_url,
            showOnLeaderboard: data.show_on_leaderboard,
            bookmarkedTestIds: data.bookmarked_test_ids ?? [],
            weeklyTestGoal: data.weekly_test_goal ?? undefined,
            streakGoal: data.streak_goal ?? undefined,
          });
        }
        setIsProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleClearData = () => {
    if (!user) return;
    clearAllLocalData(user.uid);
    toast({
      title: 'Local Data Cleared',
      description:
        'Your in-progress test data has been deleted from this device.',
    });
    setConfirmationText('');
    router.refresh();
  };

  const handleDeleteCloudData = async () => {
    if (!user) return;

    setIsDeletingCloud(true);
    try {
      const result = await deleteAllUserCloudData(supabase, user);
      clearAllLocalData(user.uid);
      setCloudConfirmationText('');
      toast({
        title: 'Cloud history deleted',
        description: `Removed ${result.deletedSubmissions} submission(s) and ${result.deletedLeaderboardEntries} leaderboard entry/entries. Your account is still active.`,
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to delete cloud data:', error);
      toast({
        variant: 'destructive',
        title: 'Deletion failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not delete your cloud data. Please try again.',
      });
    } finally {
      setIsDeletingCloud(false);
    }
  };

  const handleLeaderboardVisibilityChange = async (checked: boolean) => {
    if (!user || !userProfile || isLeaderboardSaving) return;

    setIsLeaderboardSaving(true);
    try {
      const result = await updateLeaderboardVisibility(
        supabase,
        user,
        checked,
        userProfile.showOnLeaderboard ?? true
      );
      if (result.saved) {
        toast({
          title: 'Privacy settings updated!',
          description: `You will now be ${
            checked ? 'shown on' : 'hidden from'
          } leaderboards.`,
        });
      }
    } catch (error) {
      console.error('Error updating leaderboard visibility:', error);
      toast({
        variant: 'destructive',
        title: 'Could not update privacy settings',
        description: 'Please try again.',
      });
    } finally {
      setIsLeaderboardSaving(false);
    }
  };

  const isConfirmationMatch = confirmationText === 'delete my data';
  const isCloudConfirmationMatch =
    cloudConfirmationText === 'delete my cloud history';

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
                  disabled={isLeaderboardSaving}
                  onCheckedChange={handleLeaderboardVisibilityChange}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feedback</CardTitle>
            <CardDescription>
              Found a bug or have an idea to improve the app?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              For anything other than answer key disputes (use report in test
              review for those), send us an email with your bug report or
              improvement idea.
            </p>
            <Button variant="outline" asChild>
              <a href={FEEDBACK_MAILTO}>
                <Mail className="mr-2 h-4 w-4" />
                {FEEDBACK_EMAIL}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Manage your application data. These actions are permanent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertDialog onOpenChange={() => setConfirmationText('')}>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Local Data (This Device)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear local data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes in-progress work saved on this device only.
                    Submitted test history in the cloud is not affected. Type{' '}
                    <code className="font-mono bg-muted p-1 rounded-md text-foreground">
                      delete my data
                    </code>{' '}
                    to confirm.
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
                  >
                    Clear local data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog onOpenChange={() => setCloudConfirmationText('')}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Cloud History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all cloud history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes your submitted test results and
                    removes you from leaderboards. It only affects your account (
                    {user.email}). Your sign-in account stays active. Type{' '}
                    <code className="font-mono bg-muted p-1 rounded-md text-foreground">
                      delete my cloud history
                    </code>{' '}
                    to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <Label htmlFor="cloud-confirmation" className="sr-only">
                    Cloud deletion confirmation
                  </Label>
                  <Input
                    id="cloud-confirmation"
                    value={cloudConfirmationText}
                    onChange={(e) => setCloudConfirmationText(e.target.value)}
                    placeholder="delete my cloud history"
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingCloud}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteCloudData}
                    disabled={!isCloudConfirmationMatch || isDeletingCloud}
                  >
                    {isDeletingCloud ? 'Deleting…' : 'Delete cloud history'}
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
