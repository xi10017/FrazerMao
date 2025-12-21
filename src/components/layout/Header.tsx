'use client';

import Link from 'next/link';
import { BookOpen, LogIn } from 'lucide-react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  signOut,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { useAuth } from '@/firebase';
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
import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

function getInitials(name?: string | null) {
  if (!name) return '?';
  const names = name.split(' ');
  const initials = names.map((n) => n[0]).join('');
  return initials.length > 2 ? initials.substring(0, 2) : initials;
}

function UserAuth() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const handleRedirectResult = async () => {
      // Avoid running this on every render, only after a redirect.
      // A simple check like this might not be enough in complex scenarios, but works here.
      if (sessionStorage.getItem('firebase_redirect_in_progress') !== '1') {
        return;
      }

      setIsAuthLoading(true);
      sessionStorage.removeItem('firebase_redirect_in_progress');

      try {
        await getRedirectResult(auth);
        // User is now signed in. The onAuthStateChanged listener will handle the UI update.
      } catch (error: any) {
        console.error('Error handling redirect result', error);
        toast({
          variant: 'destructive',
          title: 'Sign In Failed',
          description: error.message || 'An unknown error occurred.',
        });
      } finally {
        setIsAuthLoading(false);
      }
    };

    handleRedirectResult();
  }, [auth, toast]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (isUserLoading || isAuthLoading) {
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
          <DropdownMenuItem onClick={handleSignOut}>
            <LogIn className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    // Set a flag in session storage to check for redirect result later
    sessionStorage.setItem('firebase_redirect_in_progress', '1');
    await signInWithRedirect(auth, provider);
  };

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
            <span className="font-bold text-lg">MuPractice</span>
          </Link>
        </div>
        <div>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}
