import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, useMap } from 'react-leaflet';
import { LatLng, LatLngBounds, divIcon } from 'leaflet';
import { Map, Globe } from 'lucide-react';
import type { ConstraintPoint } from '../types';

// Prop definition for the component
interface MapDisplayProps {
    points: [LatLng | null, LatLng | null];
    onMapClick: (latlng: LatLng) => void;
    onMarkerDrag: (index: 0 | 1, latlng: LatLng) => void;
    constraintSegments: ConstraintPoint[][];
}

// ================== FIX: THE RESIZE HANDLER ==================
// This uses the ResizeObserver to definitively solve the patchy map issue.
function ResizeHandler() {
    const map = useMap();
    useEffect(() => {
        const container = map.getContainer();
        const observer = new ResizeObserver(() => {
            map.invalidateSize();
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
        };
    }, [map]);
    return null;
}

// ================== FIX: THE MAP EVENTS HANDLER ==================
// This is the correct way to handle map events like clicks.
const MapEventsHandler: React.FC<{ onMapClick: (latlng: LatLng) => void }> = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null; // This component doesn't render anything itself.
};


// --- Helper Constants and Functions ---

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
        case 'severe_obstruction': return { title: 'Path Severely Obstructed', message: `The path is blocked by up to ${Math.abs(minVal).toFixed(1)}m.` };
        case 'obstruction': return { title: 'Path Obstructed', message: `The path is blocked by up to ${Math.abs(minVal).toFixed(1)}m.` };
        case 'clearance': return { title: 'Tight Clearance', message: `Minimum clearance is only ${minVal.toFixed(1)}m.` };
        default: return { title: 'Constraint Info', message: 'Details about this path segment.' };
    }
};


// --- The Main MapDisplay Component ---

const MapDisplay: React.FC<MapDisplayProps> = ({ points, onMapClick, onMarkerDrag, constraintSegments }) => {
    const [basemap, setBasemap] = useState<'topo' | 'satellite'>('topo');
    // Hover state is localized here to prevent re-render loops in the parent.
    const [hoveredLatLng, setHoveredLatLng] = useState<LatLng | null>(null);

    const westCoastCenter = new LatLng(-42.715, 170.965);
    const nzBounds = new LatLngBounds(new LatLng(-47.3, 166.4), new LatLng(-34.4, 178.6));
    const position: LatLng = points[0] || westCoastCenter;
    const zoom = points[0] ? 9 : 8;

    return (
        <MapContainer center={position} zoom={zoom} scrollWheelZoom={true} maxBounds={nzBounds} minZoom={5} className="w-full h-full">
            <ResizeHandler />
            <MapEventsHandler onMapClick={onMapClick} />
            
            <div className="absolute top-2 right-2 z-[1000] bg-slate-800/80 p-1 rounded-md border border-slate-600 shadow-lg flex">
                <button onClick={() => setBasemap('topo')} className={`p-2 rounded-l-md transition-colors ${basemap === 'topo' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} title="Topographic Map"><Map size={18} /></button>
                <button onClick={() => setBasemap('satellite')} className={`p-2 rounded-r-md transition-colors ${basemap === 'satellite' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} title="Satellite Map"><Globe size={18} /></button>
            </div>

            {basemap === 'topo' ? (
                <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://opentopomap.org">OpenTopoMap</a>' url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
            ) : (
                <TileLayer attribution='© Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
            )}
            
            {points[0] && <Marker position={points[0]} draggable={true} eventHandlers={{ dragend: (e) => onMarkerDrag(0, e.target.getLatLng()) }} />}
            {points[1] && <Marker position={points[1]} draggable={true} eventHandlers={{ dragend: (e) => onMarkerDrag(1, e.target.getLatLng()) }} />}

            {points[0] && points[1] && (
                <Polyline positions={[points[0], points[1]]} color={basemap === 'satellite' ? '#38bdf8' : '#0284c7'} weight={3}
                    eventHandlers={{
                        mousemove: (e) => setHoveredLatLng(e.latlng),
                        mouseout: () => setHoveredLatLng(null),
                    }} 
                />
            )}
            
            {constraintSegments.map((segment, index) => {
                if (segment.length < 2) return null;
                const latlngs = segment.map(p => p.latlng);
                const { title, message } = getSegmentPopupInfo(segment);
                return (
                    <Polyline key={`constraint-${index}`} positions={latlngs} pathOptions={{ color: CONSTRAINT_COLORS[segment[0].type], weight: 8, opacity: 0.7 }}>
                        <Popup><div className="text-slate-800"><strong className="font-bold">{title}</strong><br/>{message}</div></Popup>
                    </Polyline>
                );
            })}

            {hoveredLatLng && <Marker position={hoveredLatLng} icon={pulsingIcon} interactive={false} />}
        </MapContainer>
    );
};

export default MapDisplay;