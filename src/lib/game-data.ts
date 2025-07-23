
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

export async function getGameModes(): Promise<GameMode[]> {
    const gameModesCol = collection(db, 'game_modes');
    const snapshot = await getDocs(gameModesCol);
    if (snapshot.empty) {
        console.log('No game modes found.');
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameMode));
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
