
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

interface Player {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
    score: number;
    guesses: (number | null)[];
}

interface Lobby {
    id: string;
    hostId: string;
    players: Player[];
    status: 'waiting' | 'playing' | 'finished';
    createdAt: any;
    gameMode: string | null;
    currentRound: number;
    locations: any[]; // Replace with actual location type
    maxPlayers: number;
}

function generateLobbyCode(): string {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}


export function useLobby(user: User | null) {
    const [lobbyId, setLobbyId] = useState<string | null>(null);
    const [lobby, setLobby] = useState<Lobby | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lobbyId) return;

        setLoading(true);
        const unsubscribe = onSnapshot(doc(db, 'lobbies', lobbyId), (doc) => {
            if (doc.exists()) {
                setLobby(doc.data() as Lobby);
            } else {
                setError("Lobby not found.");
                setLobby(null);
                setLobbyId(null);
            }
            setLoading(false);
        }, (err) => {
            console.error(err);
            setError("Failed to listen to lobby changes.");
            setLoading(false);
        });

        return () => unsubscribe();

    }, [lobbyId]);

    const createLobby = useCallback(async () => {
        if (!user) {
            setError("You must be logged in to create a lobby.");
            return;
        }
        setLoading(true);
        setError(null);
        
        const newLobbyId = generateLobbyCode();
        const newPlayer: Player = {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            score: 0,
            guesses: [],
        };
        const newLobby: Lobby = {
            id: newLobbyId,
            hostId: user.uid,
            players: [newPlayer],
            status: 'waiting',
            createdAt: serverTimestamp(),
            gameMode: null,
            currentRound: 0,
            locations: [],
            maxPlayers: 8,
        };

        try {
            await setDoc(doc(db, 'lobbies', newLobbyId), newLobby);
            setLobbyId(newLobbyId);
        } catch (err) {
            console.error(err);
            setError("Failed to create lobby.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    const joinLobby = useCallback(async (code: string) => {
        if (!user) {
            setError("You must be logged in to join a lobby.");
            return;
        }
        setLoading(true);
        setError(null);
        
        const lobbyRef = doc(db, 'lobbies', code);
        try {
            const lobbySnap = await getDoc(lobbyRef);
            if (!lobbySnap.exists()) {
                throw new Error("Lobby not found.");
            }
            const currentLobby = lobbySnap.data() as Lobby;
            if (currentLobby.players.length >= currentLobby.maxPlayers) {
                throw new Error("Lobby is full.");
            }
            if(currentLobby.players.find(p => p.uid === user.uid)) {
                setLobbyId(code); // Already in lobby, just set it
                return;
            }

            const newPlayer: Player = {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                score: 0,
                guesses: [],
            };
            await updateDoc(lobbyRef, {
                players: arrayUnion(newPlayer)
            });
            setLobbyId(code);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to join lobby.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    const leaveLobby = useCallback(async () => {
        if (!user || !lobbyId) return;
        
        const lobbyRef = doc(db, 'lobbies', lobbyId);
        try {
            const lobbySnap = await getDoc(lobbyRef);
            if (lobbySnap.exists()) {
                const currentLobby = lobbySnap.data() as Lobby;
                const playerToRemove = currentLobby.players.find(p => p.uid === user.uid);

                if (currentLobby.hostId === user.uid && currentLobby.players.length > 1) {
                    // Host is leaving, assign a new host
                    const newHost = currentLobby.players.find(p => p.uid !== user.uid);
                    if (newHost) {
                        await updateDoc(lobbyRef, {
                            hostId: newHost.uid,
                            players: arrayRemove(playerToRemove)
                        });
                    }
                } else if (currentLobby.players.length === 1) {
                    // Last player is leaving, delete the lobby
                    await deleteDoc(lobbyRef);
                } else {
                    await updateDoc(lobbyRef, {
                        players: arrayRemove(playerToRemove)
                    });
                }
            }
        } catch(err) {
            console.error(err);
            setError("Failed to leave lobby.");
        }
        setLobbyId(null);
        setLobby(null);
    }, [user, lobbyId]);

    const startGame = useCallback(async () => {
         if (!user || !lobbyId || !lobby || lobby.hostId !== user.uid) return;

         setLoading(true);
         try {
            // Here you would select a gamemode and locations
            await updateDoc(doc(db, 'lobbies', lobbyId), {
                status: 'playing',
                // You would also populate locations here based on a chosen game mode
            });
         } catch(err) {
            console.error(err);
            setError("Failed to start game.");
         } finally {
            setLoading(false);
         }
    }, [user, lobbyId, lobby]);

    return { lobbyId, lobby, loading, error, createLobby, joinLobby, leaveLobby, startGame };
}
