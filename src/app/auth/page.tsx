
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { initiateEmailSignIn, initiateGoogleSignIn, initiatePasswordReset } from '@/firebase/non-blocking-login';
import { LogIn, BookOpen, ArrowLeft, AlertCircle, Eye, EyeOff, RefreshCw, Key, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function AuthPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecovering, setIsRecoverySubmitting] = useState(false);

  useEffect(() => {
    if (user && !isUserLoading) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleEmailAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) return;
    
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim().toLowerCase();
    const password = formData.get('password') as string;
    
    try {
      await initiateEmailSignIn(auth, email, password);
    } catch (err: any) {
      let message = `Auth failed (${err.code}). Please verify your credentials.`;
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = "Invalid email or password. Verify that your staff profile exists and you are using the correct credentials.";
      } else if (err.code === 'auth/too-many-requests') {
        message = "Too many failed attempts. Account temporarily locked for security.";
      } else if (err.code === 'auth/network-request-failed') {
        message = "Connection error. Check your internet and try again.";
      }
      
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !recoveryEmail) return;

    setIsRecoverySubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await initiatePasswordReset(auth, recoveryEmail.trim().toLowerCase());
      setSuccess(`Recovery email sent to ${recoveryEmail}. Please check your inbox.`);
      setIsRecoveryOpen(false);
    } catch (err: any) {
      setError(`Recovery failed: ${err.message}`);
    } finally {
      setIsRecoverySubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!auth) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    initiateGoogleSignIn(auth)
      .catch((err: any) => {
        if (err.code !== 'auth/popup-closed-by-user') {
          setError(`Google Auth failed (${err.code}).`);
        }
      })
      .finally(() => setIsSubmitting(false));
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-10 text-primary animate-spin opacity-40" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Authenticating System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link href="/" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors self-start mb-2">
            <ArrowLeft className="size-3 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="size-16 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20">
            <BookOpen className="size-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-foreground font-headline uppercase leading-none">SHILPA CORE</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Identity & Access Management</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-black uppercase tracking-tight">Access Denied</AlertTitle>
            <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="animate-in fade-in slide-in-from-top-2 border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-xs font-black uppercase tracking-tight">System Notification</AlertTitle>
            <AlertDescription className="text-xs font-medium">{success}</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl overflow-hidden bg-card rounded-[2rem]">
          <CardHeader className="bg-primary/5 border-b pb-6">
            <CardTitle className="uppercase tracking-tight font-black text-xl">
              Staff Sign In
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              Authorized institute staff access only.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleEmailAuth}>
            <CardContent className="space-y-5 pt-8">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[10px] font-black uppercase text-muted-foreground ml-1">Work Email</Label>
                <Input id="login-email" name="email" type="email" placeholder="staff@shilpa.edu" required disabled={isSubmitting} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="login-password" className="text-[10px] font-black uppercase text-muted-foreground">Password</Label>
                  <button 
                    type="button" 
                    onClick={() => setIsRecoveryOpen(true)}
                    className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input 
                    id="login-password" 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    disabled={isSubmitting} 
                    className="h-12 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 border-t bg-muted/10 pt-8 pb-8">
              <Button type="submit" className="w-full gap-2 h-14 text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 rounded-2xl" disabled={isSubmitting}>
                {isSubmitting 
                  ? <><RefreshCw className="size-4 animate-spin" /> Verifying...</>
                  : <><LogIn className="size-4" /> Secure Sign In</>
                }
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted-foreground/10" />
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-black tracking-[0.3em]">
              <span className="bg-muted/30 px-4 text-muted-foreground/60">Global Federated Login</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-3 h-14 font-black uppercase tracking-widest text-[10px] shadow-sm rounded-2xl border-muted-foreground/10 hover:bg-white transition-all" onClick={handleGoogleSignIn} disabled={isSubmitting}>
            <svg className="size-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>

      <Dialog open={isRecoveryOpen} onOpenChange={setIsRecoveryOpen}>
        <DialogContent className="max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight flex items-center gap-2 font-black">
              <Key className="size-5 text-primary" />
              Account Recovery
            </DialogTitle>
            <DialogDescription>Enter your email to receive a secure password reset link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordRecovery}>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Work Email</Label>
                <Input 
                  type="email" 
                  placeholder="staff@shilpa.edu" 
                  value={recoveryEmail} 
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className="h-12 border-primary/20 rounded-xl"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full font-black uppercase tracking-widest text-[10px] h-12 shadow-lg" disabled={isRecovering}>
                {isRecovering ? <RefreshCw className="size-4 animate-spin mr-2" /> : "Send Reset Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
