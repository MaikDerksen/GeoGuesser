
'use server';
/**
 * @fileOverview A flow for getting the coordinates of a given address string.
 * This uses the Google Places API (Geocoding).
 *
 * - getCoordinatesForAddress - A function that returns the lat/lng for an address.
 * - GetCoordinatesForAddressInput - The input type for the function.
 * - GetCoordinatesForAddressOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetCoordinatesForAddressInputSchema = z.string().describe('The address to geocode.');
export type GetCoordinatesForAddressInput = z.infer<typeof GetCoordinatesForAddressInputSchema>;

const GetCoordinatesForAddressOutputSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});
export type GetCoordinatesForAddressOutput = z.infer<typeof GetCoordinatesForAddressOutputSchema>;

export async function getCoordinatesForAddress(address: GetCoordinatesForAddressInput): Promise<GetCoordinatesForAddressOutput | null> {
    return getCoordinatesForAddressFlow(address);
}

const getCoordinatesForAddressFlow = ai.defineFlow(
    {
        name: 'getCoordinatesForAddressFlow',
        inputSchema: GetCoordinatesForAddressInputSchema,
        outputSchema: z.nullable(GetCoordinatesForAddressOutputSchema),
    },
    async (address) => {
        const apiKey = process.env.GOOGLE_PLACES_KEY;
        if (!apiKey) {
            throw new Error("Google Places API key is missing. Please set GOOGLE_PLACES_KEY in your .env file.");
        }

        const params = new URLSearchParams({
            address: address,
            key: apiKey,
        });

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
