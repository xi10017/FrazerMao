'use client';

import Link from 'next/link';
import { BookOpen, LogIn, Settings } from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { createUserProfile } from '@/lib/user-data';
import { getInitials } from '@/lib/utils';


function UserAuth() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/');
  };

  const handleSignIn = async () => {
    if (!auth || !firestore) return;
    const provider = new GoogleAuthProvider();
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      // The onAuthStateChanged listener in FirebaseProvider will trigger
      // a re-render and UI update. We can create the profile here.
      await createUserProfile(firestore, result.user);
    } catch (error: any) {
      console.error('Error during sign-in:', error);
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (isUserLoading) {
    return <Skeleton className="h-10 w-28" />;
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={user.photoURL ?? ''}
                alt={user.displayName ?? 'User'}
              />
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.displayName}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogIn className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={handleSignIn} disabled={isAuthLoading}>
      <LogIn className="mr-2 h-4 w-4" />
      Sign In with Google
    </Button>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg flex items-center">
              MA
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-[-2px] text-primary"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="6" y1="12" x2="18" y2="12" />
              </svg>
              practice
            </span>
          </Link>
        </div>
        <div>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}
