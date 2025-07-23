
'use server';
/**
 * @fileOverview A flow for finding nearby locations for the game.
 * This flow first queries the Google Places API for a list of nearby locations
 * and then uses an AI to curate a final list for the game.
 *
 * - getNearbyLocations - A function that returns a curated list of nearby landmarks.
 * - GetNearbyLocationsInput - The input type for the getNearbyLocations function.
 * - GetNearbyLocationsOutput - The return type for the getNearbyLocations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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
        // 1. Call Google Places API
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) {
            throw new Error("Google API key is missing.");
        }

        const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.location',
            },
            body: JSON.stringify({
                includedTypes: input.categories,
                maxResultCount: 20, // Fetch more than needed to allow for curation
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: input.latitude,
                            longitude: input.longitude,
                        },
                        radius: input.radius * 1000, // Convert km to meters
                    },
                },
            }),
        });

        if (!placesResponse.ok) {
            const errorBody = await placesResponse.text();
            throw new Error(`Failed to fetch from Places API: ${placesResponse.statusText} - ${errorBody}`);
        }

        const rawApiResponse = await placesResponse.json();
        const parsedPlaces = PlacesApiResponseSchema.parse(rawApiResponse);

        if (!parsedPlaces.places || parsedPlaces.places.length === 0) {
            return { curatedLocations: [], rawApiResponse };
        }
        
        // 2. Pass the results to the AI for curation
        const aiCurationInput = {
            places: JSON.stringify(parsedPlaces.places),
            count: input.count,
        };

        const { output } = await prompt(aiCurationInput);
        
        return {
            curatedLocations: output || [],
            rawApiResponse: rawApiResponse,
        };
    }
);
