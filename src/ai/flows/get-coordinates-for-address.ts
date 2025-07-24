
'use server';
/**
 * @fileOverview A flow for getting the coordinates of a given address string or place ID.
 * This uses the Google Places API (Geocoding).
 *
 * - getCoordinatesForAddress - A function that returns the lat/lng for an address or place ID.
 * - GetCoordinatesForAddressInput - The input type for the function.
 * - GetCoordinatesForAddressOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetCoordinatesForAddressInputSchema = z.object({
    address: z.string().optional(),
    placeId: z.string().optional(),
}).describe('The address or place ID to geocode. Provide one or the other.');
export type GetCoordinatesForAddressInput = z.infer<typeof GetCoordinatesForAddressInputSchema>;

const GetCoordinatesForAddressOutputSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});
export type GetCoordinatesForAddressOutput = z.infer<typeof GetCoordinatesForAddressOutputSchema>;

export async function getCoordinatesForAddress(input: GetCoordinatesForAddressInput): Promise<GetCoordinatesForAddressOutput | null> {
    return getCoordinatesForAddressFlow(input);
}

const getCoordinatesForAddressFlow = ai.defineFlow(
    {
        name: 'getCoordinatesForAddressFlow',
        inputSchema: GetCoordinatesForAddressInputSchema,
        outputSchema: z.nullable(GetCoordinatesForAddressOutputSchema),
    },
    async (input) => {
        const apiKey = process.env.GOOGLE_PLACES_KEY;
        if (!apiKey) {
            throw new Error("Google Places API key is missing. Please set GOOGLE_PLACES_KEY in your .env file.");
        }

        const params = new URLSearchParams({ key: apiKey });
        if (input.placeId) {
            params.append('place_id', input.placeId);
        } else if (input.address) {
            params.append('address', input.address);
        } else {
            throw new Error("Either address or placeId must be provided.");
        }


        const geocodeResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);

        if (!geocodeResponse.ok) {
            const errorBody = await geocodeResponse.text();
            throw new Error(`Failed to fetch from Geocoding API: ${geocodeResponse.statusText} - ${errorBody}`);
        }

        const data = await geocodeResponse.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.error('Geocoding failed:', data.status, data.error_message);
            return null;
        }

        const location = data.results[0].geometry.location; // lat, lng

        return {
            latitude: location.lat,
            longitude: location.lng,
        };
    }
);
