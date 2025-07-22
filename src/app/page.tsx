
"use client";

import { useEffect, useState } from 'react';
import Compass from '@/components/compass';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Compass as CompassIcon, QrCode, LogOut, Users, Play } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useGameState } from '@/hooks/use-game-state';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  
  const {
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
    handleSetGameMode,
    handleStart,
    handleGuess,
    handleGrantPermission,
    permissionState,
    resetGame,
  } = useGameState(user);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const handleModeSelection = (multiplayer: boolean) => {
    setIsMultiplayer(multiplayer);
    if(multiplayer) {
      router.push('/lobby');
    } else {
      setGameState('mode_selection');
    }
  }

  const renderContent = () => {
    if (authLoading || !user) {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Authenticating...</p>
        </div>
      );
    }


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
        );
      case 'mode_selection':
        return (
            <Card className="text-center max-w-md">
                <CardHeader>
                    <CardTitle>Choose a Game Mode</CardTitle>
                    <CardDescription>Select a set of locations to play with.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <Button onClick={() => handleSetGameMode('USA')} size="lg">USA</Button>
                    <Button onClick={() => handleSetGameMode('EU')} size="lg">Europe</Button>
                    <Button onClick={() => handleSetGameMode('ASIA')} size="lg">Asia</Button>
                    <Button onClick={() => {
                        // Near me is not implemented yet
                    }} size="lg" disabled>Near Me</Button>
                </CardContent>
                 <CardContent>
                    <Button variant="link" onClick={() => resetGame()}>Back to main menu</Button>
                </CardContent>
            </Card>
        );
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
          <div className="flex flex-col items-center gap-6 w-full max-w-md">
            <div className="w-full flex justify-between items-center text-lg font-semibold">
                <span>Round: {currentRound}/{totalRounds}</span>
                <span>Score: {score}</span>
            </div>
             <div className="w-full space-y-2">
                <Progress value={(timeLeft / 15) * 100} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">Time left: {timeLeft}s</p>
            </div>
            <h2 className="text-2xl font-semibold text-center">Find: <span className="text-primary font-bold">{target?.name}</span></h2>
            <p className="text-muted-foreground text-center">Point your device and tap the compass to guess.</p>
            <Compass heading={heading} onGuess={handleGuess} gameState={gameState} />
          </div>
        );
      case 'results':
        const difference = userGuess !== null && targetBearing !== null ? Math.min(Math.abs(userGuess - targetBearing), 360 - Math.abs(userGuess - targetBearing)) : 0;
        const roundPoints = Math.max(0, 360 - Math.floor(difference));
        
        const isLastRound = currentRound === totalRounds;

        return (
            <div className="flex flex-col items-center gap-6">
                <h2 className="text-2xl font-semibold text-center">
                    {isLastRound ? 'Final Score' : `Round ${currentRound} Complete`}
                </h2>
                 {!isLastRound && <p className="text-primary font-bold text-xl">+{roundPoints} points</p> }
                <Compass heading={heading} gameState={gameState} guessAngle={userGuess} targetAngle={targetBearing} />
                <Card className="text-center w-full max-w-sm">
                    <CardHeader>
                       <CardTitle>{isLastRound ? `Total Score: ${score}` : `You were off by ${difference.toFixed(1)}°`}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex justify-around gap-4">
                            <div><p className="text-sm text-primary">Your Guess</p><p className="text-2xl font-bold">{userGuess?.toFixed(1)}°</p></div>
                            <div><p className="text-sm text-accent">Actual</p><p className="text-2xl font-bold">{targetBearing?.toFixed(1)}°</p></div>
                         </div>
                         <Button onClick={handleStart}>{isLastRound ? "Play Again" : "Next Round"}</Button>
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
            <CardContent className="flex flex-col gap-4">
              <p className="text-muted-foreground">Welcome, {user.displayName || user.email}!</p>
               <Button onClick={() => handleModeSelection(false)} size="lg"><Play /> Single Player</Button>
               <Button onClick={() => handleModeSelection(true)} size="lg"><Users /> Multiplayer</Button>
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
      {user && (
         <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-6 w-6" />
          </Button>
        </div>
      )}
       {appUrl && (
        <div className="absolute bottom-4 right-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <QrCode className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Scan to play on your phone</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                <QRCode value={appUrl} size={256} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </main>
  );
}
