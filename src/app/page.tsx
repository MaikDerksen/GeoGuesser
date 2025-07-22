"use client";

import { useState, useEffect, useMemo } from 'react';
import Compass from '@/components/compass';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useDeviceOrientation } from '@/hooks/use-device-orientation';
import type { Location } from '@/lib/locations';
import { locations } from '@/lib/locations';
import { calculateBearing } from '@/lib/geo';
import { Loader2, Compass as CompassIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type GameState = 'idle' | 'permission' | 'loading_location' | 'playing' | 'results';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [target, setTarget] = useState<Location | null>(null);
  const [userGuess, setUserGuess] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: userLocation, loading: locationLoading, error: locationError, getLocation } = useGeolocation();
  const { orientation, error: orientationError, requestPermission, permissionState } = useDeviceOrientation();

  const heading = useMemo(() => {
    if (!orientation) return 0;
    if (orientation.webkitCompassHeading) {
      return orientation.webkitCompassHeading;
    }
    return orientation.alpha !== null ? 360 - orientation.alpha : 0;
  }, [orientation]);

  const targetBearing = useMemo(() => {
    if (!userLocation || !target) return null;
    return calculateBearing(
      userLocation.latitude,
      userLocation.longitude,
      target.coordinates.latitude,
      target.coordinates.longitude
    );
  }, [userLocation, target]);

  const handleStart = () => {
    if (permissionState === 'prompt' || permissionState === 'not-supported' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setGameState('permission');
    } else if (permissionState === 'granted') {
      startNewRound();
    } else {
      toast({ title: "Permission Required", description: "Device orientation permission is required to play. Please enable it in your browser settings.", variant: "destructive"});
    }
  };

  const handleGrantPermission = async () => {
    const status = await requestPermission();
    if (status === 'granted') {
        startNewRound();
    } else {
        setGameState('idle');
        toast({ title: "Permission Denied", description: "Permission for device orientation was denied. The game cannot start.", variant: "destructive"});
    }
  }

  const startNewRound = () => {
    setGameState('loading_location');
    setUserGuess(null);
    const randomLocation = locations[Math.floor(Math.random() * locations.length)];
    setTarget(randomLocation);
    getLocation();
  };

  useEffect(() => {
    if (gameState === 'loading_location' && !locationLoading) {
      if (userLocation) {
        setGameState('playing');
      }
      if (locationError) {
        setGameState('idle');
        toast({ title: "Location Error", description: `Could not get your location: ${locationError.message}`, variant: "destructive"});
      }
    }
  }, [gameState, locationLoading, userLocation, locationError, toast]);


  const handleGuess = (angle: number) => {
    if (gameState !== 'playing') return;
    setUserGuess(angle);
    setGameState('results');
  };

  const renderContent = () => {
    switch (gameState) {
      case 'permission':
        return (
             <Card className="text-center max-w-md">
                <CardHeader>
                    <CardTitle>Permissions Required</CardTitle>
                    <CardDescription>GeoCompass needs access to your device's motion sensors to work.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleGrantPermission} size="lg">Grant Permission</Button>
                </CardContent>
            </Card>
        )
      case 'loading_location':
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground">Acquiring satellite lock...</p>
                <p className="text-sm text-muted-foreground/80">(Getting your location)</p>
            </div>
        );
      case 'playing':
        return (
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-2xl font-semibold text-center">Find: <span className="text-primary font-bold">{target?.name}</span></h2>
            <p className="text-muted-foreground text-center">Point your device and tap the compass to guess.</p>
            <Compass heading={heading} onGuess={handleGuess} gameState={gameState} />
          </div>
        );
      case 'results':
        const difference = userGuess !== null && targetBearing !== null ? Math.min(Math.abs(userGuess - targetBearing), 360 - Math.abs(userGuess - targetBearing)) : 0;
        return (
            <div className="flex flex-col items-center gap-6">
                <h2 className="text-2xl font-semibold text-center">Result for: <span className="text-primary font-bold">{target?.name}</span></h2>
                <Compass heading={heading} gameState={gameState} guessAngle={userGuess} targetAngle={targetBearing} />
                <Card className="text-center w-full max-w-sm">
                    <CardHeader>
                        <CardTitle>You were off by {difference.toFixed(1)}°</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex justify-around gap-4">
                            <div><p className="text-sm text-primary">Your Guess</p><p className="text-2xl font-bold">{userGuess?.toFixed(1)}°</p></div>
                            <div><p className="text-sm text-accent">Actual</p><p className="text-2xl font-bold">{targetBearing?.toFixed(1)}°</p></div>
                         </div>
                         <Button onClick={handleStart}>Play Again</Button>
                    </CardContent>
                </Card>
            </div>
        );
      default: // idle
        return (
          <Card className="text-center max-w-md">
            <CardHeader>
              <CardTitle className="text-4xl font-headline flex items-center justify-center gap-2"><CompassIcon className="h-10 w-10 text-primary" /> GeoCompass</CardTitle>
              <CardDescription>Guess the direction of famous landmarks!</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Point your device to where you think the target is and make your guess. Your phone's compass and GPS will be used.</p>
              <Button onClick={handleStart} size="lg">Start Game</Button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background font-body">
      <div className="container mx-auto flex items-center justify-center">
        {renderContent()}
      </div>
    </main>
  );
}
