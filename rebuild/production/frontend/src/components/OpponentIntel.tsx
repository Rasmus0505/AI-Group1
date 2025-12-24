import React from 'react';
import { Users, Zap, TrendingUp, Eye } from 'lucide-react';
import { Tooltip, Tag, Progress } from 'antd';

type ResourceKey = 'wealth' | 'power' | 'influence';

export interface IntelResource {
  value: number;
  min: number;
  max: number;
  confidence: number;
  lastUpdatedMinutesAgo: number;
  source: 'public_signal' | 'private_leak' | 'historical_model';
}

export interface OpponentIntelRecord {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'thinking';
  avatarColor?: string;
  resources: Record<ResourceKey, IntelResource>;
}

export interface OpponentIntelProps {
  opponents: OpponentIntelRecord[];
  onOpenPrivateChannel?: (opponentId: string) => void;
  onProbeIntel?: (opponentId: string) => void;
}

const SOURCE_LABEL: Record<IntelResource['source'], string> = {
  public_signal: '公开信号',
  private_leak: '内部消息',
  historical_model: '历史模型',
};

const STATUS_LABEL: Record<OpponentIntelRecord['status'], string> = {
  online: '在线',
  offline: '离线',
  thinking: '思考中',
};

const RESOURCE_META: Record<ResourceKey, { label: string; color: string; icon: React.ReactNode }> = {
  wealth: { label: '财富', color: '#f59e0b', icon: <TrendingUp size={12} /> },
  power: { label: '实力', color: '#ef4444', icon: <Zap size={12} /> },
  influence: { label: '影响力', color: '#3b82f6', icon: <Users size={12} /> },
};

const formatRangeText = (min: number, max: number) => {
  const format = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return v.toFixed(0);
  };
  return `${format(min)} - ${format(max)}`;
};

const OpponentIntel: React.FC<OpponentIntelProps> = ({
  opponents,
  onOpenPrivateChannel,
  onProbeIntel,
}) => {
  const renderValueCell = (key: ResourceKey, intel: IntelResource) => {
    const meta = RESOURCE_META[key];
    const displayValue = intel.confidence >= 0.6 
      ? intel.value.toLocaleString()
      : formatRangeText(intel.min, intel.max);

    const total = Math.max(intel.max, 1);
    const percent = Math.min(100, (intel.value / total) * 100);

    return (
      <Tooltip title={
        <div>
          <div>置信度: {Math.round(intel.confidence * 100)}%</div>
          <div>来源: {SOURCE_LABEL[intel.source]}</div>
          <div>更新: {intel.lastUpdatedMinutesAgo}分钟前</div>
        </div>
      }>
        <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
              <span style={{ color: meta.color }}>{meta.icon}</span>
              {meta.label}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
              {displayValue}
            </span>
          </div>
          <Progress percent={percent} size="small" strokeColor={meta.color} showInfo={false} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            <span>{SOURCE_LABEL[intel.source]}</span>
            <Tag color={intel.confidence >= 0.6 ? 'green' : intel.confidence >= 0.4 ? 'orange' : 'red'} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
              {Math.round(intel.confidence * 100)}%
            </Tag>
          </div>
        </div>
      </Tooltip>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Eye size={14} /> 对手情报 · 战争迷雾
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>实时分析</span>
      </div>

      {opponents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {opponents.map(op => (
            <div key={op.id} style={{ padding: 12, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onOpenPrivateChannel?.(op.id)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Users size={14} style={{ color: '#64748b' }} />
                  </button>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{op.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{STATUS_LABEL[op.status]}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onProbeIntel?.(op.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    fontSize: 11,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  探测
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.keys(RESOURCE_META) as ResourceKey[]).map(key => {
                  const intel = op.resources[key];
                  if (!intel) return null;
                  return <div key={key}>{renderValueCell(key, intel)}</div>;
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
          暂无对手情报数据
        </div>
      )}
    </div>
  );
};

export default OpponentIntel;
