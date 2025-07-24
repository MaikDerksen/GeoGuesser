
'use server';
/**
 * @fileOverview A flow for finding nearby locations for the game.
 * This flow first checks a Firestore cache for existing nearby locations.
 * If no suitable cache is found, it queries the Google Places API,
 * stores the results in the cache, and then uses an AI to curate a
 * final list for the game.
 *
 * - getNearbyLocations - A function that returns a curated list of nearby landmarks.
 * - GetNearbyLocationsInput - The input type for the getNearbyLocations function.
 * - GetNearbyLocationsOutput - The return type for the getNearbyLocations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { findLocationCache, saveLocationCache } from '@/lib/game-data';
import type { Location } from '@/lib/game-data';


// Define the schema for the raw response from the Google Places API
const PlaceSchema = z.object({
  displayName: z.object({
    text: z.string(),
  }),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

const PlacesApiResponseSchema = z.object({
  places: z.array(PlaceSchema).optional(),
  nextPageToken: z.string().nullable().optional(),
});

// Define the schema for the AI's input, which includes the raw places data
const AiCurationInputSchema = z.object({
  places: z.string().describe("A JSON string containing a list of potential places from the Google Places API."),
  count: z.number().describe("The number of locations to select."),
});


const GetNearbyLocationsInputSchema = z.object({
    latitude: z.number().describe('The latitude of the user.'),
    longitude: z.number().describe('The longitude of the user.'),
    radius: z.number().min(1).max(50).describe('The search radius in kilometers.'),
    categories: z.array(z.string()).describe('A list of categories to include in the search (e.g., "restaurant", "tourist_attraction").'),
    count: z.number().describe("The number of locations the game needs."),
});
export type GetNearbyLocationsInput = z.infer<typeof GetNearbyLocationsInputSchema>;

const LocationSchema = z.object({
    name: z.string().describe('The name of the landmark.'),
    coordinates: z.object({
        latitude: z.number().describe('The latitude of the landmark.'),
        longitude: z.number().describe('The longitude of the landmark.'),
    }),
});

const GetNearbyLocationsOutputSchema = z.object({
    curatedLocations: z.array(LocationSchema),
    rawApiResponse: z.any(), // To store the full API response for logging
});
export type GetNearbyLocationsOutput = z.infer<typeof GetNearbyLocationsOutputSchema>;


export async function getNearbyLocations(input: GetNearbyLocationsInput): Promise<GetNearbyLocationsOutput> {
    return getNearbyLocationsFlow(input);
}


const prompt = ai.definePrompt({
    name: 'curateNearbyLocationsPrompt',
    input: { schema: AiCurationInputSchema },
    output: { schema: z.array(LocationSchema) },
    prompt: `You are a virtual tour guide creating a fun location-guessing game.
    You have been given a list of real-world places from the Google Places API.
    
    Your task is to select the best {{{count}}} locations from this list to create a fun and varied game.
    Choose a mix of well-known landmarks and interesting local businesses.
    Ensure every location in your final list is unique.
    
    Here is the list of available places:
    {{{places}}}
    
    Return your final list as a valid JSON array of objects, where each object has a "name" and "coordinates" (with "latitude" and "longitude").
    Do not include any other text or explanations in your response.`,
});

// Main flow that orchestrates the API call and AI curation
const getNearbyLocationsFlow = ai.defineFlow(
    {
        name: 'getNearbyLocationsFlow',
        inputSchema: GetNearbyLocationsInputSchema,
        outputSchema: GetNearbyLocationsOutputSchema,
    },
    async (input) => {
        let placesFromApi: Location[] = [];
        let rawApiResponse: any = { source: 'API', pages: [] }; // Default to API source
        const searchRadiusMeters = input.radius * 1000;
        const MAX_PAGES = 3; // Safety cap to avoid excessive API calls

        // 1. Check for a cached set of locations first
        const cachedData = await findLocationCache(input.latitude, input.longitude, searchRadiusMeters);
        
        if (cachedData && cachedData.locations.length >= input.count) {
             console.log(`Cache hit! Using ${cachedData.locations.length} locations from cache ID ${cachedData.id}`);
             placesFromApi = cachedData.locations;
             rawApiResponse.source = 'cache';
             rawApiResponse.cacheId = cachedData.id;
             // Convert cached locations to a format similar to the API response for consistent logging
             const cachedPlaces = cachedData.locations.map(loc => ({
                displayName: { text: loc.name },
                location: { latitude: loc.coordinates.latitude, longitude: loc.coordinates.longitude }
             }));
             rawApiResponse.pages.push({ places: cachedPlaces });


        } else {
             console.log("Cache miss. Calling Google Places API.");
            // 2. If no cache, call Google Places API with pagination
            const apiKey = process.env.GOOGLE_PLACES_KEY;
            if (!apiKey) {
                throw new Error("Google Places API key is missing. Please set GOOGLE_PLACES_KEY in your .env file.");
            }

            let currentPage = 0;
            let nextPageToken: string | null | undefined = undefined;

            const initialRequestBody: any = {
                includedTypes: input.categories,
                maxResultCount: 20, // Max per page
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: input.latitude,
                            longitude: input.longitude,
                        },
                        radius: searchRadiusMeters,
                    },
                },
            };

            do {
                currentPage++;
                let requestBody: any;
                if (nextPageToken) {
                    // For subsequent pages, only send the pageToken.
                    requestBody = { pageToken: nextPageToken };
                } else {
                    // For the first page, send the full query.
                    requestBody = initialRequestBody;
                }

                const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': 'places.displayName,places.location,nextPageToken',
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!placesResponse.ok) {
                    const errorBody = await placesResponse.text();
                    throw new Error(`Failed to fetch from Places API (Page ${currentPage}): ${placesResponse.statusText} - ${errorBody}`);
                }

                const pageData = await placesResponse.json();
                rawApiResponse.pages.push(pageData); // Store raw response for each page
                const parsedPage = PlacesApiResponseSchema.parse(pageData);
                
                if (parsedPage.places && parsedPage.places.length > 0) {
                     const pageLocations = parsedPage.places.map(p => ({
                        name: p.displayName.text,
                        coordinates: {
                            latitude: p.location.latitude,
                            longitude: p.location.longitude
                        }
                    }));
                    placesFromApi.push(...pageLocations);
                }
                
                nextPageToken = parsedPage.nextPageToken;

                // Wait briefly before fetching the next page as recommended by Google
                if (nextPageToken) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } while (nextPageToken && currentPage < MAX_PAGES);
            
            console.log(`Fetched a total of ${placesFromApi.length} locations over ${currentPage} page(s).`);


            if (placesFromApi.length === 0) {
                return { curatedLocations: [], rawApiResponse };
            }

            // 3. Save the new results to the cache
            if(placesFromApi.length > 0) {
                 const newCacheId = await saveLocationCache({
                    center: { latitude: input.latitude, longitude: input.longitude },
                    radius: searchRadiusMeters,
                    locations: placesFromApi,
                 });
                 console.log(`Saved ${placesFromApi.length} locations to new cache ID ${newCacheId}`);
                 rawApiResponse.newCacheId = newCacheId;
            }
        }
        
        // 4. Pass the results (from cache or API) to the AI for curation
        const aiCurationInput = {
            places: JSON.stringify(placesFromApi),
            count: input.count,
        };

        const { output } = await prompt(aiCurationInput);
        
        return {
            curatedLocations: output || [],
            rawApiResponse: rawApiResponse,
        };
    }
);
