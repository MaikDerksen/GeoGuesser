
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, setDoc } from 'firebase/firestore';

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

// Database Seeding Function
export async function seedDatabase(): Promise<void> {
    const sampleGameModes: GameMode[] = [
        {
            id: 'USA',
            name: 'USA Landmarks',
            locations: [
                { name: 'Statue of Liberty', coordinates: { latitude: 40.6892, longitude: -74.0445 } },
                { name: 'Golden Gate Bridge', coordinates: { latitude: 37.8199, longitude: -122.4783 } },
                { name: 'Mount Rushmore', coordinates: { latitude: 43.8791, longitude: -103.4591 } },
                { name: 'The White House', coordinates: { latitude: 38.8977, longitude: -77.0365 } },
                { name: 'Gateway Arch', coordinates: { latitude: 38.6247, longitude: -90.1848 } }
            ]
        },
        {
            id: 'WORLD',
            name: 'World Wonders',
            locations: [
                { name: 'Great Wall of China', coordinates: { latitude: 40.4319, longitude: 116.5704 } },
                { name: 'Petra', coordinates: { latitude: 30.3285, longitude: 35.4444 } },
                { name: 'Machu Picchu', coordinates: { latitude: -13.1631, longitude: -72.5450 } },
                { name: 'Eiffel Tower', coordinates: { latitude: 48.8584, longitude: 2.2945 } },
                { name: 'Taj Mahal', coordinates: { latitude: 27.1751, longitude: 78.0421 } },
                { name: 'Colosseum', coordinates: { latitude: 41.8902, longitude: 12.4922 } },
                { name: 'Christ the Redeemer', coordinates: { latitude: -22.9519, longitude: -43.2105 } }
            ]
        }
    ];

    const batch = writeBatch(db);

    sampleGameModes.forEach(mode => {
        const docRef = doc(db, 'game_modes', mode.id);
        // Use setDoc to ensure the document ID is what we specify (e.g., 'USA')
        batch.set(docRef, { name: mode.name, locations: mode.locations });
    });

    await batch.commit();
}
