import React from 'react';
import { Coins, Zap, Trophy } from 'lucide-react';
import { Progress } from 'antd';

interface ResourcePanelProps {
  playerAttributes?: Record<string, number | string>;
  opponents?: Array<{
    id: string;
    name: string;
    moneyMin: number;
    moneyMax: number;
    confidence: 'low' | 'medium' | 'high';
  }>;
}

const ResourcePanel: React.FC<ResourcePanelProps> = ({ playerAttributes = {}, opponents = [] }) => {
  const getResourceIcon = (key: string): React.ReactNode => {
    if (key.includes('金钱') || key.includes('money') || key.includes('元')) {
      return <Coins size={14} style={{ color: '#f59e0b' }} />;
    }
    if (key.includes('能量') || key.includes('energy')) {
      return <Zap size={14} style={{ color: '#3b82f6' }} />;
    }
    return <Trophy size={14} style={{ color: '#6366f1' }} />;
  };

  const getResourceColor = (key: string): string => {
    if (key.includes('金钱') || key.includes('money') || key.includes('元')) return '#f59e0b';
    if (key.includes('能量') || key.includes('energy')) return '#3b82f6';
    return '#6366f1';
  };

  const getMaxValue = (key: string, value: number): number => {
    if (key.includes('level') || key.includes('Level') || key.includes('等级')) return 100;
    if (key.includes('金钱') || key.includes('money') || key.includes('元')) {
      return Math.max(10000, value * 2);
    }
    return Math.max(100, value * 2);
  };

  const sortedAttributes = Object.entries(playerAttributes).sort(([keyA], [keyB]) => {
    const moneyKeywords = ['金钱', 'money', '元'];
    const aIsMoney = moneyKeywords.some(k => keyA.includes(k));
    const bIsMoney = moneyKeywords.some(k => keyB.includes(k));
    if (aIsMoney && !bIsMoney) return -1;
    if (!aIsMoney && bIsMoney) return 1;
    return 0;
  });

  const confidenceLabel = (level: 'low' | 'medium' | 'high') => {
    if (level === 'high') return '高置信度';
    if (level === 'medium') return '中置信度';
    return '低置信度';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          资源与属性
        </div>
        {sortedAttributes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedAttributes.map(([key, value]) => {
              const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
              const max = getMaxValue(key, numValue);
              const percent = Math.max(0, Math.min(100, (numValue / max) * 100));
              const color = getResourceColor(key);
              const icon = getResourceIcon(key);

              return (
                <div key={key} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
                      {icon} {key}
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {typeof value === 'string' ? value : numValue.toLocaleString()}
                    </span>
                  </div>
                  <Progress percent={percent} size="small" strokeColor={color} showInfo={false} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#94a3b8', padding: '16px 0', textAlign: 'center' }}>
            暂无资源数据
          </div>
        )}
      </div>

      {opponents.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            对手情报
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {opponents.map(o => (
              <div key={o.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{o.name}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{confidenceLabel(o.confidence)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  财富范围: <span style={{ fontFamily: 'monospace', color: '#374151' }}>
                    ${o.moneyMin.toLocaleString()} - ${o.moneyMax.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcePanel;
