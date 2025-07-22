"use client";

import { useState, useCallback } from 'react';

type GeolocationState = {
  loading: boolean;
  error: GeolocationPositionError | null;
  data: GeolocationCoordinates | null;
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    data: null,
  });

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const error: GeolocationPositionError = {
          code: 0,
          message: "Geolocation is not supported by your browser.",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
      };
      setState(s => ({ ...s, error }));
      return;
    }

    setState({ loading: true, error: null, data: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          loading: false,
          error: null,
          data: position.coords,
        });
      },
      (error) => {
        setState({
          loading: false,
          error,
          data: null,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  return { ...state, getLocation };
}
