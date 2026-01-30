
export interface Message {
  role: 'user' | 'model';
  text: string;
}

export interface PdfData {
  name: string;
  content: string;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  STUDYING = 'STUDYING'
}
