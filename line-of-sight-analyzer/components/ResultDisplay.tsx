import React from 'react';
import type { LOSResult, TerrainPoint, RadioLinkResult, ConstraintPoint } from '../types';
import ProfileChart from './ProfileChart';

interface ResultDisplayProps {
    terrainProfile: TerrainPoint[] | null;
    losResult: LOSResult | null;
    radioLinkResult: RadioLinkResult | null;
    antennaHeights: [number, number];
    isLoading: boolean;
    hoveredDistance: number | null;
    onHover: (distance: number | null) => void;
    useCurvature: boolean;
    constraintSegments: ConstraintPoint[][];
}

const LoadingSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-700 rounded w-1/3"></div>
        <div className="h-48 bg-slate-700 rounded"></div>
    </div>
);

const ResultDisplay: React.FC<ResultDisplayProps> = ({
    terrainProfile,
    losResult,
    radioLinkResult,
    antennaHeights,
    isLoading,
    hoveredDistance,
    onHover,
    useCurvature,
    constraintSegments,
}) => {
    if (isLoading) {
        return (
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex-grow space-y-4">
                <LoadingSkeleton />
            </div>
        );
    }

    if (!terrainProfile || !losResult) {
        return (
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex-grow flex items-center justify-center">
                <p className="text-slate-400">Analysis results will be displayed here.</p>
            </div>
        );
    }
    
    const { isClear } = losResult;

    return (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex-grow flex flex-col gap-4">
            <div>
                <h2 className="text-xl font-semibold text-sky-400 mb-2">Line of Sight Analysis</h2>
                <div className={`text-lg font-bold p-2 rounded-md inline-block ${isClear ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    Path: {isClear ? 'Clear' : 'Obstructed'}
                </div>
            </div>

            {radioLinkResult && (
                <div>
                    <h2 className="text-xl font-semibold text-sky-400 mb-2">Radio Link Analysis</h2>
                    <div className={`text-lg font-bold p-2 rounded-md inline-block ${radioLinkResult.isViable ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                        Signal Link: {radioLinkResult.isViable ? 'Viable' : 'Not Viable'}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
                        <div className="text-slate-400">Distance:</div>
                        <div className="text-white font-mono text-right">{radioLinkResult.distance} km</div>
                        
                        <div className="text-slate-400">Path Loss:</div>
                        <div className="text-white font-mono text-right">{radioLinkResult.pathLoss} dB</div>

                        <div className="text-slate-400">Received Signal:</div>
                        <div className="text-white font-mono text-right">{radioLinkResult.receivedSignalStrength} dBm</div>

                        <div className="text-slate-400">Link Margin:</div>
                        <div className={`font-mono text-right ${radioLinkResult.isViable ? 'text-green-400' : 'text-red-400'}`}>{radioLinkResult.linkMargin} dB</div>
                    </div>
                </div>
            )}
            
            <div className="h-64 md:h-72 w-full">
                <ProfileChart 
                    terrainProfile={terrainProfile} 
                    losResult={losResult} 
                    antennaHeights={antennaHeights}
                    hoveredDistance={hoveredDistance}
                    onHover={onHover}
                    useCurvature={useCurvature}
                    constraintSegments={constraintSegments}
                />
            </div>
        </div>
    );
};

export default ResultDisplay;
