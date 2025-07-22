
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useLobby } from '@/hooks/use-lobby';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


export default function LobbyPage() {
    const { user, loading: authLoading, signOut } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const {
        lobbyId,
        lobby,
        loading: lobbyLoading,
        error: lobbyError,
        createLobby,
        joinLobby,
        startGame,
        leaveLobby
    } = useLobby(user);
    const [joinCode, setJoinCode] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if(lobbyError) {
            toast({ title: "Lobby Error", description: lobbyError, variant: "destructive" });
        }
    }, [lobbyError, toast])

    useEffect(() => {
        if (lobby?.status === 'playing') {
            router.push(`/game/${lobbyId}`);
        }
    }, [lobby, lobbyId, router]);


    if (authLoading || !user) {
        return <div className="flex min-h-screen w-full flex-col items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    const copyLobbyId = () => {
        if(lobbyId) {
             navigator.clipboard.writeText(lobbyId);
             toast({ title: "Copied!", description: "Lobby code copied to clipboard." });
        }
    }

    const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        if (value.length > 7) return;

        if (value.length === 3 && joinCode.length < 3) {
            setJoinCode(value + '-');
        } else {
            setJoinCode(value);
        }
    };


    if (lobbyId && lobby) {
        const isHost = lobby.hostId === user.uid;
        return (
            <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background font-body">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Lobby</CardTitle>
                        <CardDescription>Waiting for players to join...</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-center space-x-2">
                           <Input type="text" readOnly value={lobbyId} className="text-center font-mono tracking-widest text-lg" />
                           <Button onClick={copyLobbyId} size="icon" variant="outline"><Copy/></Button>
                        </div>
                        
                        <div className="space-y-4">
                            <h3 className="font-semibold">Players ({lobby.players.length}/{lobby.maxPlayers})</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {lobby.players.map(p => (
                                    <div key={p.uid} className="flex items-center gap-2 p-2 rounded-md bg-muted">
                                        <Avatar>
                                            <AvatarImage src={p.photoURL || undefined} />
                                            <AvatarFallback>{p.displayName?.[0] || 'P'}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{p.displayName} {p.uid === lobby.hostId && '(Host)'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isHost && <Button onClick={startGame} disabled={lobbyLoading || lobby.players.length < 2}>Start Game</Button>}
                        <Button variant="ghost" onClick={() => {
                            leaveLobby();
                            router.push('/');
                        }}>Leave Lobby</Button>

                    </CardContent>
                </Card>
                <div className="absolute top-4 right-4">
                    <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                        <LogOut className="h-6 w-6" />
                    </Button>
                </div>
            </main>
        )
    }

    return (
        <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background font-body">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Multiplayer</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <Button onClick={createLobby} disabled={lobbyLoading}>
                        {lobbyLoading ? <Loader2 className="animate-spin"/> : 'Create Lobby'}
                    </Button>
                     <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Or
                            </span>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Input 
                            placeholder="Enter code (e.g. ABC-XYZ)" 
                            value={joinCode} 
                            onChange={handleJoinCodeChange}
                            maxLength={7}
                            className="text-center tracking-widest"
                        />
                        <Button onClick={() => joinLobby(joinCode)} disabled={lobbyLoading || joinCode.length !== 7}>
                             {lobbyLoading ? <Loader2 className="animate-spin"/> : 'Join Lobby'}
                        </Button>
                    </div>
                     <Button variant="link" onClick={() => router.push('/')}>Back to main menu</Button>
                </CardContent>
            </Card>
             <div className="absolute top-4 right-4">
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                    <LogOut className="h-6 w-6" />
                </Button>
            </div>
        </main>
    )

}
