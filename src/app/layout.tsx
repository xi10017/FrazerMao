import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseProvider } from '@/supabase';
import { Inter } from 'next/font/google';
import { Source_Code_Pro } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { AnswerKeyOverridesProvider } from '@/contexts/AnswerKeyOverridesContext';

export const metadata: Metadata = {
  title: 'MAOpractice',
  description: 'Mu Alpha Theta (FAMAT) competition prep',
  icons: {
    icon: '/icon.svg',
  },
};

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-code',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning={true}
        className={cn(
          'min-h-screen bg-background font-body antialiased',
          inter.variable,
          sourceCodePro.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SupabaseProvider>
            <AnswerKeyOverridesProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
            </AnswerKeyOverridesProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
