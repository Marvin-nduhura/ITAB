import { useState, useCallback } from 'react';

export type GeoStatus = 'idle' | 'loading' | 'success' | 'denied' | 'unavailable' | 'timeout';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;       // metres
  address?: string;       // reverse-geocoded via Google Maps
}

export interface UseGeolocationReturn {
  position: GeoPosition | null;
  status: GeoStatus;
  error: string | null;
  getLocation: () => void;
  clearLocation: () => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Reverse-geocode using Google Maps Geocoding API
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (!GOOGLE_MAPS_API_KEY) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setError('Geolocation is not supported by your browser or device.');
      return;
    }

    setStatus('loading');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const address = await reverseGeocode(lat, lng);
        setPosition({ lat, lng, accuracy, address });
        setStatus('success');
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus('denied');
            setError('Location access was denied. Please allow location access in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus('unavailable');
            setError('Location information is unavailable. Try again or enter manually.');
            break;
          case err.TIMEOUT:
            setStatus('timeout');
            setError('Location request timed out. Please try again.');
            break;
          default:
            setStatus('unavailable');
            setError('An unknown error occurred while getting your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setPosition(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { position, status, error, getLocation, clearLocation };
}
