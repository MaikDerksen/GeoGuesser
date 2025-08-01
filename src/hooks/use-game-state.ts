
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Location, GameMode } from '@/lib/game-data';
import { getGameModes, getUserGameModes, getLocationsForGameMode, saveNearMeGameData } from '@/lib/game-data';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useDeviceOrientation } from '@/hooks/use-device-orientation';
import { calculateBearing } from '@/lib/geo';
import { useToast } from "@/hooks/use-toast";
import type { User } from 'firebase/auth';
import { getNearbyLocations, type GetNearbyLocationsInput } from '@/ai/flows/get-nearby-locations';
import { doc, onSnapshot, updateDoc, getDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Lobby } from './use-lobby';


type GameState = 'idle' | 'mode_selection' | 'permission' | 'customizing_near_me' | 'loading_location' | 'playing' | 'results' | 'explorer' | 'continent_selection' | 'custom_game_list';
type GameModeId = string;

interface NearMeOptions {
    radius: number;
    rounds: number;
    categories: {
        restaurant: boolean;
        tourist_attraction: boolean;
        store: boolean;
        hotel: boolean;
        airport: boolean;
        park: boolean;
    }
}

const ROUND_TIMER = 15;

export function useGameState(user: User | null, lobbyId: string | null = null) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [gameMode, setGameMode] = useState<GameModeId | null>(null);
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIMER);
  const [gameLoading, setGameLoading] = useState(false);
  const [gameModes, setGameModes] = useState<GameMode[]>([]);
  const [userGameModes, setUserGameModes] = useState<GameMode[]>([]);


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
          restaurant: true,
          tourist_attraction: true,
          store: true,
          hotel: false,
          airport: false,
          park: true,
      }
  });

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

   useEffect(() => {
    getGameModes().then(setGameModes).catch(err => {
        console.error("Failed to fetch game modes:", err);
        toast({ title: "Error", description: "Could not fetch game modes from the server.", variant: "destructive" });
    });
    if(user){
        getUserGameModes(user.uid).then(setUserGameModes).catch(err => {
            console.error("Failed to fetch user game modes:", err);
            toast({ title: "Error", description: "Could not fetch your custom game modes.", variant: "destructive" });
        });
    }
   }, [toast, user]);
    
   // Get user location once on initial load for explorer mode and caching
   useEffect(() => {
       if(permissionState === 'granted') {
           getLocation();
       }
   }, [permissionState, getLocation]);

   useEffect(() => {
    if (!lobbyId) return;

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
            } else if (lobbyData.status === 'finished') {
                toast({title: "Game Over", description: "The host has ended the game."});
                resetGame();
            }

        } else {
            toast({title: "Lobby closed", description: "This lobby is no longer active.", variant: "destructive"});
            resetGame();
        }
    });

    return () => unsub();
  }, [lobbyId, toast, resetGame]);

  const totalRounds = useMemo(() => {
    if (gameMode === 'NEAR_ME') {
      return nearMeOptions.rounds;
    }
    const allModes = [...gameModes, ...userGameModes];
    const selectedMode = allModes.find(m => m.id === gameMode);
    return selectedMode?.locations?.length || 7;
  }, [gameMode, nearMeOptions.rounds, gameModes, userGameModes]);

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
        const batch = writeBatch(db);

        const lobbySnap = await getDoc(lobbyRef);
        if(lobbySnap.exists()){
            const lobbyData = lobbySnap.data() as Lobby;
            const playerIndex = lobbyData.players.findIndex(p => p.uid === user.uid);
            if(playerIndex !== -1){
                const newPlayers = [...lobbyData.players];
                const currentGuesses = newPlayers[playerIndex].guesses || [];
                while(currentGuesses.length < lobbyData.currentRound) {
                    currentGuesses.push(null);
                }
                currentGuesses[lobbyData.currentRound - 1] = angle;
                newPlayers[playerIndex].score += roundPoints;

                batch.update(lobbyRef, { players: newPlayers });
                await batch.commit();
            }
        }
    }
    
    setGameState('results');
  }, [gameState, targetBearing, isMultiplayer, lobbyId, user]);

  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) {
      if (timeLeft <= 0) {
        handleGuess(heading); 
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
        if (isHost || !isMultiplayer) resetGame();
        return;
    }
    setUserGuess(null);
    
    const newRound = currentRound + 1;
    const randomLocation = locationSet[newRound -1];
    
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
    
  }, [currentLocationSet, resetGame, toast, isHost, isMultiplayer, currentRound, lobbyId]);


  const prepareGame = useCallback(() => {
    if (isMultiplayer && !isHost) return;

    setGameState('loading_location');
    setGameLoading(true);

    if (!userLocation) {
        getLocation();
    }
  }, [getLocation, isMultiplayer, isHost, userLocation]);

  useEffect(() => {
    const setupGame = async () => {
        if (gameState !== 'loading_location' || locationLoading || !gameMode || !user) return;
        if (isMultiplayer && !isHost) return;

        if (!userLocation) {
            if(locationError) {
                toast({ title: "Location Error", description: `Could not get your location: ${locationError.message}`, variant: "destructive"});
                resetGame();
            }
            return;
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
                
                const nearMeRequest: GetNearbyLocationsInput = { 
                    latitude: userLocation.latitude, 
                    longitude: userLocation.longitude,
                    radius: nearMeOptions.radius,
                    categories: selectedCategories,
                    count: nearMeOptions.rounds,
                };

                const { curatedLocations, rawApiResponse } = await getNearbyLocations(nearMeRequest);

                const uniqueLocations = curatedLocations.filter((location, index, self) =>
                    index === self.findIndex((l) => (
                        l.name === location.name
                    ))
                ).slice(0, nearMeOptions.rounds);

                locations = uniqueLocations;

                if (locations.length < nearMeOptions.rounds) {
                    toast({ title: "Not Enough Locations", description: `Could only find ${locations.length} unique locations. Try expanding your radius or adding categories.`, variant: "destructive" });
                    if(!isMultiplayer) resetGame();
                    else setGameState('customizing_near_me');
                    return;
                }

                try {
                     await saveNearMeGameData({
                        userId: user.uid,
                        userLocation: {latitude: userLocation.latitude, longitude: userLocation.longitude },
                        nearMeOptions,
                        request: nearMeRequest,
                        rawResponse: rawApiResponse,
                        finalLocations: locations,
                     })
                } catch(e) {
                    console.error("Failed to log 'Near Me' game data", e);
                }

            } else {
                const packLocations = await getLocationsForGameMode(gameMode);
                locations = [...packLocations].sort(() => 0.5 - Math.random()).slice(0, totalRounds);
            }
            
            if (isMultiplayer && lobbyId && isHost) {
                await updateDoc(doc(db, 'lobbies', lobbyId), {
                    locations: locations,
                });
            } else {
                 setCurrentLocationSet(locations);
                 startNewRound(locations);
            }

        } catch (e: any) {
            toast({ title: "Error", description: `Failed to get locations: ${e.message}`, variant: "destructive"});
            resetGame();
        }
    }
    
    setupGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameMode, locationLoading, userLocation, locationError, nearMeOptions, isMultiplayer, isHost, lobbyId, user]);


  const handleSetGameMode = useCallback(async (modeKey: GameModeId) => {
    
    const continentMap: { [key: string]: string } = {
        'america': 'USA Landmarks',
        'south_america': 'Latin America',
        'europe': 'Europe',
        'asia': 'Asia',
        'africa': 'Africa',
        'australia': 'Oceania'
    };

    const targetGameName = continentMap[modeKey] || modeKey;

    let selectedMode: GameMode | undefined;
     if (targetGameName === 'NEAR_ME') {
        selectedMode = { id: 'NEAR_ME', name: 'NEAR_ME', locations: []};
    } else {
        const allModes = [...gameModes, ...userGameModes];
        selectedMode = allModes.find(m => m.name === targetGameName || m.id === targetGameName);
    }

    if (!selectedMode) {
        toast({ title: "Mode Not Found", description: `Could not find a game mode for "${targetGameName}".`, variant: "destructive"});
        return;
    }
    
    const finalModeId = selectedMode.id;
    
    if(isMultiplayer && lobbyId && isHost) {
        await updateDoc(doc(db, 'lobbies', lobbyId), { gameMode: finalModeId });
    }
    setGameMode(finalModeId);
    setCurrentRound(0);
    setScore(0);

    if (finalModeId === 'NEAR_ME') {
      setGameState('customizing_near_me');
      return;
    }
    
    prepareGame();

  }, [prepareGame, isMultiplayer, lobbyId, isHost, gameModes, userGameModes, toast]);

  const handleStartNearMe = useCallback(() => {
    prepareGame();
  }, [prepareGame]);

  const handleStart = useCallback(async () => {
    if (gameState === 'results') {
       if (currentRound >= totalRounds) {
            if(isHost && lobbyId) {
                 await deleteDoc(doc(db, 'lobbies', lobbyId));
            }
            resetGame();
       } else {
            startNewRound();
       }
    }
  }, [gameState, currentRound, totalRounds, startNewRound, resetGame, isHost, lobbyId]);

  const handleGrantPermission = async (nextState?: string | null) => {
    const status = await requestPermission();
    if (status === 'granted') {
        if (nextState) {
            setGameState(nextState as GameState);
        } else if (gameState === 'permission' && (gameMode || lobbyId)) { // If we were waiting for permission for a game
             prepareGame();
        } else { // If we just needed it for explorer mode
            setGameState('explorer');
        }
    } else {
        setGameState('idle');
        setGameMode(null);
        toast({ title: "Permission Denied", description: "Permission for device sensors was denied. The game cannot start.", variant: "destructive"});
    }
  }


  useEffect(() => {
    if (!user) {
      resetGame();
    }
  }, [user, resetGame]);

  useEffect(() => {
    if (!isMultiplayer && (gameState === 'playing' || gameState === 'results' || gameState === 'loading_location') && !gameMode) {
        resetGame();
    }
  }, [isMultiplayer, gameState, gameMode, resetGame]);


  return {
    gameState,
    setGameState,
    score,
    currentRound,
    totalRounds,
    timeLeft,
    target,
    setTarget,
    heading,
    targetBearing,
    userGuess,
    handleGuess,
    appUrl,
    gameMode,
    gameModes: userGameModes, // Only expose user-created modes to UI
    loading: gameLoading,
    nearMeOptions,
    setNearMeOptions,
    handleSetGameMode,
    handleStart,
    handleGrantPermission,
    permissionState,
    resetGame,
    handleStartNearMe,
    isMultiplayer,
    isHost,
    lobby,
  };
}
