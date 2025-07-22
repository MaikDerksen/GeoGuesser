
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
import { doc, onSnapshot, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Lobby } from './use-lobby';


type GameState = 'idle' | 'mode_selection' | 'permission' | 'customizing_near_me' | 'loading_location' | 'playing' | 'results';
type GameMode = keyof typeof locationPacks | 'NEAR_ME';

interface NearMeOptions {
    radius: number;
    rounds: number;
    categories: {
        restaurants: boolean;
        culture: boolean;
        shopping: boolean;
        hotels: boolean;
        infrastructure: boolean;
        landmarks: boolean;
    }
}

const ROUND_TIMER = 15;

export function useGameState(user: User | null, lobbyId: string | null = null) {
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

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const isMultiplayer = !!lobbyId;
  const isHost = user?.uid === lobby?.hostId;


  const { data: userLocation, loading: locationLoading, error: locationError, getLocation } = useGeolocation();
  const { orientation, error: orientationError, requestPermission, permissionState } = useDeviceOrientation();

  const [nearMeOptions, setNearMeOptions] = useState<NearMeOptions>({
      radius: 10,
      rounds: 7,
      categories: {
          restaurants: true,
          culture: true,
          shopping: true,
          hotels: false,
          infrastructure: false,
          landmarks: true,
      }
  });

   useEffect(() => {
    if (!lobbyId) {
        setGameState('idle');
        return;
    }

    const unsub = onSnapshot(doc(db, 'lobbies', lobbyId), (doc) => {
        if (doc.exists()) {
            const lobbyData = doc.data() as Lobby;
            setLobby(lobbyData);
            
            if (lobbyData.status === 'playing') {
                if (!lobbyData.gameMode) {
                     setGameState('mode_selection');
                } else if (!lobbyData.locations || lobbyData.locations.length === 0){
                    setGameState('loading_location');
                } else {
                     setGameState('playing');
                }
                setGameMode(lobbyData.gameMode);
                setCurrentRound(lobbyData.currentRound);
                setCurrentLocationSet(lobbyData.locations);
                if(lobbyData.locations[lobbyData.currentRound-1]) {
                    setTarget(lobbyData.locations[lobbyData.currentRound-1]);
                }
            }

        } else {
            toast({title: "Lobby not found", variant: "destructive"});
            // router.push('/');
        }
    });

    return () => unsub();
  }, [lobbyId, toast]);

  const totalRounds = useMemo(() => {
    if (gameMode === 'NEAR_ME') {
        return nearMeOptions.rounds;
    }
    return 7; // Default for other modes
  }, [gameMode, nearMeOptions.rounds]);

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
  
  const handleGuess = useCallback(async (angle: number) => {
    if (gameState !== 'playing') return;
    setUserGuess(angle);

    let roundPoints = 0;
    if (targetBearing !== null) {
      const difference = Math.min(Math.abs(angle - targetBearing), 360 - Math.abs(angle - targetBearing));
      roundPoints = Math.max(0, 360 - Math.floor(difference));
      setScore(s => s + roundPoints);
    }
    
    if (isMultiplayer && lobbyId && user) {
        const lobbyRef = doc(db, 'lobbies', lobbyId);
        const playerRef = doc(db, `lobbies/${lobbyId}/players`, user.uid);
        const batch = writeBatch(db);

        // This is complex. In a real app, you might use a cloud function.
        // For now, we update the player's guess for the current round.
        const lobbySnap = await getDoc(lobbyRef);
        if(lobbySnap.exists()){
            const lobbyData = lobbySnap.data() as Lobby;
            const playerIndex = lobbyData.players.findIndex(p => p.uid === user.uid);
            if(playerIndex !== -1){
                const newPlayers = [...lobbyData.players];
                const currentGuesses = newPlayers[playerIndex].guesses || [];
                // Ensure guesses array is long enough
                while(currentGuesses.length < lobbyData.currentRound) {
                    currentGuesses.push(null);
                }
                currentGuesses[lobbyData.currentRound - 1] = angle;
                newPlayers[playerIndex].guesses = currentGuesses;
                newPlayers[playerIndex].score += roundPoints;

                batch.update(lobbyRef, { players: newPlayers });
                await batch.commit();
            }
        }
    }
    
    setGameState('results');
  }, [gameState, targetBearing, isMultiplayer, lobbyId, user]);

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

  const startNewRound = useCallback(async (locations?: Location[]) => {
    const locationSet = locations || currentLocationSet;
    if(locationSet.length === 0) {
        toast({ title: "No Locations", description: "Could not find any locations for the selected game mode.", variant: "destructive"});
        if (isHost) resetGame();
        return;
    }
    setUserGuess(null);
    
    const newRound = currentRound + 1;
    const randomLocation = locationSet[newRound -1]; // Rounds are 1-based
    
    if (isMultiplayer && lobbyId && isHost) {
        await updateDoc(doc(db, 'lobbies', lobbyId), {
            currentRound: newRound,
        });
    } else {
        setTarget(randomLocation);
        setCurrentRound(newRound);
        setTimeLeft(ROUND_TIMER);
        setGameState('playing');
        setGameLoading(false);
    }
    
  }, [currentLocationSet, resetGame, toast, isMultiplayer, lobbyId, isHost, currentRound]);


  const prepareGame = useCallback(async () => {
     if(isMultiplayer && !isHost) return;

    setCurrentRound(0);
    setScore(0);
    setGameState('loading_location');
    setGameLoading(true);

    getLocation(); // This is async, we'll react to its completion in the effect below
  }, [getLocation, isMultiplayer, isHost]);

   // This effect chain handles the entire game setup process once a mode is selected.
  useEffect(() => {
    const setupGame = async () => {
        if (gameState !== 'loading_location' || locationLoading || !gameMode) return;

        // For multiplayer, only host should generate locations
        if (isMultiplayer && !isHost) return;

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

                const aiLocations = await getNearbyLocations({ 
                    latitude: userLocation.latitude, 
                    longitude: userLocation.longitude,
                    radius: nearMeOptions.radius,
                    categories: selectedCategories,
                });

                // Filter for unique locations client-side to be certain
                const uniqueLocations = aiLocations.filter((location, index, self) =>
                    index === self.findIndex((l) => (
                        l.name === location.name
                    ))
                ).slice(0, nearMeOptions.rounds); // Ensure we only take as many as needed

                locations = uniqueLocations;

                if (locations.length < nearMeOptions.rounds) {
                    toast({ title: "Not Enough Locations", description: `Could only find ${locations.length} unique locations. Try expanding your radius or adding categories.`, variant: "destructive" });
                    if(!isMultiplayer) resetGame();
                    else setGameState('customizing_near_me');
                    return;
                }
            } else {
                locations = [...locationPacks[gameMode as keyof typeof locationPacks]].sort(() => 0.5 - Math.random()).slice(0, totalRounds);
            }
            
            if (isMultiplayer && lobbyId && isHost) {
                await updateDoc(doc(db, 'lobbies', lobbyId), {
                    locations: locations,
                });
            } else {
                 setCurrentLocationSet(locations);
                 startNewRound(locations); // Directly start the first round with the new locations
            }

        } catch (e: any) {
            toast({ title: "Error", description: `Failed to get locations: ${e.message}`, variant: "destructive"});
            resetGame();
        }
    }
    
    setupGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameMode, locationLoading, userLocation, locationError, nearMeOptions, isMultiplayer, isHost, lobbyId]);


  const handleSetGameMode = useCallback(async (mode: GameMode) => {
    if(isMultiplayer && lobbyId && isHost) {
        await updateDoc(doc(db, 'lobbies', lobbyId), { gameMode: mode });
    }
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
  }, [permissionState, toast, prepareGame, isMultiplayer, lobbyId, isHost]);

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
       if (currentRound >= totalRounds) {
            if(isHost && lobbyId) {
                // Logic to end game for all, maybe set status to 'finished'
                 updateDoc(doc(db, 'lobbies', lobbyId), { status: 'finished' });
            }
            resetGame();
       } else {
            startNewRound();
       }
    }
  }, [gameState, currentRound, totalRounds, startNewRound, resetGame, isHost, lobbyId]);

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
    totalRounds,
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
    isMultiplayer,
    isHost,
    lobby,
  };
}

    
