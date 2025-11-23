export enum AppStep {
  UPLOAD = 'UPLOAD',
  SETTINGS = 'SETTINGS',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}

export interface ProcessingStats {
  progress: number; // 0 to 100
  time: number; // seconds
  message: string;
}

export type CloudProvider = 'google' | 'onedrive' | 'onedrive_biz' | 's3';

export interface VideoConfig {
  fps: number;
  outputName: string;
}
