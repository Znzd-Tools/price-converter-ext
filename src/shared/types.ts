export type ConversionOperation = 'divide' | 'multiply';

export interface ConversionConfig {
  selector: string;
  rate: number;
  operation: ConversionOperation;
  symbol: string;
}

export interface StartConversionMessage {
  type: 'START_CONVERSION';
  payload: ConversionConfig;
}

export interface PingMessage {
  type: 'PING';
}

export interface StartPickerMessage {
  type: 'START_PICKER';
}

export interface AutoDetectMessage {
  type: 'AUTO_DETECT';
}

export interface StopConversionMessage {
  type: 'STOP_CONVERSION';
}

export type ContentMessage =
  | StartConversionMessage
  | StopConversionMessage
  | PingMessage
  | StartPickerMessage
  | AutoDetectMessage;

export type PickSource = 'auto' | 'manual';

export interface PickedTarget {
  selector: string;
  matchCount: number;
  preview: string;
  pickedAt: number;
  source?: PickSource;
  reason?: string;
}

export interface ContentScriptResponse {
  ok: boolean;
  matched?: number;
  selector?: string;
  matchCount?: number;
  preview?: string;
  reason?: string;
}