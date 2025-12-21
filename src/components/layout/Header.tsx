'use client';

import Link from 'next/link';
import { BookOpen, LogIn } from 'lucide-react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';

function UserAuth() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  if (isUserLoading) {
    return null; // Or a loading spinner
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-foreground">
          {user.displayName || user.email}
        </span>
        <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
          Sign Out
        </Button>
      </div>
    );
  }

  const handleSignIn = async () => {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Don't log an error if the user just closes the popup
      if (error.code !== 'auth/cancelled-popup-request') {
        console.error('Error signing in with Google', error);
      }
    }
  };

  return (
    <Button onClick={handleSignIn}>
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
            <span className="font-bold font-headline text-lg">MuPractice</span>
          </Link>
        </div>
        <div>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}
