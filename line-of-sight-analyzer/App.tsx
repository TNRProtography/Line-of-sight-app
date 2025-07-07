
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
    const [hoveredDistance, setHoveredDistance] = useState<number | null>(null);

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
        setHoveredDistance(null);
        setUseRadioSpecs(false);
        setUseCurvature(true);
    }, []);

    const handleHover = useCallback((distance: number | null) => {
        setHoveredDistance(distance);
    }, []);
    
    const hoveredLatLng = useMemo(() => {
        if (hoveredDistance === null || !points[0] || !points[1]) {
            return null;
        }
        const totalDistance = points[0].distanceTo(points[1]);
        if (totalDistance === 0) return points[0];
    
        const fraction = hoveredDistance / totalDistance;
        const safeFraction = Math.max(0, Math.min(1, fraction));
        
        const lat = points[0].lat + (points[1].lat - points[0].lat) * safeFraction;
        const lng = points[0].lng + (points[1].lng - points[0].lng) * safeFraction;
        return new LatLng(lat, lng);
    }, [hoveredDistance, points]);

    const getCurvatureHeight = useCallback((distance: number, totalDistance: number): number => {
        if (!useCurvature || totalDistance === 0) return 0;
        
        // Using the 4/3 Earth radius model (k-factor) for standard atmospheric refraction
        const R_e = 6371000; // Earth's mean radius in meters
        const K = 4 / 3;
        const effectiveRadius = R_e * K;
    
        const d1 = distance;
        const d2 = totalDistance - d1;
    
        // h = (d1 * d2) / (2 * K * R_e)
        return (d1 * d2) / (2 * effectiveRadius);
    }, [useCurvature]);

    const fetchTerrainProfile = async (start: LatLng, end: LatLng, steps: number = 100): Promise<{ profile: TerrainPoint[], totalDistance: number }> => {
        const locations = [];
        for (let i = 0; i <= steps; i++) {
            const fraction = i / steps;
            const lat = start.lat + (end.lat - start.lat) * fraction;
            const lng = start.lng + (end.lng - start.lng) * fraction;
            locations.push({ latitude: lat, longitude: lng });
        }
    
        const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ locations }),
        });
    
        if (!response.ok) {
            throw new Error(`Failed to fetch elevation data (status: ${response.status})`);
        }
    
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            throw new Error("Invalid elevation data received from API.");
        }
    
        const totalDistance = start.distanceTo(end);
        const profile: TerrainPoint[] = data.results.map((result: { elevation: number }, index: number) => {
            const distance = (index / steps) * totalDistance;
            return {
                distance,
                elevation: result.elevation,
            };
        });
    
        return { profile, totalDistance };
    };
    
    const calculateLineOfSight = (profile: TerrainPoint[], totalDistance: number, heightA: number, heightB: number): LOSResult => {
        const startAntennaElevation = profile[0].elevation + heightA;
        const endAntennaElevation = profile[profile.length - 1].elevation + heightB;

        for (let i = 1; i < profile.length - 1; i++) {
            const point = profile[i];
            const losHeightAtPoint = startAntennaElevation + (endAntennaElevation - startAntennaElevation) * (point.distance / totalDistance);
            const curvature = getCurvatureHeight(point.distance, totalDistance);
            const effectiveTerrainHeight = point.elevation + curvature;

            if (effectiveTerrainHeight > losHeightAtPoint) {
                return {
                    isClear: false,
                    obstruction: {
                        distance: point.distance,
                        height: effectiveTerrainHeight,
                        losHeight: losHeightAtPoint,
                    },
                };
            }
        }

        return { isClear: true };
    };

    const calculateRadioLink = (totalDistanceMeters: number, specs: RadioSpecs): RadioLinkResult => {
        const distanceKm = totalDistanceMeters / 1000;
        
        // Free Space Path Loss (FSPL) in dB, for d in km and f in MHz
        const pathLoss = 20 * Math.log10(distanceKm) + 20 * Math.log10(specs.frequency) + 32.44;
    
        // Received Signal Strength Indicator (RSSI) in dBm
        const receivedSignalStrength = specs.txPower - pathLoss + specs.txAntennaGain + specs.rxAntennaGain;
        
        // Link Margin in dB
        const linkMargin = receivedSignalStrength - specs.rxSensitivity;
    
        return {
            isViable: linkMargin > 0,
            distance: parseFloat(distanceKm.toFixed(2)),
            pathLoss: parseFloat(pathLoss.toFixed(2)),
            receivedSignalStrength: parseFloat(receivedSignalStrength.toFixed(2)),
            linkMargin: parseFloat(linkMargin.toFixed(2)),
        };
    };

    const handleAnalyze = async () => {
        if (!points[0] || !points[1]) {
            setError("Please select two points on the map.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setTerrainProfile(null);
        setLosResult(null);
        setRadioLinkResult(null);
        setConstraintSegments([]);

        try {
            const { profile, totalDistance } = await fetchTerrainProfile(points[0], points[1]);
            setTerrainProfile(profile);

            const result = calculateLineOfSight(profile, totalDistance, antennaHeights[0], antennaHeights[1]);
            setLosResult(result);
            
            if (useRadioSpecs && result.isClear) {
                const radioResult = calculateRadioLink(totalDistance, radioSpecs);
                setRadioLinkResult(radioResult);
            }

            const startAntennaElevation = profile[0].elevation + antennaHeights[0];
            const endAntennaElevation = profile[profile.length - 1].elevation + antennaHeights[1];
            
            const segments: ConstraintPoint[][] = [];
            let currentSegment: ConstraintPoint[] = [];

            for (let i = 0; i < profile.length; i++) {
                const point = profile[i];
                const losHeightAtPoint = startAntennaElevation + (endAntennaElevation - startAntennaElevation) * (point.distance / totalDistance);
                const curvature = getCurvatureHeight(point.distance, totalDistance);
                const effectiveTerrainHeight = point.elevation + curvature;
                const clearance = losHeightAtPoint - effectiveTerrainHeight;
                
                let type: ConstraintPoint['type'] | null = null;
                if (clearance < -10) {
                    type = 'severe_obstruction';
                } else if (clearance < 0) {
                    type = 'obstruction';
                } else if (clearance < 10) {
                    type = 'clearance';
                }

                const currentSegmentType = currentSegment.length > 0 ? currentSegment[0].type : null;
                
                if (type !== currentSegmentType) {
                    if (currentSegment.length > 1) {
                        segments.push(currentSegment);
                    }
                    currentSegment = [];

                    if (type !== null && i > 0) {
                        const prevPoint = profile[i-1];
                        const prevLosHeight = startAntennaElevation + (endAntennaElevation - startAntennaElevation) * (prevPoint.distance / totalDistance);
                        const prevCurvature = getCurvatureHeight(prevPoint.distance, totalDistance);
                        const prevEffectiveTerrainHeight = prevPoint.elevation + prevCurvature;
                        const prevClearance = prevLosHeight - prevEffectiveTerrainHeight;
                        
                        const fraction = totalDistance > 0 ? prevPoint.distance / totalDistance : 0;
                        const lat = points[0]!.lat + (points[1]!.lat - points[0]!.lat) * fraction;
                        const lng = points[0]!.lng + (points[1]!.lng - points[0]!.lng) * fraction;
                        currentSegment.push({ latlng: new LatLng(lat, lng), type, value: prevClearance, distance: prevPoint.distance });
                    }
                }

                if (type !== null) {
                    const fraction = totalDistance > 0 ? point.distance / totalDistance : 0;
                    const lat = points[0]!.lat + (points[1]!.lat - points[0]!.lat) * fraction;
                    const lng = points[0]!.lng + (points[1]!.lng - points[0]!.lng) * fraction;
                    const latlng = new LatLng(lat, lng);
                    currentSegment.push({ latlng, type, value: clearance, distance: point.distance });
                }
            }
            if (currentSegment.length > 1) {
                segments.push(currentSegment);
            }
            
            setConstraintSegments(segments);

        } catch (e) {
            console.error("Analysis failed:", e);
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during analysis.";
            setError(`Analysis failed. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col lg:flex-row p-4 gap-4">
            <div className="lg:w-3/5 flex flex-col gap-4 h-[50vh] lg:h-auto">
                <header>
                    <h1 className="text-3xl font-bold text-sky-400">Line of Sight Analyzer</h1>
                    <p className="text-slate-400">Click or drag points on the map, adjust antenna heights, and analyze visibility.</p>
                </header>
                <div className="flex-grow rounded-lg overflow-hidden border-2 border-slate-700 relative">
                    <MapDisplay 
                        points={points} 
                        onMapClick={handleMapClick}
                        hoveredLatLng={hoveredLatLng}
                        onHover={handleHover}
                        onMarkerDrag={handleMarkerDrag}
                        constraintSegments={constraintSegments}
                    />
                </div>
            </div>
            <main className="lg:w-2/5 flex flex-col gap-4">
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
                    hoveredDistance={hoveredDistance}
                    onHover={handleHover}
                    useCurvature={useCurvature}
                    constraintSegments={constraintSegments}
                />
            </main>
        </div>
    );
};

export default App;
