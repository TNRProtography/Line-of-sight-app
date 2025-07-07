
import React from 'react';
import { RefreshCw, BarChart2 } from 'lucide-react';
import type { RadioSpecs, AntennaType } from '../types';

interface ControlPanelProps {
    antennaHeights: [number, number];
    onHeightChange: (heights: [number, number]) => void;
    radioSpecs: RadioSpecs;
    onRadioSpecsChange: (specs: RadioSpecs) => void;
    useRadioSpecs: boolean;
    onUseRadioSpecsChange: (enabled: boolean) => void;
    useCurvature: boolean;
    onUseCurvatureChange: (enabled: boolean) => void;
    onAnalyze: () => void;
    onReset: () => void;
    isLoading: boolean;
    pointsSelected: boolean;
}

const antennaOptions: Record<AntennaType, { name: string; gain: number }> = {
    omni: { name: 'Omni-directional', gain: 6 },
    yagi: { name: 'Yagi', gain: 12 },
    panel: { name: 'Panel', gain: 16 },
    dish: { name: 'Dish', gain: 24 },
    custom: { name: 'Custom', gain: -1 }, // Special value to not change gain
};

const ControlPanel: React.FC<ControlPanelProps> = ({
    antennaHeights,
    onHeightChange,
    radioSpecs,
    onRadioSpecsChange,
    useRadioSpecs,
    onUseRadioSpecsChange,
    useCurvature,
    onUseCurvatureChange,
    onAnalyze,
    onReset,
    isLoading,
    pointsSelected
}) => {

    const handleSpecChange = (field: keyof RadioSpecs, value: number) => {
        onRadioSpecsChange({ ...radioSpecs, [field]: value });
    };

    const handleAntennaTypeChange = (specKey: 'tx' | 'rx', type: AntennaType) => {
        const gainKey = `${specKey}AntennaGain` as 'txAntennaGain' | 'rxAntennaGain';
        const typeKey = `${specKey}AntennaType` as 'txAntennaType' | 'rxAntennaType';
        const newGain = antennaOptions[type].gain;
        const newSpecs = { ...radioSpecs, [typeKey]: type };
        if (newGain !== -1) {
            newSpecs[gainKey] = newGain;
        }
        onRadioSpecsChange(newSpecs);
    };

    const handleAntennaGainChange = (specKey: 'tx' | 'rx', gain: number) => {
        const gainKey = `${specKey}AntennaGain` as 'txAntennaGain' | 'rxAntennaGain';
        const typeKey = `${specKey}AntennaType` as 'txAntennaType' | 'rxAntennaType';
        
        let newType: AntennaType = 'custom';
        for (const [key, value] of Object.entries(antennaOptions)) {
            if (value.gain === gain) {
                newType = key as AntennaType;
                break;
            }
        }
        onRadioSpecsChange({ ...radioSpecs, [gainKey]: gain, [typeKey]: newType });
    };

    return (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-sky-400">Controls</h2>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="antennaA" className="block text-sm font-medium text-slate-300">
                        Antenna Height at Point A: <span className="font-bold text-white">{antennaHeights[0]}m</span>
                    </label>
                    <input
                        id="antennaA"
                        type="range"
                        min="1"
                        max="100"
                        value={antennaHeights[0]}
                        onChange={(e) => onHeightChange([+e.target.value, antennaHeights[1]])}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="antennaB" className="block text-sm font-medium text-slate-300">
                        Antenna Height at Point B: <span className="font-bold text-white">{antennaHeights[1]}m</span>
                    </label>
                    <input
                        id="antennaB"
                        type="range"
                        min="1"
                        max="100"
                        value={antennaHeights[1]}
                        onChange={(e) => onHeightChange([antennaHeights[0], +e.target.value])}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        disabled={isLoading}
                    />
                </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-700">
                <h3 className="text-lg font-semibold text-sky-400 mb-2">Analysis Options</h3>
                 <label htmlFor="useCurvatureToggle" className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-slate-300">Earth Curvature Correction</span>
                    <div className="relative">
                        <input 
                            id="useCurvatureToggle" 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={useCurvature}
                            onChange={e => onUseCurvatureChange(e.target.checked)}
                            disabled={isLoading}
                        />
                        <div className="w-12 h-6 rounded-full bg-slate-600 peer-checked:bg-sky-600 transition-colors"></div>
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-6"></div>
                    </div>
                </label>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                <h3 className="text-lg font-semibold text-sky-400">Radio Specifications</h3>
                <label htmlFor="useRadioSpecsToggle" className="flex items-center cursor-pointer">
                    <span className={`mr-3 text-sm font-medium ${useRadioSpecs ? 'text-slate-400' : 'text-white'}`}>Off</span>
                    <div className="relative">
                        <input 
                            id="useRadioSpecsToggle" 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={useRadioSpecs}
                            onChange={e => onUseRadioSpecsChange(e.target.checked)}
                            disabled={isLoading}
                        />
                        <div className="w-12 h-6 rounded-full bg-slate-600 peer-checked:bg-sky-600 transition-colors"></div>
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-6"></div>
                    </div>
                    <span className={`ml-3 text-sm font-medium ${useRadioSpecs ? 'text-white' : 'text-slate-400'}`}>On</span>
                </label>
            </div>

            <div className={`mt-3 space-y-4 transition-opacity duration-300 ${!useRadioSpecs ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <div>
                    <label htmlFor="frequency" className="block text-sm font-medium text-slate-300">
                        Frequency: <span className="font-bold text-white">{radioSpecs.frequency} MHz</span>
                    </label>
                    <input id="frequency" type="range" min="200" max="6000" step="10" value={radioSpecs.frequency}
                        onChange={(e) => handleSpecChange('frequency', +e.target.value)}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500" disabled={isLoading} />
                </div>
                 <div>
                    <label htmlFor="txPower" className="block text-sm font-medium text-slate-300">
                        Transmit Power: <span className="font-bold text-white">{radioSpecs.txPower} dBm</span>
                    </label>
                    <input id="txPower" type="range" min="0" max="30" value={radioSpecs.txPower}
                        onChange={(e) => handleSpecChange('txPower', +e.target.value)}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500" disabled={isLoading} />
                </div>

                <div>
                    <label htmlFor="txAntennaType" className="block text-sm font-medium text-slate-300 mb-1">Tx Antenna Type</label>
                    <select id="txAntennaType" value={radioSpecs.txAntennaType}
                        onChange={(e) => handleAntennaTypeChange('tx', e.target.value as AntennaType)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm p-2 text-white focus:ring-sky-500 focus:border-sky-500"
                        disabled={isLoading}>
                        {Object.entries(antennaOptions).map(([key, { name }]) => (
                            <option key={key} value={key} className="bg-slate-800">{name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="txAntennaGain" className="block text-sm font-medium text-slate-300">
                        Tx Antenna Gain: <span className="font-bold text-white">{radioSpecs.txAntennaGain} dBi</span>
                    </label>
                    <input id="txAntennaGain" type="range" min="0" max="30" value={radioSpecs.txAntennaGain}
                        onChange={(e) => handleAntennaGainChange('tx', +e.target.value)}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500" disabled={isLoading} />
                </div>

                <div>
                    <label htmlFor="rxAntennaType" className="block text-sm font-medium text-slate-300 mb-1">Rx Antenna Type</label>
                    <select id="rxAntennaType" value={radioSpecs.rxAntennaType}
                        onChange={(e) => handleAntennaTypeChange('rx', e.target.value as AntennaType)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm p-2 text-white focus:ring-sky-500 focus:border-sky-500"
                        disabled={isLoading}>
                        {Object.entries(antennaOptions).map(([key, { name }]) => (
                            <option key={key} value={key} className="bg-slate-800">{name}</option>
                        ))}
                    </select>
                </div>
                 <div>
                    <label htmlFor="rxAntennaGain" className="block text-sm font-medium text-slate-300">
                        Rx Antenna Gain: <span className="font-bold text-white">{radioSpecs.rxAntennaGain} dBi</span>
                    </label>
                    <input id="rxAntennaGain" type="range" min="0" max="30" value={radioSpecs.rxAntennaGain}
                        onChange={(e) => handleAntennaGainChange('rx', +e.target.value)}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500" disabled={isLoading} />
                </div>
                <div>
                    <label htmlFor="rxSensitivity" className="block text-sm font-medium text-slate-300">
                        Receiver Sensitivity: <span className="font-bold text-white">{radioSpecs.rxSensitivity} dBm</span>
                    </label>
                    <input id="rxSensitivity" type="range" min="-100" max="-60" value={radioSpecs.rxSensitivity}
                        onChange={(e) => handleSpecChange('rxSensitivity', +e.target.value)}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500" disabled={isLoading} />
                </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                    onClick={onAnalyze}
                    disabled={!pointsSelected || isLoading}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400 transition-colors"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <BarChart2 className="mr-2 h-5 w-5" />
                            Analyze Path
                        </>
                    )}
                </button>
                <button
                    onClick={onReset}
                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-600 text-base font-medium rounded-md shadow-sm text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500 transition-colors"
                >
                    <RefreshCw className="mr-2 h-5 w-5"/>
                    Reset
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;