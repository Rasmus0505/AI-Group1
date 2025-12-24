/**
 * 情报系统类型定义
 * 实现Fog of War机制，根据置信度显示不同精度的对手信息
 */

export interface IntelligenceData {
  playerId: string;
  attribute: string;
  value: number;
  confidence: number; // 0-1，置信度
  source: 'public_signal' | 'private_leak' | 'historical_model' | 'direct_observation';
  lastUpdated: Date;
  reliability?: number; // 0-1，信息可靠性
}

export interface PlayerIntelligence {
  playerId: string;
  playerName: string;
  status: 'online' | 'thinking' | 'submitted' | 'offline';
  resources: Record<string, IntelligenceData>;
  attributes: Record<string, IntelligenceData>;
  lastActivity: Date;
  overallConfidence: number; // 整体情报置信度
}

export interface IntelligenceUpdate {
  playerId: string;
  updates: Array<{
    attribute: string;
    value: number;
    confidence: number;
    source: IntelligenceData['source'];
  }>;
  timestamp: Date;
}

export type IntelDisplayMode = 'precise' | 'range' | 'rough' | 'unknown';

export interface IntelDisplayConfig {
  preciseThreshold: number; // >= 0.8 显示精确值
  rangeThreshold: number;   // >= 0.5 显示范围
  roughThreshold: number;   // >= 0.2 显示粗略估计
  // < 0.2 显示未知
}

export const DEFAULT_INTEL_CONFIG: IntelDisplayConfig = {
  preciseThreshold: 0.8,
  rangeThreshold: 0.5,
  roughThreshold: 0.2
};