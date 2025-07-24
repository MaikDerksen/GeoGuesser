
'use server';
/**
 * @fileOverview A flow for getting Place Autocomplete predictions.
 * This uses the Google Places API (Autocomplete).
 *
 * - getAddressPredictions - A function that returns address suggestions.
 * - GetAddressPredictionsInput - The input type for the function.
 * - GetAddressPredictionsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetAddressPredictionsInputSchema = z.string().describe('The partial address input from the user.');
export type GetAddressPredictionsInput = z.infer<typeof GetAddressPredictionsInputSchema>;

const PredictionSchema = z.object({
    description: z.string(),
    place_id: z.string(),
});

const GetAddressPredictionsOutputSchema = z.array(PredictionSchema);
export type GetAddressPredictionsOutput = z.infer<typeof GetAddressPredictionsOutputSchema>;

export async function getAddressPredictions(input: GetAddressPredictionsInput): Promise<GetAddressPredictionsOutput> {
    return getAddressPredictionsFlow(input);
}

const getAddressPredictionsFlow = ai.defineFlow(
    {
        name: 'getAddressPredictionsFlow',
        inputSchema: GetAddressPredictionsInputSchema,
        outputSchema: GetAddressPredictionsOutputSchema,
    },
    async (input) => {
        if (!input) {
            return [];
        }

        const apiKey = process.env.GOOGLE_PLACES_KEY;
        if (!apiKey) {
            throw new Error("Google Places API key is missing. Please set GOOGLE_PLACES_KEY in your .env file.");
        }

        const params = new URLSearchParams({
            input: input,
            key: apiKey,
        });

        const autocompleteResponse = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
        
        if (!autocompleteResponse.ok) {
            const errorBody = await autocompleteResponse.text();
            throw new Error(`Failed to fetch from Place Autocomplete API: ${autocompleteResponse.statusText} - ${errorBody}`);
        }

        const data = await autocompleteResponse.json();

        if (data.status !== 'OK') {
             if (data.status === 'ZERO_RESULTS') {
                return [];
            }
            console.error('Place Autocomplete failed:', data.status, data.error_message);
            throw new Error(`Place Autocomplete API Error: ${data.status} ${data.error_message || ''}`);
        }

        return data.predictions.map((p: any) => ({
            description: p.description,
            place_id: p.place_id,
        }));
    }
);
