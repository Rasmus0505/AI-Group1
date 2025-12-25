import React, { useState } from 'react';
import { Shield, Zap, AlertTriangle, Clock, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { TemporaryModifier, HexagramDefinition } from '../engine/types/rules';

interface RuleStatusBarProps {
  /** 活跃的临时修正器 */
  activeModifiers: TemporaryModifier[];
  /** 当前卦象 */
  currentHexagram?: HexagramDefinition;
  /** 当前回合 */
  currentRound: number;
  /** 是否可展开详情 */
  expandable?: boolean;
  /** 点击 Modifier 回调 */
  onModifierClick?: (modifier: TemporaryModifier) => void;
}

/**
 * RuleStatusBar - 规则状态栏组件（浅色玻璃态风格）
 * 显示当前生效的规则修正、卦象影响等
 * 让玩家在阅读叙事前就能明确本回合的"博弈边界"
 */
const RuleStatusBar: React.FC<RuleStatusBarProps> = ({
  activeModifiers,
  currentHexagram,
  currentRound,
  expandable = true,
  onModifierClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 按效果类型分组
  const buffModifiers = activeModifiers.filter(m => m.effectType === 'buff');
  const debuffModifiers = activeModifiers.filter(m => m.effectType === 'debuff');
  const neutralModifiers = activeModifiers.filter(m => m.effectType === 'neutral');

  // 获取效果类型样式
  const getEffectStyle = (effectType: TemporaryModifier['effectType']) => {
    switch (effectType) {
      case 'buff':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'debuff':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-600';
    }
  };

  // 获取效果类型图标
  const getEffectIcon = (effectType: TemporaryModifier['effectType']) => {
    switch (effectType) {
      case 'buff':
        return <Zap size={12} className="text-emerald-500" />;
      case 'debuff':
        return <AlertTriangle size={12} className="text-rose-500" />;
      default:
        return <Shield size={12} className="text-slate-400" />;
    }
  };

  // 获取卦象吉凶样式
  const getOmenStyle = (omen?: 'positive' | 'neutral' | 'negative') => {
    switch (omen) {
      case 'positive':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'negative':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-600';
    }
  };

  // 渲染单个 Modifier 标签
  const renderModifierTag = (modifier: TemporaryModifier, _compact = true) => (
    <div
      key={modifier.id}
      onClick={() => onModifierClick?.(modifier)}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs
        transition-all cursor-pointer hover:shadow-sm
        ${getEffectStyle(modifier.effectType)}
        ${onModifierClick ? 'hover:scale-105' : ''}
      `}
      title={modifier.description}
    >
      {modifier.icon && <span className="text-sm">{modifier.icon}</span>}
      {getEffectIcon(modifier.effectType)}
      <span className="font-medium">{modifier.name}</span>
      {modifier.duration !== -1 && (
        <span className="flex items-center gap-0.5 text-[10px] opacity-70">
          <Clock size={10} />
          {modifier.duration}
        </span>
      )}
    </div>
  );

  // 无任何规则修正时
  if (activeModifiers.length === 0 && !currentHexagram) {
    return (
      <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Shield size={14} />
          <span>第 {currentRound} 回合 · 无特殊规则修正</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl overflow-hidden">
      {/* 头部：回合信息和卦象 */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            第 {currentRound} 回合
          </span>
          
          {/* 卦象显示 */}
          {currentHexagram && (
            <div className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs
              ${getOmenStyle(currentHexagram.omen)}
            `}>
              <Sparkles size={12} />
              <span className="font-medium">{currentHexagram.name}</span>
              <span className="opacity-70">
                {currentHexagram.omen === 'positive' ? '吉' : 
                 currentHexagram.omen === 'negative' ? '凶' : '中'}
              </span>
            </div>
          )}
        </div>

        {/* 展开/收起按钮 */}
        {expandable && activeModifiers.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {isExpanded ? '收起' : '展开'}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>


      {/* 规则修正标签区 */}
      <div className="px-4 py-3">
        {/* 紧凑模式：只显示标签 */}
        {!isExpanded && (
          <div className="flex flex-wrap gap-2">
            {activeModifiers.slice(0, 5).map(m => renderModifierTag(m, true))}
            {activeModifiers.length > 5 && (
              <span className="text-xs text-slate-400 self-center">
                +{activeModifiers.length - 5} 更多
              </span>
            )}
          </div>
        )}

        {/* 展开模式：分组显示 */}
        {isExpanded && (
          <div className="space-y-4">
            {/* 增益效果 */}
            {buffModifiers.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-emerald-600">
                  <Zap size={12} />
                  增益效果 ({buffModifiers.length})
                </div>
                <div className="space-y-2">
                  {buffModifiers.map(m => (
                    <ModifierDetailCard key={m.id} modifier={m} onClick={onModifierClick} />
                  ))}
                </div>
              </div>
            )}

            {/* 减益效果 */}
            {debuffModifiers.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-rose-600">
                  <AlertTriangle size={12} />
                  减益效果 ({debuffModifiers.length})
                </div>
                <div className="space-y-2">
                  {debuffModifiers.map(m => (
                    <ModifierDetailCard key={m.id} modifier={m} onClick={onModifierClick} />
                  ))}
                </div>
              </div>
            )}

            {/* 中性效果 */}
            {neutralModifiers.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-slate-500">
                  <Shield size={12} />
                  中性效果 ({neutralModifiers.length})
                </div>
                <div className="space-y-2">
                  {neutralModifiers.map(m => (
                    <ModifierDetailCard key={m.id} modifier={m} onClick={onModifierClick} />
                  ))}
                </div>
              </div>
            )}

            {/* 卦象详情 */}
            {currentHexagram && (
              <div className={`p-3 rounded-lg border ${getOmenStyle(currentHexagram.omen)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} />
                  <span className="font-medium">{currentHexagram.name}</span>
                </div>
                <p className="text-xs opacity-80">{currentHexagram.text}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** Modifier 详情卡片 */
const ModifierDetailCard: React.FC<{
  modifier: TemporaryModifier;
  onClick?: (modifier: TemporaryModifier) => void;
}> = ({ modifier, onClick }) => {
  const getEffectStyle = (effectType: TemporaryModifier['effectType']) => {
    switch (effectType) {
      case 'buff':
        return 'bg-emerald-50 border-emerald-100';
      case 'debuff':
        return 'bg-rose-50 border-rose-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  const formatSource = (source: TemporaryModifier['source']) => {
    switch (source) {
      case 'hexagram': return '卦象';
      case 'event': return '事件';
      case 'achievement': return '成就';
      case 'decision': return '决策';
      case 'system': return '系统';
      default: return source;
    }
  };

  return (
    <div
      onClick={() => onClick?.(modifier)}
      className={`
        p-3 rounded-lg border transition-all
        ${getEffectStyle(modifier.effectType)}
        ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {modifier.icon && <span className="text-lg">{modifier.icon}</span>}
          <span className="font-medium text-sm">{modifier.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="px-1.5 py-0.5 bg-white/50 rounded">
            {formatSource(modifier.source)}
          </span>
          {modifier.duration !== -1 && (
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              {modifier.duration} 回合
            </span>
          )}
          {modifier.duration === -1 && (
            <span className="text-amber-600">永久</span>
          )}
        </div>
      </div>
      
      <p className="text-xs text-slate-600 mb-2">{modifier.description}</p>
      
      <div className="flex flex-wrap gap-1">
        {modifier.affectedAttributes.map(attr => (
          <span
            key={attr}
            className="text-[10px] px-1.5 py-0.5 bg-white/60 rounded text-slate-500"
          >
            {attr}
          </span>
        ))}
        {modifier.multiplier !== undefined && modifier.multiplier !== 1 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            modifier.multiplier > 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
          }`}>
            ×{modifier.multiplier.toFixed(2)}
          </span>
        )}
        {modifier.flatBonus !== undefined && modifier.flatBonus !== 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            modifier.flatBonus > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
          }`}>
            {modifier.flatBonus > 0 ? '+' : ''}{modifier.flatBonus}
          </span>
        )}
      </div>
    </div>
  );
};

export default RuleStatusBar;
