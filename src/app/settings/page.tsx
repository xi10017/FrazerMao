'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Laptop } from 'lucide-react';

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
  const router = useRouter();

  if (isUserLoading) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
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
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look and feel of the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <ThemeSwitcher />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
