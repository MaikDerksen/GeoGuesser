
'use server';
/**
 * @fileOverview A flow for finding nearby locations for the game.
 * 
 * - getNearbyLocations - A function that returns a list of nearby landmarks.
 * - GetNearbyLocationsInput - The input type for the getNearbyLocations function.
 * - GetNearbyLocationsOutput - The return type for the getNearbyLocations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Location } from '@/lib/locations';

const GetNearbyLocationsInputSchema = z.object({
    latitude: z.number().describe('The latitude of the user.'),
    longitude: z.number().describe('The longitude of the user.'),
});
export type GetNearbyLocationsInput = z.infer<typeof GetNearbyLocationsInputSchema>;

const LocationSchema = z.object({
    name: z.string().describe('The name of the landmark.'),
    coordinates: z.object({
        latitude: z.number().describe('The latitude of the landmark.'),
        longitude: z.number().describe('The longitude of the landmark.'),
    }),
});

const GetNearbyLocationsOutputSchema = z.array(LocationSchema);
export type GetNearbyLocationsOutput = z.infer<typeof GetNearbyLocationsOutputSchema>;


export async function getNearbyLocations(input: GetNearbyLocationsInput): Promise<GetNearbyLocationsOutput> {
    return getNearbyLocationsFlow(input);
}


const prompt = ai.definePrompt({
    name: 'getNearbyLocationsPrompt',
    input: { schema: GetNearbyLocationsInputSchema },
    output: { schema: GetNearbyLocationsOutputSchema },
    prompt: `You are a virtual tour guide integrated into a location-guessing game.
    A user has provided their current coordinates: latitude {{{latitude}}} and longitude {{{longitude}}}.
    
    Your task is to generate a list of 7 well-known and interesting landmarks or points of interest that are reasonably close to the user's location.
    The locations should be diverse and recognizable. Avoid obscure places.
    
    Return the list as a valid JSON array of objects, where each object has a "name" and "coordinates" (with "latitude" and "longitude").
    Do not include any other text or explanations in your response.`,
});


const getNearbyLocationsFlow = ai.defineFlow(
    {
        name: 'getNearbyLocationsFlow',
        inputSchema: GetNearbyLocationsInputSchema,
        outputSchema: GetNearbyLocationsOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output || [];
    }
);
