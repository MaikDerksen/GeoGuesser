export interface Location {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export const locationsWorld: Location[] = [
  { name: "Eiffel Tower", coordinates: { latitude: 48.8584, longitude: 2.2945 } },
  { name: "Statue of Liberty", coordinates: { latitude: 40.6892, longitude: -74.0445 } },
  { name: "Great Wall of China", coordinates: { latitude: 40.4319, longitude: 116.5704 } },
  { name: "Taj Mahal", coordinates: { latitude: 27.1751, longitude: 78.0421 } },
  { name: "Sydney Opera House", coordinates: { latitude: -33.8568, longitude: 151.2153 } },
  { name: "Pyramids of Giza", coordinates: { latitude: 29.9792, longitude: 31.1342 } },
  { name: "Colosseum", coordinates: { latitude: 41.8902, longitude: 12.4922 } },
  { name: "Machu Picchu", coordinates: { latitude: -13.1631, longitude: -72.5450 } },
];


export const locationsUsa: Location[] = [
    { name: "Statue of Liberty", coordinates: { latitude: 40.6892, longitude: -74.0445 } },
    { name: "Golden Gate Bridge", coordinates: { latitude: 37.8199, longitude: -122.4783 } },
    { name: "The White House", coordinates: { latitude: 38.8977, longitude: -77.0365 } },
    { name: "Mount Rushmore", coordinates: { latitude: 43.8791, longitude: -103.4591 } },
    { name: "Grand Canyon", coordinates: { latitude: 36.1069, longitude: -112.1129 } },
    { name: "Hollywood Sign", coordinates: { latitude: 34.1341, longitude: -118.3215 } },
    { name: "Space Needle", coordinates: { latitude: 47.6205, longitude: -122.3493 } },
];

export const locationsEu: Location[] = [
    { name: "Eiffel Tower", coordinates: { latitude: 48.8584, longitude: 2.2945 } },
    { name: "Colosseum", coordinates: { latitude: 41.8902, longitude: 12.4922 } },
    { name: "Brandenburg Gate", coordinates: { latitude: 52.5163, longitude: 13.3777 } },
    { name: "Acropolis of Athens", coordinates: { latitude: 37.9715, longitude: 23.7257 } },
    { name: "Sagrada Família", coordinates: { latitude: 41.4036, longitude: 2.1744 } },
    { name: "Stonehenge", coordinates: { latitude: 51.1789, longitude: -1.8262 } },
    { name: "St. Peter's Basilica", coordinates: { latitude: 41.9022, longitude: 12.4539 } },
];

export const locationsAsia: Location[] = [
    { name: "Great Wall of China", coordinates: { latitude: 40.4319, longitude: 116.5704 } },
    { name: "Taj Mahal", coordinates: { latitude: 27.1751, longitude: 78.0421 } },
    { name: "Fushimi Inari Shrine", coordinates: { latitude: 34.9671, longitude: 135.7727 } },
    { name: "Burj Khalifa", coordinates: { latitude: 25.1972, longitude: 55.2744 } },
    { name: "Angkor Wat", coordinates: { latitude: 13.4125, longitude: 103.8667 } },
    { name: "Mount Fuji", coordinates: { latitude: 35.3606, longitude: 138.7274 } },
    { name: "The Grand Palace", coordinates: { latitude: 13.7500, longitude: 100.4911 } },
];

export const locationPacks = {
    USA: locationsUsa,
    EU: locationsEu,
    ASIA: locationsAsia,
    WORLD: locationsWorld,
}
