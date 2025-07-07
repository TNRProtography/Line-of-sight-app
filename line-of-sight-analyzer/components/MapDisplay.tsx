
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup } from 'react-leaflet';
import { LatLng, LatLngBounds, divIcon } from 'leaflet';
import { Map, Globe } from 'lucide-react';
import type { ConstraintPoint } from '../types';

interface MapDisplayProps {
    points: [LatLng | null, LatLng | null];
    onMapClick: (latlng: LatLng) => void;
    hoveredLatLng: LatLng | null;
    onHover: (distance: number | null) => void;
    onMarkerDrag: (index: 0 | 1, latlng: LatLng) => void;
    constraintSegments: ConstraintPoint[][];
}

const MapEventsHandler: React.FC<{ onMapClick: (latlng: LatLng) => void }> = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
};

const pulsingIcon = divIcon({
    className: 'pulsing-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

const CONSTRAINT_COLORS: Record<ConstraintPoint['type'], string> = {
    clearance: '#facc15', // yellow-400
    obstruction: '#ef4444', // red-500
    severe_obstruction: '#a855f7', // purple-500
};

const getSegmentPopupInfo = (segment: ConstraintPoint[]): { title: string; message: string } => {
    if (segment.length === 0) return { title: '', message: '' };

    const values = segment.map(p => p.value);
    const minVal = Math.min(...values);
    const type = segment[0].type;

    switch(type) {
        case 'severe_obstruction': {
            const maxObstruction = Math.abs(minVal).toFixed(1);
            return {
                title: 'Path Severely Obstructed',
                message: `The path is blocked by up to ${maxObstruction}m.`
            };
        }
        case 'obstruction': {
            const maxObstruction = Math.abs(minVal).toFixed(1);
            return {
                title: 'Path Obstructed',
                message: `The path is blocked by up to ${maxObstruction}m.`
            };
        }
        case 'clearance':
            return {
                title: 'Tight Clearance',
                message: `Minimum clearance is only ${minVal.toFixed(1)}m.`
            };
        default:
             return { title: 'Constraint Info', message: 'Details about this path segment.' };
    }
};

const MapDisplay: React.FC<MapDisplayProps> = ({ points, onMapClick, hoveredLatLng, onHover, onMarkerDrag, constraintSegments }) => {
    const [basemap, setBasemap] = useState<'topo' | 'satellite'>('topo');

    const westCoastCenter = new LatLng(-42.715, 170.965); // Centered around Hokitika on the West Coast
    const nzBounds = new LatLngBounds(
        new LatLng(-47.3, 166.4), // Southwest
        new LatLng(-34.4, 178.6)  // Northeast
    );

    const position: LatLng = points[0] || westCoastCenter;
    const zoom = points[0] ? 9 : 8;
    const linePathColor = basemap === 'satellite' ? '#38bdf8' : '#0284c7'; // Brighter blue for satellite

    return (
        <MapContainer 
            center={position} 
            zoom={zoom} 
            scrollWheelZoom={true}
            maxBounds={nzBounds}
            minZoom={5}
        >
             <div className="absolute top-2 right-2 z-[1000] bg-slate-800/80 p-1 rounded-md border border-slate-600 shadow-lg flex">
                <button 
                    onClick={() => setBasemap('topo')} 
                    className={`p-2 rounded-l-md transition-colors ${basemap === 'topo' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    aria-label="Topographic Map"
                    title="Topographic Map"
                >
                    <Map size={18} />
                </button>
                <button 
                    onClick={() => setBasemap('satellite')} 
                    className={`p-2 rounded-r-md transition-colors ${basemap === 'satellite' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    aria-label="Satellite Map"
                    title="Satellite Map"
                >
                    <Globe size={18} />
                </button>
            </div>

            {basemap === 'topo' ? (
                <TileLayer
                    attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org/dem3.html">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                />
            ) : (
                <TileLayer
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={18}
                />
            )}
            
            <MapEventsHandler onMapClick={onMapClick} />

            {points[0] && <Marker 
                position={points[0]} 
                draggable={true}
                eventHandlers={{
                    dragend: (e) => onMarkerDrag(0, e.target.getLatLng()),
                }}
            />}
            {points[1] && <Marker 
                position={points[1]} 
                draggable={true}
                eventHandlers={{
                    dragend: (e) => onMarkerDrag(1, e.target.getLatLng()),
                }}
            />}

            {points[0] && points[1] && (
                <Polyline 
                    positions={[points[0], points[1]]} 
                    color={linePathColor}
                    weight={3}
                    eventHandlers={{
                        mousemove: (e) => {
                            if (points[0]) {
                                const distance = points[0].distanceTo(e.latlng);
                                onHover(distance);
                            }
                        },
                        mouseout: () => {
                            onHover(null);
                        }
                    }} 
                />
            )}
            
            {constraintSegments.map((segment, index) => {
                if (segment.length < 2) return null;

                const latlngs = segment.map(p => p.latlng);
                const { title, message } = getSegmentPopupInfo(segment);
                const color = CONSTRAINT_COLORS[segment[0].type];

                return (
                    <Polyline
                        key={`constraint-segment-${index}`}
                        positions={latlngs}
                        pathOptions={{
                            color: color,
                            weight: 8,
                            opacity: 0.7,
                        }}
                    >
                        <Popup>
                            <div className="text-slate-800">
                                <strong className="font-bold">{title}</strong><br/>
                                {message}
                            </div>
                        </Popup>
                    </Polyline>
                );
            })}

            {hoveredLatLng && (
                 <Marker
                    position={hoveredLatLng}
                    icon={pulsingIcon}
                    interactive={false}
                />
            )}
        </MapContainer>
    );
};

export default MapDisplay;
