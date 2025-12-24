'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useFirestore } from '@/firebase';
import {
  BarChart3,
  BookCopy,
  ChevronRight,
  LogIn,
  Swords,
  Timer,
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Function to create or update user profile in Firestore
const createUserProfile = async (firestore: any, user: User) => {
  if (!firestore || !user) return;

  const userRef = doc(firestore, 'users', user.uid);
  const userData: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || 'Anonymous User',
    email: user.email!,
    photoURL: user.photoURL,
    showOnLeaderboard: true, // Default to true on creation
  };

  setDoc(userRef, userData, { merge: true }).catch((error) => {
    const permissionError = new FirestorePermissionError({
      path: userRef.path,
      operation: 'write',
      requestResourceData: userData,
    });
    errorEmitter.emit('permission-error', permissionError);
    console.error('Error creating user profile:', error);
  });
};

const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl">
    <CardHeader className="flex flex-row items-center gap-4">
      <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const UserAuthButton = () => {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleSignIn = async () => {
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firebase not ready. Please try again in a moment.',
      });
      return;
    }
    const provider = new GoogleAuthProvider();
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
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

  return (
    <Button
      size="lg"
      className="mt-8 animate-pulse"
      onClick={handleSignIn}
      disabled={isAuthLoading}
    >
      <LogIn className="mr-2 h-5 w-5" />
      {isAuthLoading ? 'Signing In...' : 'Sign In with Google to Get Started'}
    </Button>
  );
};

export const LandingPage = () => {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <section className="py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">
          Master Mu Alpha Theta Competitions
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          A platform for completing folders with realistic practice, progress tracking, and competitive preparation.
        </p>
        <UserAuthButton />
      </section>

      <section className="py-16">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">Features</h2>
          <p className="mt-2 text-muted-foreground">
            Everything you need, all in one place.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<BookCopy className="h-8 w-8" />}
            title="Folder Library"
            description="Access a comprehensive collection of folders from recent years, with more being added all the time."
          />
          <FeatureCard
            icon={<Timer className="h-8 w-8" />}
            title="Realistic Practice Arena"
            description="Simulate the real exam with a timed environment and integrated scantron. A TI-84 is available for Stats (sorry no Inspire)."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8" />}
            title="In-Depth Analytics"
            description="Visualize your performance with a detailed progress grid, review past attempts, and identify your strengths and weaknesses."
          />
          <FeatureCard
            icon={<Swords className="h-8 w-8" />}
            title="Competitive Leaderboards"
            description="Stay motivated by competing against peers. See how you rank overall and within specific test divisions."
          />
        </div>
      </section>

      <section className="py-16">
        <Card className="bg-primary/5">
          <CardContent className="flex flex-col items-center gap-6 p-8 text-center md:flex-row md:text-left">
            <div className="flex-1">
              <h3 className="text-2xl font-bold">Ready to Start Preparing?</h3>
              <p className="mt-2 text-muted-foreground">
                Sign in to save your progress, track your history, and climb the
                leaderboards. Your journey to the top starts now.
              </p>
            </div>
            <UserAuthButton />
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
