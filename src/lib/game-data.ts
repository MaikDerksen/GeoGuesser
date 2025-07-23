
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';

export interface Location {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface GameMode {
    id: string;
    name: string;
    locations: Location[];
}

export async function getAllGameModes(): Promise<GameMode[]> {
    const gameModesCol = collection(db, 'game_modes');
    const snapshot = await getDocs(gameModesCol);
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameMode));
}

export async function getGameModes(): Promise<GameMode[]> {
   return getAllGameModes();
}


export async function getLocationsForGameMode(gameModeId: string): Promise<Location[]> {
    const docRef = doc(db, 'game_modes', gameModeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const gameModeData = docSnap.data() as GameMode;
        return gameModeData.locations || [];
    } else {
        console.log(`No such game mode: ${gameModeId}`);
        return [];
    }
}


// Admin Functions
export async function addGameMode(newMode: Omit<GameMode, 'id'>): Promise<string> {
    const gameModesCol = collection(db, 'game_modes');
    const docRef = await addDoc(gameModesCol, newMode);
    return docRef.id;
}

export async function updateGameMode(modeId: string, updatedData: Partial<GameMode>): Promise<void> {
    const docRef = doc(db, 'game_modes', modeId);
    await updateDoc(docRef, updatedData);
}

export async function deleteGameMode(modeId: string): Promise<void> {
    const docRef = doc(db, 'game_modes', modeId);
    await deleteDoc(docRef);
}

export async function addLocationToGameMode(modeId: string, newLocation: Location): Promise<void> {
    const docRef = doc(db, 'game_modes', modeId);
    await updateDoc(docRef, {
        locations: arrayUnion(newLocation)
    });
}

export async function updateLocationInGameMode(modeId: string, locationIndex: number, updatedLocation: Location): Promise<void> {
    const docRef = doc(db, 'game_modes', modeId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const gameMode = docSnap.data() as GameMode;
        const newLocations = [...gameMode.locations];
        if (locationIndex >= 0 && locationIndex < newLocations.length) {
            newLocations[locationIndex] = updatedLocation;
            await updateDoc(docRef, { locations: newLocations });
        } else {
            throw new Error("Location index out of bounds.");
        }
    } else {
        throw new Error("Game mode not found.");
    }
}

export async function deleteLocationFromGameMode(modeId: string, locationIndex: number): Promise<void> {
    const docRef = doc(db, 'game_modes', modeId);
    const docSnap = await getDoc(docRef);
     if (docSnap.exists()) {
        const gameMode = docSnap.data() as GameMode;
        const newLocations = [...gameMode.locations];
         if (locationIndex >= 0 && locationIndex < newLocations.length) {
            const locationToRemove = newLocations[locationIndex];
            await updateDoc(docRef, { locations: arrayRemove(locationToRemove) });
        } else {
            throw new Error("Location index out of bounds.");
        }
    } else {
        throw new Error("Game mode not found.");
    }
}

