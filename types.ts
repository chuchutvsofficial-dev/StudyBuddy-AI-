export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  image?: string; // Base64 string for user uploaded images
  timestamp: number;
  isError?: boolean;
}

export interface GenerationConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
}

export type LoadingState = 'idle' | 'uploading' | 'thinking' | 'streaming';