import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Crosshair, Loader2, CheckCircle2, AlertCircle, X, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Button } from './Button';
import { cn } from '../../lib/utils';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom pulsing "you are here" icon
const youAreHereIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:24px;height:24px">
    <div style="position:absolute;inset:0;background:#2563eb;border-radius:50%;opacity:0.25;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
    <div style="position:absolute;inset:4px;background:#2563eb;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.5)"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Sub-component: fly map to new position
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 17, { duration: 1.2 }); }, [lat, lng]);
  return null;
}

// Sub-component: click on map to move pin
function ClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMove(e.latlng.lat, e.latlng.lng) });
  return null;
}

export interface LocationValue {
  lat: number;
  lng: number;
  address: string;
  accuracy?: number;
}

interface LocationPickerProps {
  value?: LocationValue | null;
  onChange: (loc: LocationValue) => void;
  onClear?: () => void;
  label?: string;
  hint?: string;
  className?: string;
  compact?: boolean;   // smaller inline version
}

export function LocationPicker({
  value, onChange, onClear, label = 'Location', hint, className, compact = false,
}: LocationPickerProps) {
  const { position, status, error, getLocation, clearLocation } = useGeolocation();
  const [showMap, setShowMap] = useState(false);
  const [pinLat, setPinLat] = useState<number>(value?.lat ?? 0.3476);
  const [pinLng, setPinLng] = useState<number>(value?.lng ?? 32.5825);
  const [pinAddress, setPinAddress] = useState<string>(value?.address ?? '');
  const [reverseLoading, setReverseLoading] = useState(false);

  // When GPS succeeds, move pin there
  useEffect(() => {
    if (position && status === 'success') {
      setPinLat(position.lat);
      setPinLng(position.lng);
      setPinAddress(position.address ?? '');
    }
  }, [position, status]);

  // Reverse geocode when pin is moved manually on map
  const handlePinMove = async (lat: number, lng: number) => {
    setPinLat(lat);
    setPinLng(lng);
    setReverseLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const a = data.address || {};
      const parts = [a.road || a.pedestrian, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean);
      setPinAddress(parts.join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setPinAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setReverseLoading(false);
    }
  };

  const handleConfirm = () => {
    onChange({ lat: pinLat, lng: pinLng, address: pinAddress, accuracy: position?.accuracy });
    setShowMap(false);
  };

  const handleClear = () => {
    clearLocation();
    setPinAddress('');
    onClear?.();
  };

  const isLocated = !!value;

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger button / current value display */}
      <div className={cn(
        'flex items-center gap-2 rounded-xl border transition-all',
        isLocated
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800',
        compact ? 'p-2' : 'p-3'
      )}>
        <div className={cn('flex-shrink-0 rounded-lg flex items-center justify-center',
          compact ? 'w-8 h-8' : 'w-10 h-10',
          isLocated ? 'bg-green-100 dark:bg-green-900/40' : 'bg-slate-100 dark:bg-slate-700'
        )}>
          {status === 'loading'
            ? <Loader2 size={compact ? 16 : 18} className="animate-spin text-primary-600" />
            : isLocated
              ? <CheckCircle2 size={compact ? 16 : 18} className="text-green-600" />
              : <MapPin size={compact ? 16 : 18} className="text-slate-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {isLocated ? (
            <>
              <p className={cn('font-medium text-green-800 dark:text-green-300 truncate', compact ? 'text-xs' : 'text-sm')}>
                {value.address || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
              </p>
              {!compact && value.accuracy && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  ±{Math.round(value.accuracy)}m accuracy
                </p>
              )}
            </>
          ) : (
            <p className={cn('text-slate-400', compact ? 'text-xs' : 'text-sm')}>
              {status === 'loading' ? 'Getting your location…' : 'No location set'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* GPS button */}
          <button
            type="button"
            onClick={getLocation}
            disabled={status === 'loading'}
            title="Use my current location"
            className={cn(
              'flex items-center gap-1.5 rounded-lg font-medium transition-all',
              compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
              'bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50'
            )}
          >
            {status === 'loading'
              ? <Loader2 size={12} className="animate-spin" />
              : <Navigation size={12} />
            }
            {!compact && <span>Use GPS</span>}
          </button>

          {/* Pick on map */}
          <button
            type="button"
            onClick={() => setShowMap(true)}
            title="Pick on map"
            className={cn(
              'flex items-center gap-1.5 rounded-lg font-medium transition-all border',
              compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
              'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            )}
          >
            <MapPin size={12} />
            {!compact && <span>Map</span>}
          </button>

          {/* Clear */}
          {isLocated && (
            <button type="button" onClick={handleClear} title="Clear location"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {hint && !error && (
        <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      )}

      {/* Map picker modal */}
      <AnimatePresence>
        {showMap && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowMap(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Pick Location on Map</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Tap anywhere on the map to place the pin, or use GPS</p>
                </div>
                <button onClick={() => setShowMap(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>

              {/* GPS bar */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <button
                  type="button"
                  onClick={getLocation}
                  disabled={status === 'loading'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {status === 'loading'
                    ? <><Loader2 size={14} className="animate-spin" /> Getting location…</>
                    : <><Crosshair size={14} /> Use My Current Location</>
                  }
                </button>
                {status === 'success' && position && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Located (±{Math.round(position.accuracy)}m)
                  </span>
                )}
                {error && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                  </span>
                )}
              </div>

              {/* Map */}
              <div className="h-80">
                <MapContainer
                  center={[pinLat || 0.3476, pinLng || 32.5825]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <ClickHandler onMove={handlePinMove} />
                  {(pinLat && pinLng) && (
                    <>
                      <Marker position={[pinLat, pinLng]} icon={youAreHereIcon} />
                      <FlyTo lat={pinLat} lng={pinLng} />
                    </>
                  )}
                </MapContainer>
              </div>

              {/* Address preview */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-primary-600 flex-shrink-0" />
                  {reverseLoading
                    ? <span className="text-xs text-slate-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Looking up address…</span>
                    : <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{pinAddress || 'Tap the map to select a location'}</span>
                  }
                </div>
                {pinLat && pinLng && (
                  <p className="text-xs text-slate-400 mt-0.5 ml-5">
                    {pinLat.toFixed(6)}, {pinLng.toFixed(6)}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
                <Button variant="secondary" onClick={() => setShowMap(false)}>Cancel</Button>
                <Button onClick={handleConfirm} disabled={!pinLat || !pinLng} icon={<CheckCircle2 size={15} />}>
                  Confirm Location
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
