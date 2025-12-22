import redis from '../utils/redis';

export type RoomStatus = 'waiting' | 'playing' | 'closed' | string;

export interface RoomState {
  roomId: string;
  players: string[];
  status: RoomStatus;
  version: number;
}

export interface SessionState {
  sessionId: string;
  state: Record<string, unknown>;
  version: number;
}

const playersKey = (roomId: string): string => `room:${roomId}:players`;
const stateKey = (roomId: string): string => `room:${roomId}:state`;
const sessionStateKey = (sessionId: string): string => `session:${sessionId}:state`;

export const addPlayerToRoom = async (
  roomId: string,
  userId: string
): Promise<RoomState> => {
  await redis.sadd(playersKey(roomId), userId);
  // Default status to waiting if not set
  await redis.hsetnx(stateKey(roomId), 'status', 'waiting');
  // Increment version on any membership change
  await redis.hincrby(stateKey(roomId), 'version', 1);
  return getRoomState(roomId);
};

export const removePlayerFromRoom = async (
  roomId: string,
  userId: string
): Promise<RoomState> => {
  await redis.srem(playersKey(roomId), userId);
  // Increment version on any membership change
  await redis.hincrby(stateKey(roomId), 'version', 1);
  return getRoomState(roomId);
};

export const getRoomState = async (roomId: string): Promise<RoomState> => {
  const [players, status, versionRaw] = await Promise.all([
    redis.smembers(playersKey(roomId)),
    redis.hget(stateKey(roomId), 'status'),
    redis.hget(stateKey(roomId), 'version'),
  ]);

  const version = versionRaw ? Number.parseInt(versionRaw, 10) || 0 : 0;

  return {
    roomId,
    players,
    status: (status as RoomStatus | null) ?? 'waiting',
    version,
  };
};

export const saveSessionState = async (
  sessionId: string,
  state: Record<string, unknown>
): Promise<SessionState> => {
  const version = await redis.hincrby(sessionStateKey(sessionId), 'version', 1);
  await redis.hset(sessionStateKey(sessionId), 'payload', JSON.stringify(state));
  return getSessionState(sessionId);
};

export const getSessionState = async (sessionId: string): Promise<SessionState> => {
  const [versionRaw, payloadRaw] = await Promise.all([
    redis.hget(sessionStateKey(sessionId), 'version'),
    redis.hget(sessionStateKey(sessionId), 'payload'),
  ]);

  const version = versionRaw ? Number.parseInt(versionRaw, 10) || 0 : 0;
  let parsed: Record<string, unknown> = {};
  if (payloadRaw) {
    try {
      parsed = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  return {
    sessionId,
    state: parsed,
    version,
  };
};

