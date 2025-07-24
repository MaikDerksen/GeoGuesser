
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, setDoc, serverTimestamp, query, where, limit } from 'firebase/firestore';

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
    userId?: string; // To distinguish user-created modes
    isDefault?: boolean; // To identify seeded data
}

export interface NearMeGameLog {
    userId: string;
    gameId: string;
    createdAt: any;
    userLocation: {
        latitude: number;
        longitude: number;
    };
    nearMeOptions: any;
    request: any; // The full request sent to the AI/Places API
    rawResponse: any; // Raw response from the Places API
    finalLocations: Location[];
}

export interface LocationCache {
    id?: string;
    center: {
        latitude: number;
        longitude: number;
    };
    radius: number; // in meters
    createdAt: any;
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

export async function getUserGameModes(userId: string): Promise<GameMode[]> {
    if (!userId) return [];
    const gameModesCol = collection(db, 'game_modes');
    const q = query(gameModesCol, where("userId", "==", userId));
    const snapshot = await getDocs(q);
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
export async function addGameMode(newMode: Omit<GameMode, 'id' | 'isDefault'>): Promise<string> {
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
            // This is tricky because arrayRemove needs the exact object.
            // A more robust way is to read, modify, and write the whole array.
             newLocations.splice(locationIndex, 1);
             await updateDoc(docRef, { locations: newLocations });
        } else {
            throw new Error("Location index out of bounds.");
        }
    } else {
        throw new Error("Game mode not found.");
    }
}

export async function saveNearMeGameData(data: Omit<NearMeGameLog, 'gameId' | 'createdAt'>): Promise<void> {
    const gameId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const logData: NearMeGameLog = {
        ...data,
        gameId,
        createdAt: serverTimestamp(),
    };
    
    const docRef = doc(db, `game_modes/NEAR_ME/logs/${logData.gameId}`);
    await setDoc(docRef, logData);
}


export async function findLocationCache(lat: number, lon: number, radius: number): Promise<LocationCache | null> {
    const cacheRef = collection(db, 'location_cache');

    const latDegrees = radius / 111320; 
    const lonDegrees = radius / (111320 * Math.cos(lat * (Math.PI / 180)));

    const minLat = lat - latDegrees;
    const maxLat = lat + latDegrees;
    const minLon = lon - lonDegrees;
    const maxLon = lon + lonDegrees;

    const q = query(
        cacheRef,
        where('center.latitude', '>=', minLat),
        where('center.latitude', '<=', maxLat),
        limit(20)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }

    const searchPoint = { lat, lon };

    for (const doc of snapshot.docs) {
        const cache = doc.data() as LocationCache;
        if (cache.center.longitude >= minLon && cache.center.longitude <= maxLon) {
             const cachePoint = { lat: cache.center.latitude, lon: cache.center.longitude };
            const R = 6371e3; // metres
            const φ1 = searchPoint.lat * Math.PI/180;
            const φ2 = cachePoint.lat * Math.PI/180;
            const Δφ = (cachePoint.lat-searchPoint.lat) * Math.PI/180;
            const Δλ = (cachePoint.lon-searchPoint.lon) * Math.PI/180;

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c; // in metres

            if (distance < cache.radius) {
                return { id: doc.id, ...cache };
            }
        }
    }

    return null;
}

export async function saveLocationCache(cache: Omit<LocationCache, 'id' | 'createdAt'>): Promise<string> {
    const cacheRef = collection(db, 'location_cache');
    const newCache: Omit<LocationCache, 'id'> = {
        ...cache,
        createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(cacheRef, newCache);
    return docRef.id;
}


// Database Seeding Function
export async function seedDatabase(): Promise<void> {
    const sampleGameModes: Omit<GameMode, 'id' | 'userId'>[] = [
        {
            name: 'USA Landmarks', isDefault: true,
            locations: [
                { name: 'Statue of Liberty', coordinates: { latitude: 40.6892, longitude: -74.0445 } },
                { name: 'Golden Gate Bridge', coordinates: { latitude: 37.8199, longitude: -122.4783 } },
                { name: 'Mount Rushmore', coordinates: { latitude: 43.8791, longitude: -103.4591 } },
                { name: 'The White House', coordinates: { latitude: 38.8977, longitude: -77.0365 } },
                { name: 'Gateway Arch', coordinates: { latitude: 38.6247, longitude: -90.1848 } }
            ]
        },
        {
            name: 'World Wonders', isDefault: true,
            locations: [
                { name: 'Great Wall of China', coordinates: { latitude: 40.4319, longitude: 116.5704 } },
                { name: 'Petra', coordinates: { latitude: 30.3285, longitude: 35.4444 } },
                { name: 'Machu Picchu', coordinates: { latitude: -13.1631, longitude: -72.5450 } },
                { name: 'Eiffel Tower', coordinates: { latitude: 48.8584, longitude: 2.2945 } },
                { name: 'Taj Mahal', coordinates: { latitude: 27.1751, longitude: 78.0421 } },
                { name: 'Colosseum', coordinates: { latitude: 41.8902, longitude: 12.4922 } },
                { name: 'Christ the Redeemer', coordinates: { latitude: -22.9519, longitude: -43.2105 } }
            ]
        },
        {
            name: 'Europe', isDefault: true,
            locations: [
                { name: 'Big Ben', coordinates: { latitude: 51.5007, longitude: -0.1246 } },
                { name: 'Brandenburg Gate', coordinates: { latitude: 52.5163, longitude: 13.3777 } },
                { name: 'Acropolis of Athens', coordinates: { latitude: 37.9715, longitude: 23.7257 } },
                { name: 'Neuschwanstein Castle', coordinates: { latitude: 47.5576, longitude: 10.7498 } },
            ]
        },
        {
            name: 'Asia', isDefault: true,
            locations: [
                { name: 'Mount Fuji', coordinates: { latitude: 35.3606, longitude: 138.7274 } },
                { name: 'Angkor Wat', coordinates: { latitude: 13.4125, longitude: 103.8667 } },
                { name: 'Petronas Towers', coordinates: { latitude: 3.1579, longitude: 101.7123 } },
                { name: 'Forbidden City', coordinates: { latitude: 39.9163, longitude: 116.3972 } },
            ]
        },
        {
            name: 'Africa', isDefault: true,
            locations: [
                { name: 'Pyramids of Giza', coordinates: { latitude: 29.9792, longitude: 31.1342 } },
                { name: 'Victoria Falls', coordinates: { latitude: -17.9243, longitude: 25.8572 } },
                { name: 'Mount Kilimanjaro', coordinates: { latitude: -3.0674, longitude: 37.3556 } },
                { name: 'Table Mountain', coordinates: { latitude: -33.9626, longitude: 18.4098 } },
            ]
        },
        {
            name: 'Latin America', isDefault: true,
            locations: [
                { name: 'Chichen Itza', coordinates: { latitude: 20.6843, longitude: -88.5678 } },
                { name: 'Angel Falls', coordinates: { latitude: 5.9689, longitude: -62.5358 } },
                { name: 'Torres del Paine', coordinates: { latitude: -50.9423, longitude: -72.9866 } },
                { name: 'Galapagos Islands', coordinates: { latitude: -0.3371, longitude: -90.9661 } },
            ]
        },
        {
            name: 'Middle East', isDefault: true,
            locations: [
                { name: 'Burj Khalifa', coordinates: { latitude: 25.1972, longitude: 55.2744 } },
                { name: 'Hagia Sophia', coordinates: { latitude: 41.0086, longitude: 28.9802 } },
                { name: 'Western Wall', coordinates: { latitude: 31.7767, longitude: 35.2345 } },
                { name: 'The Kaaba', coordinates: { latitude: 21.4225, longitude: 39.8262 } },
            ]
        },
        {
            name: 'Oceania', isDefault: true,
            locations: [
                { name: 'Sydney Opera House', coordinates: { latitude: -33.8568, longitude: 151.2153 } },
                { name: 'Uluru', coordinates: { latitude: -25.3444, longitude: 131.0369 } },
                { name: 'Milford Sound', coordinates: { latitude: -44.6720, longitude: 167.9242 } },
                { name: 'Bora Bora', coordinates: { latitude: -16.5004, longitude: -151.7415 } },
            ]
        },
        {
            name: 'Arctic/Antarctic', isDefault: true,
            locations: [
                { name: 'McMurdo Station', coordinates: { latitude: -77.8463, longitude: 166.6682 } },
                { name: 'South Pole Telescope', coordinates: { latitude: -89.9911, longitude: -45.0000 } },
                { name: 'Svalbard Global Seed Vault', coordinates: { latitude: 78.2356, longitude: 15.4913 } },
                { name: 'Alert, Nunavut', coordinates: { latitude: 82.5018, longitude: -62.3481 } },
            ]
        },
    ];

    const batch = writeBatch(db);
    const q = query(collection(db, 'game_modes'), where('isDefault', '==', true));
    const existingModesSnapshot = await getDocs(q);
    const existingModeNames = new Set(existingModesSnapshot.docs.map(doc => doc.data().name));

    sampleGameModes.forEach(mode => {
        if (!existingModeNames.has(mode.name)) {
            const docRef = doc(collection(db, 'game_modes'));
            batch.set(docRef, mode);
        }
    });

    await batch.commit();
}
