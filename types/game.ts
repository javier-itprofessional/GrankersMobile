export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  license?: string;
  handicap?: number;
  isReady?: boolean;
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
  groupCode: string;
  competitionName: string;
  eventName: string;
  players: Player[];
  date?: string;
  courseName?: string;
  routeName?: string;
}

export interface GameState {
  competition: Competition | null;
  currentHole: number;
  playerScores: Map<string, PlayerScores>;
  holePars: number[];
  isCompetition: boolean;
}

export interface FirebaseCompetitionData {
  group_code: string;
  competition_name: string;
  event_name: string;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    license: string;
    handicap?: number;
  }[];
  course_name?: string;
  route_name?: string;
}
