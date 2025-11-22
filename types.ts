export enum GameState {
  LOADING = 'LOADING',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export interface PlayerState {
  score: number;
  y: number; // Normalized 0-1
  name: string;
  color: string;
}

export interface BallState {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  vx: number;
  vy: number;
  speed: number;
}

export interface GameCommentary {
  text: string;
  timestamp: number;
  type: 'hype' | 'score' | 'intro';
}
