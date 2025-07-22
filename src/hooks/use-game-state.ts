
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Location } from '@/lib/locations';
import { locationPacks } from '@/lib/locations';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useDeviceOrientation } from '@/hooks/use-device-orientation';
import { calculateBearing } from '@/lib/geo';
import { useToast } from "@/hooks/use-toast";
import type { User } from 'firebase/auth';


type GameState = 'idle' | 'mode_selection' | 'permission' | 'loading_location' | 'playing' | 'results';
type GameMode = keyof typeof locationPacks;

const TOTAL_ROUNDS = 7;
const ROUND_TIMER = 15;

export function useGameState(user: User | null) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIMER);

  const [target, setTarget] = useState<Location | null>(null);
  const [userGuess, setUserGuess] = useState<number | null>(null);
  
  const [appUrl, setAppUrl] = useState('');
  const { toast } = useToast();

  const { data: userLocation, loading: locationLoading, error: locationError, getLocation } = useGeolocation();
  const { orientation, error: orientationError, requestPermission, permissionState } = useDeviceOrientation();

  // Set App URL for QR Code
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      setAppUrl(window.location.origin);
    }
  }, []);

  // Memoize heading calculation
  const heading = useMemo(() => {
    if (!orientation) return 0;
    if (orientation.webkitCompassHeading !== undefined) {
      return orientation.webkitCompassHeading;
    }
    return orientation.alpha !== null ? 360 - orientation.alpha : 0;
  }, [orientation]);

  // Memoize target bearing calculation
  const targetBearing = useMemo(() => {
    if (!userLocation || !target) return null;
    return calculateBearing(
      userLocation.latitude,
      userLocation.longitude,
      target.coordinates.latitude,
      target.coordinates.longitude
    );
  }, [userLocation, target]);
  
  const handleGuess = useCallback((angle: number) => {
    if (gameState !== 'playing') return;
    setUserGuess(angle);

    if (targetBearing !== null) {
      const difference = Math.min(Math.abs(angle - targetBearing), 360 - Math.abs(angle - targetBearing));
      const points = Math.max(0, 360 - Math.floor(difference));
      setScore(s => s + points);
    }
    
    setGameState('results');
  }, [gameState, targetBearing]);

  // Game timer effect
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) {
      if (timeLeft <= 0) {
        handleGuess(heading); // Auto-guess if timer runs out
      }
      return;
    };

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft, heading, handleGuess]);

  const startNewRound = useCallback(() => {
    setGameState('loading_location');
    setUserGuess(null);
    
    if (gameMode) {
      const locations = locationPacks[gameMode];
      const randomLocation = locations[Math.floor(Math.random() * locations.length)];
      setTarget(randomLocation);
    }
    
    getLocation();
  }, [gameMode, getLocation]);

  const handleSetGameMode = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setCurrentRound(0);
    setScore(0);
    if (permissionState === 'prompt' || (permissionState === 'not-supported' && typeof (DeviceOrientationEvent as any).requestPermission === 'function')) {
      setGameState('permission');
    } else if (permissionState === 'granted') {
      startNewRound();
    } else {
      toast({ title: "Permission Required", description: "Device orientation permission is required to play. Please enable it in your browser settings.", variant: "destructive"});
      setGameState('idle');
    }
  }, [permissionState, toast, startNewRound]);


  // Handle starting the game or next round
  const handleStart = useCallback(() => {
    if (gameState === 'idle') {
      setGameState('mode_selection');
    } else if (gameState === 'results') {
       if (currentRound >= TOTAL_ROUNDS) {
            setGameState('idle');
            setGameMode(null);
       } else {
            startNewRound();
       }
    }
  }, [gameState, currentRound, startNewRound]);

  const handleGrantPermission = async () => {
    const status = await requestPermission();
    if (status === 'granted') {
        startNewRound();
    } else {
        setGameState('idle');
        setGameMode(null);
        toast({ title: "Permission Denied", description: "Permission for device orientation was denied. The game cannot start.", variant: "destructive"});
    }
  }

  // Effect to transition from loading to playing
  useEffect(() => {
    if (gameState === 'loading_location' && !locationLoading) {
      if (userLocation) {
        setCurrentRound(round => round + 1);
        setGameState('playing');
        setTimeLeft(ROUND_TIMER);
      }
      if (locationError) {
        setGameState('idle');
        toast({ title: "Location Error", description: `Could not get your location: ${locationError.message}`, variant: "destructive"});
      }
    }
  }, [gameState, locationLoading, userLocation, locationError, toast]);

  // Reset to idle if user logs out
  useEffect(() => {
    if (!user) {
      setGameState('idle');
      setGameMode(null);
      setCurrentRound(0);
      setScore(0);
    }
  }, [user]);

  return {
    gameState,
    score,
    currentRound,
    totalRounds: TOTAL_ROUNDS,
    timeLeft,
    target,
    heading,
    targetBearing,
    userGuess,
    appUrl,
    handleSetGameMode,
    handleStart,
    handleGuess,
    handleGrantPermission,
    permissionState
  };
}
