'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabase } from '@/supabase';
import {
  BarChart3,
  BookCopy,
  LogIn,
  Timer,
} from 'lucide-react';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAuthRedirectUrl } from '@/lib/site-url';
import { PublicSeasonPreview } from './PublicSeasonPreview';


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

const UserAuthButton = ({ label = 'Sign in with Google' }: { label?: string }) => {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleSignIn = async () => {
    if (!supabase) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Sign-in is unavailable. Please try again in a moment.',
      });
      return;
    }
    setIsAuthLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getAuthRedirectUrl() },
      });
    } catch (error: any) {
      console.error('Error during sign-in:', error);
      toast({
        variant: 'destructive',
        title: 'Could not sign in',
        description: 'Please try signing in again.',
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
      {isAuthLoading ? 'Signing in…' : label}
    </Button>
  );
};

export const LandingPage = () => {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <section className="py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">
          Mu Alpha Theta Practice
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Practice with past Regional, Invitational, States, and Nationals tests.
        </p>
        <UserAuthButton />
      </section>

      <PublicSeasonPreview onJoin={<UserAuthButton label="Sign in to join the leaderboard" />} />

      <section className="py-16">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">Features</h2>
          <p className="mt-2 text-muted-foreground">
            Take tests online with automatic grading, solutions, and saved progress.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<BookCopy className="h-8 w-8" />}
            title="Past tests"
            description="Browse Regional, Invitational, States, and Nationals tests by year, division, and topic."
          />
          <FeatureCard
            icon={<Timer className="h-8 w-8" />}
            title="Timed practice"
            description="Use an adjustable timer and answer sheet. A TI-84 calculator is available for Statistics."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8" />}
            title="Progress tracking"
            description="View your scores, review past attempts, and track your practice."
          />
        </div>
      </section>

      <section className="py-16">
        <Card className="bg-primary/5">
          <CardContent className="flex flex-col items-center gap-6 p-8 text-center md:flex-row md:text-left">
            <div className="flex-1">
              <h3 className="text-2xl font-bold">Start practicing</h3>
              <p className="mt-2 text-muted-foreground">
                Sign in to save your progress and review past attempts.
              </p>
            </div>
            <UserAuthButton />
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
