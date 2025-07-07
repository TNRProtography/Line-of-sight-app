import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ComposedChart, ReferenceDot, ReferenceLine } from 'recharts';
import type { LOSResult, TerrainPoint, ConstraintPoint } from '../types';

interface ProfileChartProps {
    terrainProfile: TerrainPoint[];
    losResult: LOSResult;
    antennaHeights: [number, number];
    hoveredDistance: number | null;
    onHover: (distance: number | null) => void;
    useCurvature: boolean;
    constraintSegments: ConstraintPoint[][];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label, useCurvature }) => {
    if (active && payload && payload.length) {
        // payload[0] might be the LOS line, find the terrain payload
        const terrainPayload = payload.find(p => p.dataKey === 'effectiveElevation' || (typeof p.dataKey === 'function'));
        if (!terrainPayload) return null;

        const baseElevation = terrainPayload.payload.elevation;
        const effectiveElevation = terrainPayload.value;
        const losPayload = payload.find(p => p.dataKey === 'los');
        const curvature = effectiveElevation - baseElevation;

        return (
            <div className="bg-slate-800 p-2 border border-slate-600 rounded shadow-lg text-sm">
                <p className="label text-slate-300">{`Distance: ${(label / 1000).toFixed(2)} km`}</p>
                <p className="intro text-cyan-400">{`Terrain: ${baseElevation.toFixed(1)} m`}</p>
                {useCurvature && <p className="intro text-yellow-400">{`Curvature Effect: +${curvature.toFixed(1)} m`}</p>}
                <p className="intro text-cyan-200">{`Effective Terrain: ${effectiveElevation.toFixed(1)} m`}</p>
                {losPayload && <p className="intro text-green-400">{`Line of Sight: ${losPayload.value?.toFixed(1)} m`}</p>}
            </div>
        );
    }
    return null;
};

const getCurvatureHeight = (distance: number, totalDistance: number): number => {
    if (totalDistance === 0) return 0;
    const R_e = 6371000; // Earth's mean radius in meters
    const K = 4 / 3;
    const effectiveRadius = R_e * K;
    const d1 = distance;
    const d2 = totalDistance - d1;
    return (d1 * d2) / (2 * effectiveRadius);
};

const CONSTRAINT_COLORS: Record<string, string> = {
    clearance: '#facc15', // yellow-400
    obstruction: '#ef4444', // red-500
    severe_obstruction: '#a855f7', // purple-500
    good: '#0ea5e9', // sky-500 (default)
};

const ProfileChart: React.FC<ProfileChartProps> = ({ terrainProfile, losResult, antennaHeights, hoveredDistance, onHover, useCurvature, constraintSegments }) => {
    const { isClear, obstruction } = losResult;
    const totalDistance = terrainProfile.length > 0 ? terrainProfile[terrainProfile.length - 1].distance : 0;

    const losData = [
        { distance: 0, los: terrainProfile[0].elevation + antennaHeights[0] },
        { distance: totalDistance, los: terrainProfile[terrainProfile.length - 1].elevation + antennaHeights[1] },
    ];
    
    const combinedData = terrainProfile.map(p => {
        const losHeight = losData[0].los + (losData[1].los - losData[0].los) * (p.distance / totalDistance);
        const curvature = useCurvature ? getCurvatureHeight(p.distance, totalDistance) : 0;
        return {
            distance: p.distance,
            elevation: p.elevation,
            effectiveElevation: p.elevation + curvature,
            los: losHeight,
        };
    });

    const colorSegments: {start: number; end: number; type: string}[] = [];
    if (totalDistance > 0) {
        let lastDistance = 0;
        const sortedSegments = [...constraintSegments].sort((a, b) => (a[0]?.distance ?? 0) - (b[0]?.distance ?? 0));

        sortedSegments.forEach(segment => {
            if (segment.length < 2) return;
            const startDist = segment[0].distance;
            const endDist = segment[segment.length - 1].distance;
            
            if (startDist > lastDistance) {
                colorSegments.push({ start: lastDistance, end: startDist, type: 'good' });
            }
            colorSegments.push({ start: startDist, end: endDist, type: segment[0].type });
            lastDistance = endDist;
        });

        if (lastDistance < totalDistance) {
            colorSegments.push({ start: lastDistance, end: totalDistance, type: 'good' });
        }
    }
    
    if (colorSegments.length === 0 && totalDistance > 0) {
        colorSegments.push({ start: 0, end: totalDistance, type: 'good' });
    }

    return (
        <ResponsiveContainer>
            <ComposedChart 
                data={combinedData} 
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                onMouseMove={(e) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                        const distance = e.activePayload[0].payload.distance;
                        onHover(distance);
                    }
                }}
                onMouseLeave={() => onHover(null)}
            >
                <defs>
                    {Object.entries(CONSTRAINT_COLORS).map(([type, color]) => (
                        <linearGradient key={type} id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.6}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                    dataKey="distance" 
                    type="number"
                    domain={[0, 'dataMax']}
                    tickFormatter={(tick) => `${(tick / 1000).toFixed(1)}`}
                    stroke="#94a3b8"
                    label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                />
                <YAxis 
                    stroke="#94a3b8"
                    domain={['dataMin - 20', 'dataMax + 20']}
                    label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomTooltip useCurvature={useCurvature} />} cursor={{ stroke: '#fb923c', strokeDasharray: '3 3' }}/>
                <Legend verticalAlign="top" height={36} />
                
                {colorSegments.map((segment) => (
                    <Area 
                        key={`${segment.start}-${segment.type}`}
                        data={combinedData}
                        type="monotone" 
                        dataKey={(p) => p.distance >= segment.start && p.distance < segment.end ? p.effectiveElevation : null}
                        connectNulls={false}
                        stroke="none"
                        fill={`url(#gradient-${segment.type})`}
                        isAnimationActive={false}
                        legendType="none"
                    />
                ))}
                 <Line
                    type="monotone"
                    dataKey="effectiveElevation"
                    name="Effective Terrain"
                    stroke={CONSTRAINT_COLORS.good}
                    strokeWidth={2}
                    dot={false}
                    legendType="line"
                    isAnimationActive={false}
                />

                <Line 
                    type="monotone" 
                    dataKey="los"
                    name="Line of Sight"
                    stroke={isClear ? "#4ade80" : "#f87171"}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
                {!isClear && obstruction && (
                    <ReferenceDot 
                        x={obstruction.distance} 
                        y={obstruction.height}
                        r={5} 
                        fill="#ef4444" 
                        stroke="#fecaca"
                        ifOverflow="extendDomain"
                    >
                         <text x={obstruction.distance} y={obstruction.height} dy={-10} fill="#fecaca" fontSize="12" textAnchor="middle">Obstruction</text>
                    </ReferenceDot>
                )}
                {hoveredDistance !== null && (
                    <ReferenceLine x={hoveredDistance} stroke="#fb923c" strokeWidth={1} ifOverflow="extendDomain" />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

export default ProfileChart;
