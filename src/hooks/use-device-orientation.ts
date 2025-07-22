"use client";

import { useState, useEffect, useCallback } from 'react';

type DeviceOrientation = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  webkitCompassHeading?: number;
};

type DeviceOrientationState = {
  orientation: DeviceOrientation | null;
  error: Error | null;
  requestPermission: () => Promise<"granted" | "denied">;
  permissionState: PermissionState | 'not-supported';
};

export function useDeviceOrientation(): DeviceOrientationState {
  const [error, setError] = useState<Error | null>(null);
  const [orientation, setOrientation] = useState<DeviceOrientation | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | 'not-supported'>('prompt');

  const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    setOrientation(event as DeviceOrientation);
  };
  
  useEffect(() => {
    if (permissionState === 'granted') {
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    };
  }, [permissionState]);

  const requestPermission = useCallback(async (): Promise<"granted" | "denied"> => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const status = await (DeviceOrientationEvent as any).requestPermission();
        setPermissionState(status);
        return status;
      } catch (err) {
        setError(err as Error);
        setPermissionState('denied');
        return 'denied';
      }
    } else {
      setPermissionState('granted');
      return 'granted';
    }
  }, []);

  useEffect(() => {
    if (typeof window.DeviceOrientationEvent === 'undefined') {
        setPermissionState('not-supported');
        setError(new Error('Device orientation not supported'));
    } else if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
        setPermissionState('granted');
    }
  }, [])

  return { orientation, error, requestPermission, permissionState };
}
