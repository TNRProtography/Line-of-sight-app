import React, { useState, useCallback, useMemo } from 'react';
import { LatLng } from 'leaflet';
import MapDisplay from './components/MapDisplay';
import ControlPanel from './components/ControlPanel';
import ResultDisplay from './components/ResultDisplay';
import type { LOSResult, TerrainPoint, ConstraintPoint, RadioSpecs, RadioLinkResult } from './types';

const App: React.FC = () => {
    const [points, setPoints] = useState<[LatLng | null, LatLng | null]>([null, null]);
    const [antennaHeights, setAntennaHeights] = useState<[number, number]>([10, 10]);
    const [radioSpecs, setRadioSpecs] = useState<RadioSpecs>({
        frequency: 5800, // MHz
        txPower: 20, // dBm
        txAntennaType: 'custom',
        txAntennaGain: 12, // dBi
        rxAntennaType: 'custom',
        rxAntennaGain: 12, // dBi
        rxSensitivity: -85, // dBm
    });
    const [useRadioSpecs, setUseRadioSpecs] = useState<boolean>(false);
    const [useCurvature, setUseCurvature] = useState<boolean>(true);
    const [terrainProfile, setTerrainProfile] = useState<TerrainPoint[] | null>(null);
    const [losResult, setLosResult] = useState<LOSResult | null>(null);
    const [radioLinkResult, setRadioLinkResult] = useState<RadioLinkResult | null>(null);
    const [constraintSegments, setConstraintSegments] = useState<ConstraintPoint[][]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    // --- FIX: All hover-related state and memos have been removed from here ---
    // This stops the re-render loop that caused flickering.

    const handleMapClick = useCallback((latlng: LatLng) => {
        if (losResult) {
            return;
        }

        setPoints(prevPoints => {
            if (!prevPoints[0]) {
                return [latlng, null];
            }
            if (!prevPoints[1]) {
                return [prevPoints[0], latlng];
            }
            return [latlng, null];
        });
        setTerrainProfile(null);
        setLosResult(null);
        setRadioLinkResult(null);
        setConstraintSegments([]);
        setError(null);
    }, [losResult]);

    const handleMarkerDrag = useCallback((index: 0 | 1, latlng: LatLng) => {
        setPoints(prevPoints => {
            const newPoints = [...prevPoints] as [LatLng | null, LatLng | null];
            newPoints[index] = latlng;
            return newPoints;
        });
        setTerrainProfile(null);
        setLosResult(null);
        setRadioLinkResult(null);
        setConstraintSegments([]);
        setError(null);
    }, []);

    const handleReset = useCallback(() => {
        setPoints([null, null]);
        setTerrainProfile(null);
        setLosResult(null);
        setRadioLinkResult(null);
        setConstraintSegments([]);
        setError(null);
        // --- FIX: Removed hoveredDistance reset ---
        setUseRadioSpecs(false);
        setUseCurvature(true);
    }, []);

    // --- FIX: handleHover function removed ---

    const getCurvatureHeight = useCallback((distance: number, totalDistance: number): number => {
        if (!useCurvature || totalDistance === 0) return 0;
        const R_e = 6371000 * (4 / 3);
        return (distance * (totalDistance - distance)) / (2 * R_e);
    }, [useCurvature]);

    const fetchTerrainProfile = async (start: LatLng, end: LatLng, steps: number = 100): Promise<{ profile: TerrainPoint[], totalDistance: number }> => {
        const locations = Array.from({ length: steps + 1 }, (_, i) => {
            const fraction = i / steps;
            return { latitude: start.lat + (end.lat - start.lat) * fraction, longitude: start.lng + (end.lng - start.lng) * fraction };
        });
        const response = await fetch('https://api.open-elevation.com/api/v1/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ locations }) });
        if (!response.ok) throw new Error(`Failed to fetch elevation data (status: ${response.status})`);
        const data = await response.json();
        if (!data.results || data.results.length === 0) throw new Error("Invalid elevation data received from API.");
        const totalDistance = start.distanceTo(end);
        const profile: TerrainPoint[] = data.results.map((r: { elevation: number }, i: number) => ({ distance: (i / steps) * totalDistance, elevation: r.elevation }));
        return { profile, totalDistance };
    };
    
    const calculateLineOfSight = (profile: TerrainPoint[], totalDistance: number, heightA: number, heightB: number): LOSResult => {
        const startEl = profile[0].elevation + heightA; const endEl = profile[profile.length - 1].elevation + heightB;
        for (let i = 1; i < profile.length - 1; i++) {
            const p = profile[i]; const losH = startEl + (endEl - startEl) * (p.distance / totalDistance);
            const effTerrH = p.elevation + getCurvatureHeight(p.distance, totalDistance);
            if (effTerrH > losH) return { isClear: false, obstruction: { distance: p.distance, height: effTerrH, losHeight: losH } };
        }
        return { isClear: true };
    };

    const calculateRadioLink = (totalDistance: number, specs: RadioSpecs): RadioLinkResult => {
        const distKm = totalDistance / 1000; const pathLoss = 20 * Math.log10(distKm) + 20 * Math.log10(specs.frequency) + 32.44;
        const rssi = specs.txPower - pathLoss + specs.txAntennaGain + specs.rxAntennaGain; const margin = rssi - specs.rxSensitivity;
        return { isViable: margin > 0, distance: +distKm.toFixed(2), pathLoss: +pathLoss.toFixed(2), receivedSignalStrength: +rssi.toFixed(2), linkMargin: +margin.toFixed(2) };
    };

    const handleAnalyze = async () => {
        if (!points[0] || !points[1]) { setError("Please select two points on the map."); return; }
        setIsLoading(true); setError(null); setTerrainProfile(null); setLosResult(null); setRadioLinkResult(null); setConstraintSegments([]);
        try {
            const { profile, totalDistance } = await fetchTerrainProfile(points[0], points[1]); setTerrainProfile(profile);
            const result = calculateLineOfSight(profile, totalDistance, antennaHeights[0], antennaHeights[1]); setLosResult(result);
            if (useRadioSpecs && result.isClear) { setRadioLinkResult(calculateRadioLink(totalDistance, radioSpecs)); }
            const startEl = profile[0].elevation + antennaHeights[0]; const endEl = profile[profile.length - 1].elevation + antennaHeights[1];
            const segments: ConstraintPoint[][] = []; let currentSegment: ConstraintPoint[] = [];
            for (let i = 0; i < profile.length; i++) {
                const p = profile[i]; const losH = startEl + (endEl - startEl) * (p.distance / totalDistance);
                const effTerrH = p.elevation + getCurvatureHeight(p.distance, totalDistance); const clearance = losH - effTerrH;
                let type: ConstraintPoint['type'] | null = null;
                if (clearance < -10) type = 'severe_obstruction'; else if (clearance < 0) type = 'obstruction'; else if (clearance < 10) type = 'clearance';
                if (type !== (currentSegment[0]?.type ?? null)) {
                    if (currentSegment.length > 1) segments.push(currentSegment); currentSegment = [];
                    if (type !== null && i > 0) {
                        const prev = profile[i-1]; const prevLosH = startEl + (endEl - startEl) * (prev.distance / totalDistance);
                        const prevClearance = prevLosH - (prev.elevation + getCurvatureHeight(prev.distance, totalDistance));
                        const frac = totalDistance > 0 ? prev.distance / totalDistance : 0;
                        currentSegment.push({ latlng: new LatLng(points[0]!.lat + (points[1]!.lat - points[0]!.lat) * frac, points[0]!.lng + (points[1]!.lng - points[0]!.lng) * frac), type, value: prevClearance, distance: prev.distance });
                    }
                }
                if (type !== null) {
                    const frac = totalDistance > 0 ? p.distance / totalDistance : 0;
                    currentSegment.push({ latlng: new LatLng(points[0]!.lat + (points[1]!.lat - points[0]!.lat) * frac, points[0]!.lng + (points[1]!.lng - points[0]!.lng) * frac), type, value: clearance, distance: p.distance });
                }
            }
            if (currentSegment.length > 1) segments.push(currentSegment); setConstraintSegments(segments);
        } catch (e) { const msg = e instanceof Error ? e.message : "An unknown error occurred."; setError(`Analysis failed. ${msg}`); } finally { setIsLoading(false); }
    };

    return (
        // --- FIX: This is a new, bulletproof layout using CSS Grid for stability. ---
        <div className="h-screen w-screen bg-slate-900 text-slate-200 grid lg:grid-cols-[3fr_2fr] grid-rows-[auto_1fr] lg:grid-rows-1 gap-4 p-4 overflow-hidden">
            {/* Header for mobile */}
            <header className="lg:hidden">
                <h1 className="text-3xl font-bold text-sky-400">Line of Sight Analyzer</h1>
                <p className="text-slate-400">Click or drag points on the map and analyze visibility.</p>
            </header>

            {/* Map Area - this is a more robust way to define the desktop layout */}
            <div className="lg:col-start-1 lg:row-start-1 flex-col hidden lg:flex">
                 <header className="mb-4">
                    <h1 className="text-3xl font-bold text-sky-400">Line of Sight Analyzer</h1>
                    <p className="text-slate-400">Click or drag points on the map and analyze visibility.</p>
                </header>
                <div className="flex-grow rounded-lg overflow-hidden border-2 border-slate-700 relative">
                    <MapDisplay 
                        points={points} 
                        onMapClick={handleMapClick}
                        onMarkerDrag={handleMarkerDrag}
                        constraintSegments={constraintSegments}
                        // --- FIX: Hover props are removed ---
                    />
                </div>
            </div>

            {/* Control Panel Area */}
            <main className="lg:col-start-2 lg:row-start-1 flex flex-col gap-4 overflow-y-auto">
                <ControlPanel
                    antennaHeights={antennaHeights}
                    onHeightChange={setAntennaHeights}
                    radioSpecs={radioSpecs}
                    onRadioSpecsChange={setRadioSpecs}
                    useRadioSpecs={useRadioSpecs}
                    onUseRadioSpecsChange={setUseRadioSpecs}
                    useCurvature={useCurvature}
                    onUseCurvatureChange={setUseCurvature}
                    onAnalyze={handleAnalyze}
                    onReset={handleReset}
                    isLoading={isLoading}
                    pointsSelected={!!(points[0] && points[1])}
                />
                {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
                <ResultDisplay
                    terrainProfile={terrainProfile}
                    losResult={losResult}
                    radioLinkResult={radioLinkResult}
                    antennaHeights={antennaHeights}
                    isLoading={isLoading}
                    useCurvature={useCurvature}
                    constraintSegments={constraintSegments}
                    // --- FIX: Hover props are removed ---
                />
            </main>
        </div>
    );
};

export default App;