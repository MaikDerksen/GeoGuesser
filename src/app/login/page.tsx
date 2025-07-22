
"use client";

import { useState, type FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.04,4.73 15.3,5.46 16.25,6.45L18.3,4.4C16.36,2.6 14.19,1.5 12.19,1.5C6.9,1.5 3,6.4 3,12C3,17.6 6.9,22.5 12.19,22.5C17.6,22.5 21.5,18.33 21.5,12.27C21.5,11.75 21.45,11.42 21.35,11.1Z"></path></svg>
)

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, user, loading } = useAuth();
    const router = useRouter();

    const handleEmailSubmit = async (e: FormEvent, type: 'signin' | 'signup') => {
        e.preventDefault();
        setIsSubmitting(true);
        if (type === 'signin') {
            await signInWithEmail(email, password);
        } else {
            await signUpWithEmail(email, password);
        }
        setIsSubmitting(false);
    }
    
    if (loading) {
       return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }

    if(user) {
        router.push('/');
        return null;
    }

    return (
        <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background font-body">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Login</CardTitle>
                    <CardDescription>
                        Enter your email below to login to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                     <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><GoogleIcon /> Sign in with Google</>}
                     </Button>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Or continue with
                            </span>
                        </div>
                    </div>
                   <Tabs defaultValue="signin">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="signin">Sign In</TabsTrigger>
                            <TabsTrigger value="signup">Sign Up</TabsTrigger>
                        </TabsList>
                        <TabsContent value="signin">
                           <form onSubmit={(e) => handleEmailSubmit(e, 'signin')}>
                             <div className="grid gap-2 mt-4">
                                <Label htmlFor="email-signin">Email</Label>
                                <Input id="email-signin" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className="grid gap-2 mt-4">
                                <Label htmlFor="password-signin">Password</Label>
                                <Input id="password-signin" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <><Mail />Sign In</>}
                            </Button>
                           </form>
                        </TabsContent>
                        <TabsContent value="signup">
                            <form onSubmit={(e) => handleEmailSubmit(e, 'signup')}>
                             <div className="grid gap-2 mt-4">
                                <Label htmlFor="email-signup">Email</Label>
                                <Input id="email-signup" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className="grid gap-2 mt-4">
                                <Label htmlFor="password-signup">Password</Label>
                                <Input id="password-signup" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <><Mail />Sign Up</>}
                            </Button>
                           </form>
                        </TabsContent>
                   </Tabs>

                </CardContent>
            </Card>
        </main>
    )
}
