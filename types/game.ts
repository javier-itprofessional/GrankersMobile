export interface Player {
  id: string;
  nombre: string;
  apellido: string;
  licencia?: string;
  handicap?: number;
  preparado?: boolean;
  isDevice?: boolean;
}

export interface HoleScore {
  holeNumber: number;
  par: number;
  score: number;
  saved: boolean;
}

export interface PlayerScores {
  playerId: string;
  scores: HoleScore[];
  totalScore: number;
  totalPar: number;
}

export interface Competition {
  codigo_grupo: string;
  nombre_competicion: string;
  nombre_prueba: string;
  jugadores: Player[];
  fecha?: string;
  campo?: string;
  recorrido?: string;
}

export interface GameState {
  competition: Competition | null;
  currentHole: number;
  playerScores: Map<string, PlayerScores>;
  holePars: number[];
  isCompetition: boolean;
}

export interface FirebaseCompetitionData {
  codigo_grupo: string;
  nombre_competicion: string;
  nombre_prueba: string;
  jugadores: {
    id: string;
    nombre: string;
    apellido: string;
    licencia: string;
    handicap?: number;
  }[];
  campo?: string;
  recorrido?: string;
}
