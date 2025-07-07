import type { LatLng } from 'leaflet';

export interface TerrainPoint {
  distance: number;
  elevation: number;
}

export interface ObstructionInfo {
  distance: number;
  height: number;
  losHeight: number;
}

export interface LOSResult {
  isClear: boolean;
  obstruction?: ObstructionInfo;
}

export type ConstraintPointType = 'clearance' | 'obstruction' | 'severe_obstruction';

export interface ConstraintPoint {
    latlng: LatLng;
    distance: number;
    type: ConstraintPointType;
    value: number; // The clearance or obstruction value in meters
}

export type AntennaType = 'omni' | 'yagi' | 'panel' | 'dish' | 'custom';

export interface RadioSpecs {
    frequency: number; // MHz
    txPower: number; // dBm
    txAntennaType: AntennaType;
    txAntennaGain: number; // dBi
    rxAntennaType: AntennaType;
    rxAntennaGain: number; // dBi
    rxSensitivity: number; // dBm
}

export interface RadioLinkResult {
    isViable: boolean;
    distance: number; // in km
    pathLoss: number; // in dB
    receivedSignalStrength: number; // in dBm
    linkMargin: number; // in dB
}
