/**
 * 情报计算工具
 * 根据置信度计算显示值和样式
 */

import { IntelligenceData, IntelDisplayMode, IntelDisplayConfig, DEFAULT_INTEL_CONFIG } from '../types/intelligence';

export class IntelligenceCalculator {
  private config: IntelDisplayConfig;

  constructor(config: IntelDisplayConfig = DEFAULT_INTEL_CONFIG) {
    this.config = config;
  }

  /**
   * 根据置信度确定显示模式
   */
  getDisplayMode(confidence: number): IntelDisplayMode {
    if (confidence >= this.config.preciseThreshold) return 'precise';
    if (confidence >= this.config.rangeThreshold) return 'range';
    if (confidence >= this.config.roughThreshold) return 'rough';
    return 'unknown';
  }

  /**
   * 计算显示值
   */
  calculateDisplayValue(intel: IntelligenceData): string {
    const mode = this.getDisplayMode(intel.confidence);
    
    switch (mode) {
      case 'precise':
        return this.formatPreciseValue(intel.value, intel.attribute);
        
      case 'range':
        return this.formatRangeValue(intel.value, intel.confidence);
        
      case 'rough':
        return this.formatRoughValue(intel.value);
        
      case 'unknown':
      default:
        return '???';
    }
  }

  /**
   * 格式化精确值
   */
  private formatPreciseValue(value: number, attribute: string): string {
    if (attribute.includes('现金') || attribute.includes('资金') || attribute.includes('cash')) {
      return `¥${value.toLocaleString()}`;
    }
    
    if (attribute.includes('份额') || attribute.includes('声誉') || attribute.includes('能力')) {
      return `${Math.round(value)}%`;
    }
    
    return value.toLocaleString();
  }

  /**
   * 格式化范围值
   */
  private formatRangeValue(value: number, confidence: number): string {
    // 根据置信度计算误差范围
    const errorMargin = (1 - confidence) * 0.3; // 最大30%误差
    const minValue = value * (1 - errorMargin);
    const maxValue = value * (1 + errorMargin);
    
    if (value >= 10000) {
      // 大数值用万为单位
      const minWan = Math.floor(minValue / 10000);
      const maxWan = Math.ceil(maxValue / 10000);
      return `${minWan}-${maxWan}万`;
    } else if (value >= 1000) {
      // 中等数值用千为单位
      const minK = Math.floor(minValue / 1000);
      const maxK = Math.ceil(maxValue / 1000);
      return `${minK}-${maxK}k`;
    } else {
      // 小数值直接显示范围
      return `${Math.floor(minValue)}-${Math.ceil(maxValue)}`;
    }
  }

  /**
   * 格式化粗略值
   */
  private formatRoughValue(value: number): string {
    if (value >= 100000) {
      return `~${Math.round(value / 10000)}万`;
    } else if (value >= 10000) {
      return `~${Math.round(value / 1000)}k`;
    } else if (value >= 100) {
      return `~${Math.round(value / 100) * 100}`;
    } else {
      return `~${Math.round(value / 10) * 10}`;
    }
  }

  /**
   * 获取置信度颜色
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#52c41a'; // 绿色 - 高置信度
    if (confidence >= 0.6) return '#1890ff'; // 蓝色 - 中高置信度
    if (confidence >= 0.4) return '#faad14'; // 橙色 - 中等置信度
    if (confidence >= 0.2) return '#ff7875'; // 红色 - 低置信度
    return '#d9d9d9'; // 灰色 - 极低置信度
  }

  /**
   * 获取信息来源描述
   */
  getSourceDescription(source: IntelligenceData['source']): string {
    switch (source) {
      case 'public_signal':
        return '公开信号';
      case 'private_leak':
        return '内部消息';
      case 'historical_model':
        return '历史模型';
      case 'direct_observation':
        return '直接观察';
      default:
        return '未知来源';
    }
  }

  /**
   * 获取信息来源图标
   */
  getSourceIcon(source: IntelligenceData['source']): string {
    switch (source) {
      case 'public_signal':
        return '📢';
      case 'private_leak':
        return '🔓';
      case 'historical_model':
        return '📊';
      case 'direct_observation':
        return '👁️';
      default:
        return '❓';
    }
  }

  /**
   * 计算信息新鲜度
   */
  calculateFreshness(lastUpdated: Date): {
    level: 'fresh' | 'recent' | 'stale' | 'outdated';
    description: string;
    color: string;
  } {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) {
      return {
        level: 'fresh',
        description: '刚刚更新',
        color: '#52c41a'
      };
    } else if (diffMinutes < 30) {
      return {
        level: 'recent',
        description: `${diffMinutes}分钟前`,
        color: '#1890ff'
      };
    } else if (diffMinutes < 120) {
      return {
        level: 'stale',
        description: `${Math.floor(diffMinutes / 60)}小时前`,
        color: '#faad14'
      };
    } else {
      return {
        level: 'outdated',
        description: '数据过时',
        color: '#ff4d4f'
      };
    }
  }

  /**
   * 生成模拟情报数据（用于演示和测试）
   */
  generateMockIntelligence(
    playerId: string,
    _playerName: string,
    baseValues: Record<string, number>,
    confidenceRange: [number, number] = [0.2, 0.9]
  ): Record<string, IntelligenceData> {
    const intelligence: Record<string, IntelligenceData> = {};
    const now = new Date();
    
    Object.entries(baseValues).forEach(([attribute, baseValue]) => {
      // 随机生成置信度
      const confidence = confidenceRange[0] + 
        Math.random() * (confidenceRange[1] - confidenceRange[0]);
      
      // 根据置信度添加噪声
      const noise = (1 - confidence) * 0.2; // 最大20%噪声
      const actualValue = baseValue * (1 + (Math.random() - 0.5) * noise);
      
      // 随机选择信息来源
      const sources: IntelligenceData['source'][] = [
        'public_signal', 'private_leak', 'historical_model', 'direct_observation'
      ];
      const source = sources[Math.floor(Math.random() * sources.length)];
      
      // 根据来源调整置信度
      let adjustedConfidence = confidence;
      switch (source) {
        case 'direct_observation':
          adjustedConfidence = Math.min(0.95, confidence + 0.2);
          break;
        case 'private_leak':
          adjustedConfidence = Math.min(0.9, confidence + 0.1);
          break;
        case 'historical_model':
          adjustedConfidence = Math.max(0.1, confidence - 0.1);
          break;
      }
      
      intelligence[attribute] = {
        playerId,
        attribute,
        value: Math.round(actualValue),
        confidence: Math.round(adjustedConfidence * 100) / 100,
        source,
        lastUpdated: new Date(now.getTime() - Math.random() * 30 * 60 * 1000), // 0-30分钟前
        reliability: adjustedConfidence
      };
    });
    
    return intelligence;
  }
}

export const intelCalculator = new IntelligenceCalculator();