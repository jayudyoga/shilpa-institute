
"use client"

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Globe, 
  Mail, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  ChevronRight,
  Terminal,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function AboutDeveloper() {
  const APP_VERSION = "4.0.2";
  const BUILD_NUMBER = "BETA-77";

  const handleVisitWebsite = () => {
    window.open('https://pyrologic.com', '_blank');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@pyrologic.com?subject=TuitionFlow Core Support Request';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
      {/* Back Navigation */}
      <div className="animate-in fade-in slide-in-from-left-4 duration-500">
        <Button variant="ghost" size="sm" asChild className="text-primary/60 hover:text-primary gap-2 font-black uppercase text-[10px] tracking-widest">
          <Link href="/settings">
            <ArrowLeft className="size-3" /> System Settings
          </Link>
        </Button>
      </div>

      {/* Header / Brand Section */}
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="relative group animate-in zoom-in duration-700">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors" />
          <div className="size-24 rounded-3xl bg-card border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(var(--primary),0.2)] relative z-10">
            <Zap className="size-12 fill-primary/10" />
          </div>
        </div>
        
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <h1 className="text-5xl font-black font-headline tracking-tighter uppercase text-white [text-shadow:0_0_20px_rgba(var(--primary),0.5)]">
            pyro<span className="text-primary">Logic</span>
          </h1>
          <p className="text-primary/40 font-mono text-[10px] uppercase tracking-[0.4em]">Neural Architect & Design Labs</p>
        </div>
      </div>

      {/* App Readout Section */}
      <div className="glass-panel p-1 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <div className="bg-black/40 rounded-lg p-6 space-y-4 border border-white/5">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Terminal className="size-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">System Manifest</span>
          </div>
          
          <div className="grid grid-cols-1 gap-3 font-mono">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 uppercase">Identity:</span>
              <span className="text-primary font-bold">TuitionFlow Core Terminal</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 uppercase">Kernel:</span>
              <span className="text-emerald-500 font-bold">Stable // v{APP_VERSION}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 uppercase">Build:</span>
              <span className="text-amber-500 font-bold">{BUILD_NUMBER}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 uppercase">Architecture:</span>
              <span className="text-white font-bold uppercase">Multi-Tenant Cloud HUD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Card */}
      <Card className="border-none shadow-2xl glass-panel overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
        <CardContent className="p-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Official Deployment</h3>
              <p className="text-[10px] text-primary/60 font-bold uppercase tracking-tighter">Developed with ⚡ in Colombo, SL</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              onClick={handleVisitWebsite}
              className="tech-button h-14 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] neon-glow group"
            >
              <Globe className="size-4 mr-2" /> Visit Lab
              <ExternalLink className="size-3 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
            </Button>
            
            <Button 
              onClick={handleContactSupport}
              variant="outline"
              className="h-14 border-primary/20 text-white hover:bg-primary/5 font-black uppercase tracking-widest text-[10px] rounded-xl"
            >
              <Mail className="size-4 mr-2 text-primary" /> Contact Support
            </Button>
          </div>

          <div className="pt-4 border-t border-white/5 text-center">
            <p className="text-[9px] text-white/20 font-mono uppercase tracking-[0.2em]">
              © 2026 PYROLOGIC INTERACTIVE. ALL RIGHTS RESERVED.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Background HUD Decor */}
      <div className="fixed bottom-10 right-10 opacity-5 pointer-events-none hidden lg:block">
        <Cpu className="size-64 text-primary" />
      </div>
    </div>
  );
}
