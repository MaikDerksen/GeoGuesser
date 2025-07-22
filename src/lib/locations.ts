export interface Location {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export const locations: Location[] = [
  { name: "Eiffel Tower", coordinates: { latitude: 48.8584, longitude: 2.2945 } },
  { name: "Statue of Liberty", coordinates: { latitude: 40.6892, longitude: -74.0445 } },
  { name: "Great Wall of China", coordinates: { latitude: 40.4319, longitude: 116.5704 } },
  { name: "Taj Mahal", coordinates: { latitude: 27.1751, longitude: 78.0421 } },
  { name: "Sydney Opera House", coordinates: { latitude: -33.8568, longitude: 151.2153 } },
  { name: "Pyramids of Giza", coordinates: { latitude: 29.9792, longitude: 31.1342 } },
  { name: "Colosseum", coordinates: { latitude: 41.8902, longitude: 12.4922 } },
  { name: "Machu Picchu", coordinates: { latitude: -13.1631, longitude: -72.5450 } },
];
