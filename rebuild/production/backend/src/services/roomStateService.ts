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

// 增量更新接口
export interface DeltaUpdate {
  version: number;
  delta: Partial<Record<string, unknown>>;
  full?: boolean; // 是否为完整更新
}

const playersKey = (roomId: string): string => `room:${roomId}:players`;
const stateKey = (roomId: string): string => `room:${roomId}:state`;
const sessionStateKey = (sessionId: string): string => `session:${sessionId}:state`;
const sessionDeltaKey = (sessionId: string): string => `session:${sessionId}:deltas`;
const MAX_DELTAS = 10; // 保留最近10个增量更新

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

// 计算两个状态之间的差异
export const calculateDelta = (oldState: Record<string, unknown>, newState: Record<string, unknown>): Partial<Record<string, unknown>> => {
  const delta: Partial<Record<string, unknown>> = {};

  // 检查新状态中的所有键
  for (const [key, newValue] of Object.entries(newState)) {
    const oldValue = oldState[key];
    
    // 如果值不同，添加到差异中
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      delta[key] = newValue;
    }
  }

  // 检查是否有键被删除
  for (const key of Object.keys(oldState)) {
    if (!(key in newState)) {
      delta[key] = undefined; // 用undefined表示删除
    }
  }

  return delta;
};

export const saveSessionState = async (
  sessionId: string,
  newState: Record<string, unknown>
): Promise<SessionState> => {
  // 获取当前状态
  const currentState = await getSessionState(sessionId);
  
  // 计算差异
  const delta = calculateDelta(currentState.state, newState);
  
  // 增加版本号
  const newVersion = currentState.version + 1;
  
  // 保存完整状态
  await Promise.all([
    redis.hset(sessionStateKey(sessionId), 'version', newVersion.toString()),
    redis.hset(sessionStateKey(sessionId), 'payload', JSON.stringify(newState))
  ]);
  
  // 保存增量更新
  if (Object.keys(delta).length > 0) {
    const deltaEntry: DeltaUpdate = {
      version: newVersion,
      delta
    };
    
    await redis.lpush(sessionDeltaKey(sessionId), JSON.stringify(deltaEntry));
    // 只保留最近的MAX_DELTAS个增量更新
    await redis.ltrim(sessionDeltaKey(sessionId), 0, MAX_DELTAS - 1);
  }
  
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

// 获取自指定版本以来的增量更新
export const getSessionDeltas = async (sessionId: string, fromVersion: number): Promise<DeltaUpdate[]> => {
  const currentState = await getSessionState(sessionId);
  
  // 如果请求的版本大于等于当前版本，返回空数组
  if (fromVersion >= currentState.version) {
    return [];
  }
  
  // 如果请求的版本太旧，返回完整更新
  if (fromVersion <= currentState.version - MAX_DELTAS) {
    return [{
      version: currentState.version,
      delta: currentState.state,
      full: true
    }];
  }
  
  // 获取所有增量更新
  const deltaStrings = await redis.lrange(sessionDeltaKey(sessionId), 0, -1);
  const deltas: DeltaUpdate[] = [];
  
  // 解析并过滤出需要的增量更新
  for (const deltaStr of deltaStrings) {
    try {
      const delta: DeltaUpdate = JSON.parse(deltaStr);
      if (delta.version > fromVersion) {
        deltas.push(delta);
      }
    } catch (error) {
      console.error('Failed to parse delta:', error);
    }
  }
  
  // 按版本号排序
  return deltas.sort((a, b) => a.version - b.version);
};

