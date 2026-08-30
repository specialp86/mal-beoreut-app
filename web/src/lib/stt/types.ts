export interface TranscribeInput {
  audio: Buffer;
  filename: string;
  mimeType: string;
}

export interface TranscribeResult {
  text: string;
}

export interface SttProvider {
  name: string;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}
