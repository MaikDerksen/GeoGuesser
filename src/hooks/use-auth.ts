
"use client";

import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from './use-toast';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error: any) {
      toast({ title: "Google Sign-In Error", description: error.message, variant: "destructive" });
    }
  };

  const signUpWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
      return true;
    } catch (error: any) {
      toast({ title: "Sign-Up Error", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
      return true;
    } catch (error: any) {
      toast({ title: "Sign-In Error", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      router.push('/login');
    } catch (error: any) {
      toast({ title: "Sign-Out Error", description: error.message, variant: "destructive" });
    }
  };

  return {
    user,
    loading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
  };
}
