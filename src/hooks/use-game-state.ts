
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Location } from '@/lib/locations';
import { locationPacks } from '@/lib/locations';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useDeviceOrientation } from '@/hooks/use-device-orientation';
import { calculateBearing } from '@/lib/geo';
import { useToast } from "@/hooks/use-toast";
import type { User } from 'firebase/auth';
import { getNearbyLocations } from '@/ai/flows/get-nearby-locations';


type GameState = 'idle' | 'mode_selection' | 'permission' | 'customizing_near_me' | 'loading_location' | 'playing' | 'results';
type GameMode = keyof typeof locationPacks | 'NEAR_ME';

interface NearMeOptions {
    radius: number;
    categories: {
        restaurants: boolean;
        culture: boolean;
        shopping: boolean;
        hotels: boolean;
        infrastructure: boolean;
        landmarks: boolean;
    }
}

const TOTAL_ROUNDS = 7;
const ROUND_TIMER = 15;

export function useGameState(user: User | null) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIMER);
  const [gameLoading, setGameLoading] = useState(false);

  const [target, setTarget] = useState<Location | null>(null);
  const [userGuess, setUserGuess] = useState<number | null>(null);
  const [currentLocationSet, setCurrentLocationSet] = useState<Location[]>([]);
  
  const [appUrl, setAppUrl] = useState('');
  const { toast } = useToast();

  const { data: userLocation, loading: locationLoading, error: locationError, getLocation } = useGeolocation();
  const { orientation, error: orientationError, requestPermission, permissionState } = useDeviceOrientation();

  const [nearMeOptions, setNearMeOptions] = useState<NearMeOptions>({
      radius: 10,
      categories: {
          restaurants: true,
          culture: true,
          shopping: true,
          hotels: false,
          infrastructure: false,
          landmarks: true,
      }
  });

  // Set App URL for QR Code
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      setAppUrl(window.location.origin);
    }
  }, []);

  const resetGame = useCallback(() => {
    setGameState('idle');
    setGameMode(null);
    setCurrentRound(0);
    setScore(0);
    setUserGuess(null);
    setTarget(null);
    setCurrentLocationSet([]);
    setGameLoading(false);
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

  const startNewRound = useCallback((locations?: Location[]) => {
    const locationSet = locations || currentLocationSet;
    if(locationSet.length === 0) {
        toast({ title: "No Locations", description: "Could not find any locations for the selected game mode.", variant: "destructive"});
        resetGame();
        return;
    }
    setUserGuess(null);
    
    // Filter out previous target to avoid repetition
    const availableLocations = locationSet.filter(l => l.name !== target?.name);
    const randomLocation = availableLocations[Math.floor(Math.random() * availableLocations.length)];
    
    setTarget(randomLocation);
    setCurrentRound(round => round + 1);
    setTimeLeft(ROUND_TIMER);
    setGameState('playing');
    setGameLoading(false);
    
  }, [currentLocationSet, resetGame, toast, target?.name]);


  const prepareGame = useCallback(async () => {
    setCurrentRound(0);
    setScore(0);
    setGameState('loading_location');
    setGameLoading(true);

    getLocation(); // This is async, we'll react to its completion in the effect below
  }, [getLocation]);

   // This effect chain handles the entire game setup process once a mode is selected.
  useEffect(() => {
    const setupGame = async () => {
        if (gameState !== 'loading_location' || locationLoading || !gameMode) return;

        if (!userLocation) {
            if(locationError) {
                toast({ title: "Location Error", description: `Could not get your location: ${locationError.message}`, variant: "destructive"});
                resetGame();
            }
            return; // Wait for location data or handle error
        }
        
        try {
            let locations: Location[] = [];
            if (gameMode === 'NEAR_ME') {
                const selectedCategories = Object.entries(nearMeOptions.categories)
                    .filter(([, value]) => value)
                    .map(([key]) => key);

                if (selectedCategories.length === 0) {
                    toast({ title: "No Categories", description: "Please select at least one category for 'Near Me' mode.", variant: "destructive" });
                    setGameState('customizing_near_me');
                    setGameLoading(false);
                    return;
                }

                locations = await getNearbyLocations({ 
                    latitude: userLocation.latitude, 
                    longitude: userLocation.longitude,
                    radius: nearMeOptions.radius,
                    categories: selectedCategories,
                });

                if (locations.length < TOTAL_ROUNDS) {
                    toast({ title: "Not Enough Locations", description: "Could not find enough nearby locations with the selected options. Try expanding your radius or adding categories.", variant: "destructive" });
                    resetGame();
                    return;
                }
            } else {
                locations = locationPacks[gameMode];
            }
            setCurrentLocationSet(locations);
            startNewRound(locations); // Directly start the first round with the new locations

        } catch (e: any) {
            toast({ title: "Error", description: `Failed to get locations: ${e.message}`, variant: "destructive"});
            resetGame();
        }
    }
    
    setupGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameMode, locationLoading, userLocation, locationError, nearMeOptions]);


  const handleSetGameMode = useCallback((mode: GameMode) => {
    setGameMode(mode);
    if (mode === 'NEAR_ME') {
      setGameState('customizing_near_me');
      return;
    }
    
    if (permissionState === 'prompt' || (permissionState === 'not-supported' && typeof (DeviceOrientationEvent as any).requestPermission === 'function')) {
      setGameState('permission');
    } else if (permissionState === 'granted') {
      prepareGame();
    } else {
      toast({ title: "Permission Required", description: "Device orientation permission is required to play. Please enable it in your browser settings.", variant: "destructive"});
      setGameState('idle');
    }
  }, [permissionState, toast, prepareGame]);

  const handleStartNearMe = useCallback(() => {
     if (permissionState === 'prompt' || (permissionState === 'not-supported' && typeof (DeviceOrientationEvent as any).requestPermission === 'function')) {
      setGameState('permission');
    } else if (permissionState === 'granted') {
      prepareGame();
    } else {
      toast({ title: "Permission Required", description: "Device orientation permission is required to play. Please enable it in your browser settings.", variant: "destructive"});
      setGameState('idle');
    }
  }, [permissionState, prepareGame, toast]);

  // Handle starting the game or next round
  const handleStart = useCallback(() => {
    if (gameState === 'results') {
       if (currentRound >= TOTAL_ROUNDS) {
            resetGame();
       } else {
            startNewRound();
       }
    }
  }, [gameState, currentRound, startNewRound, resetGame]);

  const handleGrantPermission = async () => {
    const status = await requestPermission();
    if (status === 'granted' && gameMode) {
        prepareGame();
    } else {
        setGameState('idle');
        setGameMode(null);
        toast({ title: "Permission Denied", description: "Permission for device sensors was denied. The game cannot start.", variant: "destructive"});
    }
  }


  // Reset to idle if user logs out
  useEffect(() => {
    if (!user) {
      resetGame();
    }
  }, [user, resetGame]);

  return {
    gameState,
    setGameState,
    score,
    currentRound,
    totalRounds: TOTAL_ROUNDS,
    timeLeft,
    target,
    heading,
    targetBearing,
    userGuess,
    appUrl,
    gameMode,
    loading: gameLoading,
    nearMeOptions,
    setNearMeOptions,
    handleSetGameMode,
    handleStart,
    handleGuess,
    handleGrantPermission,
    permissionState,
    resetGame,
    handleStartNearMe,
  };
}
