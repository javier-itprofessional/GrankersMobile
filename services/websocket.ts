import { AuthStorage } from './auth-storage';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL;

// ─── Tipos de eventos recibidos del backend ───────────────────────────────────

export interface LeaderboardEntry {
  player_id: string;
  nombre: string;
  apellido: string;
  total_score: number;
  total_par: number;
  vs_par: number;
  holes_completed: number;
}

export interface ScoreConfirmedEvent {
  player_id: string;
  hole_number: number;
  score: number;
}

export interface PlayerStatusEvent {
  player_id: string;
  status: 'preparado' | 'conectado' | 'no_presentado' | 'pendiente';
}

export type WsEventType =
  | 'leaderboard_updated'
  | 'score_confirmed'
  | 'player_status_changed'
  | 'round_finished';

export type WsEventPayload = {
  leaderboard_updated: { round_id: string; leaderboard: LeaderboardEntry[] };
  score_confirmed: { round_id: string } & ScoreConfirmedEvent;
  player_status_changed: { round_id: string } & PlayerStatusEvent;
  round_finished: { round_id: string };
};

type Listener<T extends WsEventType> = (payload: WsEventPayload[T]) => void;

// ─── WebSocketClient ──────────────────────────────────────────────────────────

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // backoff escalonado

class WebSocketClient {
  private socket: WebSocket | null = null;
  private roundId: string | null = null;
  private listeners = new Map<string, Set<Listener<WsEventType>>>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  // Conectar a la sala de una ronda
  async connect(roundId: string): Promise<void> {
    this.disconnect();
    this.roundId = roundId;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    await this.open();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close(1000, 'client_disconnect');
      this.socket = null;
    }
    this.roundId = null;
  }

  // Suscribirse a un tipo de evento
  on<T extends WsEventType>(event: T, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<WsEventType>);

    // Devuelve función de cleanup
    return () => {
      this.listeners.get(event)?.delete(listener as Listener<WsEventType>);
    };
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async open(): Promise<void> {
    if (!this.roundId || !WS_URL) return;

    const token = await AuthStorage.getAccessToken();
    const url = `${WS_URL}/ws/round/${this.roundId}/?token=${token ?? ''}`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as {
          type: WsEventType;
          payload: WsEventPayload[WsEventType];
        };
        this.emit(message.type, message.payload);
      } catch {
        // Mensaje malformado, ignorar
      }
    };

    this.socket.onclose = (event) => {
      if (!this.shouldReconnect || event.code === 1000) return;
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // onclose se dispara después, gestionamos ahí el reconectar
    };
  }

  private emit(type: WsEventType, payload: WsEventPayload[WsEventType]): void {
    this.listeners.get(type)?.forEach((listener) => listener(payload));
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.open().catch(() => {});
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const wsClient = new WebSocketClient();
