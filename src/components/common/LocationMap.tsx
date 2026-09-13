import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { clsx } from 'clsx';
import { formatCoordinates } from '@/utils/formatters';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  label?: string;
  className?: string;
}

function RecenterMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [map, latitude, longitude]);

  return null;
}

export function hasValidCoordinates(latitude?: number, longitude?: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude as number) >= -90 &&
    (latitude as number) <= 90 &&
    (longitude as number) >= -180 &&
    (longitude as number) <= 180
  );
}

export function LocationMap({ latitude, longitude, label, className }: LocationMapProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const position: [number, number] = [latitude, longitude];

  if (!isReady) {
    return (
      <div
        className={clsx(
          'h-72 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800',
          className,
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        'location-map overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700',
        className,
      )}
    >
      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom
        className="h-72 w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap latitude={latitude} longitude={longitude} />
        <CircleMarker
          center={position}
          radius={11}
          pathOptions={{
            color: '#1e3a8a',
            fillColor: '#2563eb',
            fillOpacity: 0.95,
            weight: 3,
          }}
        >
          <Popup>
            <div className="space-y-1 text-gray-800">
              {label && <p className="text-sm font-semibold">{label}</p>}
              <p className="font-mono text-xs">{formatCoordinates(latitude, longitude)}</p>
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
