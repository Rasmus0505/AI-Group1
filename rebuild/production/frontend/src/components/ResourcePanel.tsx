import React from 'react';
import { Shield, Sword, Eye, Trophy, Coins, Zap } from 'lucide-react';

interface ResourcePanelProps {
  /** 玩家属性对象（动态，从 gameState.players[me].attributes 读取） */
  playerAttributes?: Record<string, number | string>;
  /** 对手情报（可选，用于高级视图） */
  opponents?: Array<{
    id: string;
    name: string;
    moneyMin: number;
    moneyMax: number;
    confidence: 'low' | 'medium' | 'high';
  }>;
}

/**
 * ResourcePanel - 数据驱动的资源面板
 * - 动态读取 gameState.players[me].attributes 对象
 * - 核心固定属性："金钱（元）"
 * - 其他属性（如"原材料"、"影响力"等）由 AI 推演动态添加
 * - 对手情报显示（可选，用于高级视图）
 */
const ResourcePanel: React.FC<ResourcePanelProps> = ({ playerAttributes = {}, opponents = [] }) => {
  // 资源图标映射（根据属性名自动选择图标）
  const getResourceIcon = (key: string): React.ReactNode => {
    const iconMap: Record<string, React.ReactNode> = {
      '金钱': <Coins size={14} className="text-yellow-400" />,
      'money': <Coins size={14} className="text-yellow-400" />,
      '元': <Coins size={14} className="text-yellow-400" />,
      '能量': <Zap size={14} className="text-blue-400" />,
      'energy': <Zap size={14} className="text-blue-400" />,
      'force': <Sword size={14} className="text-red-400" />,
      'influence': <Shield size={14} className="text-sky-400" />,
      'intelLevel': <Eye size={14} className="text-emerald-400" />,
    };
    
    // 尝试匹配（支持中英文）
    const lowerKey = key.toLowerCase();
    for (const [mapKey, icon] of Object.entries(iconMap)) {
      if (lowerKey.includes(mapKey.toLowerCase()) || key.includes(mapKey)) {
        return icon;
      }
    }
    
    // 默认图标
    return <Trophy size={14} className="text-slate-400" />;
  };

  // 资源颜色映射
  const getResourceColor = (key: string): string => {
    const colorMap: Record<string, string> = {
      '金钱': 'bg-yellow-500',
      'money': 'bg-yellow-500',
      '元': 'bg-yellow-500',
      '能量': 'bg-blue-500',
      'energy': 'bg-blue-500',
      'force': 'bg-red-500',
      'influence': 'bg-sky-500',
      'intelLevel': 'bg-emerald-500',
    };
    
    const lowerKey = key.toLowerCase();
    for (const [mapKey, color] of Object.entries(colorMap)) {
      if (lowerKey.includes(mapKey.toLowerCase()) || key.includes(mapKey)) {
        return color;
      }
    }
    
    return 'bg-indigo-500'; // 默认颜色
  };

  // 计算最大值（用于进度条）
  const getMaxValue = (key: string, value: number): number => {
    // 如果是百分比类型（0-100），返回100
    if (key.includes('level') || key.includes('Level') || key.includes('等级')) {
      return 100;
    }
    // 如果是金额类型，使用合理的最大值
    if (key.includes('金钱') || key.includes('money') || key.includes('元')) {
      return Math.max(10000, value * 2); // 至少10000，或当前值的2倍
    }
    // 默认返回当前值的2倍或100，取较大值
    return Math.max(100, value * 2);
  };

  const renderBar = (label: string, value: number | string, icon: React.ReactNode, color: string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    const max = getMaxValue(label, numValue);
    const percent = Math.max(0, Math.min(100, (numValue / max) * 100));
    
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            {icon}
            {label}
          </span>
          <span className="font-mono text-slate-100">
            {typeof value === 'string' ? value : numValue.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  const confidenceLabel = (level: OpponentIntel['confidence']) => {
    if (level === 'high') return 'High confidence';
    if (level === 'medium') return 'Medium confidence';
    return 'Low confidence';
  };

  // 优先显示"金钱"（核心固定属性）
  const sortedAttributes = Object.entries(playerAttributes).sort(([keyA], [keyB]) => {
    const moneyKeywords = ['金钱', 'money', '元'];
    const aIsMoney = moneyKeywords.some(k => keyA.includes(k));
    const bIsMoney = moneyKeywords.some(k => keyB.includes(k));
    if (aIsMoney && !bIsMoney) return -1;
    if (!aIsMoney && bIsMoney) return 1;
    return 0;
  });

  return (
    <aside className="h-full flex flex-col bg-[#0b0b0d] border border-slate-800 rounded-2xl px-4 py-4 gap-4">
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-[0.25em] mb-2">
          资源与属性
        </div>
        {sortedAttributes.length > 0 ? (
          sortedAttributes.map(([key, value]) => {
            const icon = getResourceIcon(key);
            const color = getResourceColor(key);
            return renderBar(key, value, icon, color);
          })
        ) : (
          <div className="text-xs text-slate-500 py-4 text-center">
            暂无资源数据
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-300 flex items-center gap-1">
            <Eye size={14} className="text-slate-400" />
            Opponent intel
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Partial</span>
        </div>
        <div className="space-y-2 text-xs overflow-y-auto">
          {opponents.map(o => (
            <div
              key={o.id}
              className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 flex flex-col"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-200 font-medium">{o.name}</span>
                <span className="text-[10px] text-slate-500">{confidenceLabel(o.confidence)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                <span className="mr-1">Money window:</span>
                {/* 模糊呈现的范围文本，实现“非完全信息”遮蔽效果 */}
                <span className="font-mono text-slate-300 blur-sm hover:blur-none transition">
                  ${o.moneyMin.toLocaleString()} - ${o.moneyMax.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {opponents.length === 0 && (
            <div className="text-[11px] text-slate-500">No intel collected yet.</div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ResourcePanel;


