import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset, Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarTrigger } from '@/components/ui/sidebar';
import { Zap } from 'lucide-react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthStateSection } from '@/components/auth-state-section';
import { MainNav } from '@/components/main-nav';
import { Separator } from '@/components/ui/separator';
import { ThemeProvider } from '@/components/theme-provider';
import { SystemStatus } from '@/components/system-status';

export const metadata: Metadata = {
  title: 'SHILPA CORE - Tuition Management',
  description: 'Professional management for modern education institutes.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body selection:bg-primary/10 overflow-hidden">
        <FirebaseClientProvider>
          <ThemeProvider defaultTheme="light" storageKey="shilpa-ui-theme">
            <SidebarProvider defaultOpen={true}>
              <div className="flex min-h-svh w-full bg-background no-print overflow-hidden">
                <Sidebar className="border-r border-border bg-sidebar hidden md:flex">
                  <SidebarHeader className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
                        <Zap className="size-6 fill-current" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-lg font-bold tracking-tight text-foreground font-headline uppercase leading-none truncate">SHILPA</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">Management</span>
                      </div>
                    </div>
                  </SidebarHeader>
                  <SidebarContent className="px-2">
                    <SidebarGroup>
                      <SidebarGroupLabel className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Main Menu</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <MainNav />
                      </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarGroup className="mt-auto">
                      <SidebarGroupContent>
                        <AuthStateSection />
                      </SidebarGroupContent>
                    </SidebarGroup>
                  </SidebarContent>
                </Sidebar>

                <SidebarInset className="flex flex-col flex-1 bg-background overflow-hidden h-svh relative">
                  <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden sticky top-0 bg-background/80 backdrop-blur-md z-50">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1 text-foreground" />
                        <Separator orientation="vertical" className="mx-2 h-4" />
                        <div className="flex items-center gap-2">
                          <Zap className="size-4 text-primary fill-current" />
                          <span className="font-bold text-xs uppercase tracking-widest">SHILPA CORE</span>
                        </div>
                      </div>
                    </div>
                  </header>

                  <div className="flex-1 px-4 py-6 md:p-8 lg:p-10 safe-bottom overflow-y-auto relative z-10">
                    <div className="max-w-7xl mx-auto animate-in fade-in duration-700">
                      <header className="hidden md:flex items-center gap-2 mb-10">
                         <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
                         <Separator orientation="vertical" className="mx-2 h-4" />
                         <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                           System Active • v4.0.2 • <SystemStatus />
                         </div>
                      </header>
                      {children}
                    </div>
                  </div>
                </SidebarInset>
              </div>
              <div id="print-root" className="print-only" />
            </SidebarProvider>
            <Toaster />
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
