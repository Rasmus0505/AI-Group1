import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Space, Tag, Progress, message, List, Button, Row, Col, Empty
} from 'antd';
import {
  ChevronLeft, Loader2, ScrollText, CheckCircle2,
  AlertTriangle, Flag, TrendingUp, Sparkles, Activity, Trophy, BadgePercent
} from 'lucide-react';
import { gameAPI } from '../services/game';
import { wsService } from '../services/websocket';
import { useMessageRouter } from '../hooks/useMessageRouter';
import { GlassCard } from '../components/GlassCard';
import type { TurnResultDTO, TurnHexagram, TurnOption, TurnLedger } from '../types/turnResult';

// =========================
// Mock 数据与类型定义（UI 契约化）
// =========================

// 说明：此处的 mockTurnResult 只用于前端 UI 调试，
// 不依赖任何后端接口，便于先把“电影级叙事播放器 + 面板 + 排行榜”的交互做顺滑。
const mockTurnResult: TurnResultDTO = {
  narrative:
    '在连续三个季度的激进扩张后，公司现金流开始吃紧。董事会在深夜紧急会议上爆发激烈争执，有人主张继续押注新兴市场，有人坚持立即收缩战线。当会议进入白热化阶段，一则关于竞争对手“流动性恐慌”的匿名消息突然传入，会场气氛瞬间冻结。你必须在信息极度不对称的情况下，决定是发动价格战抢占份额，还是果断收缩保住现金安全。',
  events: [
    {
      keyword: '激进扩张',
      type: 'negative',
      description: '激进扩张导致现金流吃紧',
      resource: 'cash',
      newValue: 600,
    },
    {
      keyword: '流动性恐慌',
      type: 'negative',
      description: '竞争对手流动性恐慌',
      resource: 'cash',
      newValue: 300,
    },
    {
      keyword: '价格战',
      type: 'neutral',
      description: '价格战影响品牌声誉',
      resource: 'reputation',
      newValue: 40,
    },
  ],
  redactedSegments: [
    {
      start: 60,
      end: 90,
    },
  ],
  perEntityPanel: [
    {
      id: 'A',
      name: '主体 A',
      cash: 820,
      marketShare: 32,
      reputation: 68,
      innovation: 55,
      attributes: { '市场份额': 32, '品牌声誉': 68, '创新能力': 55 },
      passiveIncome: 120,
      passiveExpense: 80,
      delta: {
        cash: -80,
        marketShare: 2,
      },
      broken: false,
      achievementsUnlocked: ['稳健穿越波动'],
    },
    {
      id: 'B',
      name: '主体 B',
      cash: 640,
      marketShare: 28,
      reputation: 52,
      innovation: 47,
      attributes: { '市场份额': 28, '品牌声誉': 52, '创新能力': 47 },
      passiveIncome: 90,
      passiveExpense: 70,
      delta: {
        cash: -160,
      },
      broken: false,
      achievementsUnlocked: [],
    },
  ],
  leaderboard: [
    {
      id: 'A',
      name: '主体 A',
      score: 86,
      rank: 1,
      rankChange: 1,
    },
    {
      id: 'B',
      name: '主体 B',
      score: 74,
      rank: 2,
      rankChange: -1,
    },
  ],
  riskCard:
    '若继续高杠杆扩张，下一季度的资金安全垫可能跌破关键阈值，触发被动违约条款。',
  opportunityCard:
    '竞争对手的流动性恐慌为你打开价格战窗口，如果能控制节奏，有机会在短期内扩大市场份额。',
  benefitCard:
    '当前主业仍在产生稳定的正向经营现金流，为你争取了一定的调整空间。',
  achievements: [
    {
      id: 'achv_steady_hedge',
      entityId: 'A',
      title: '稳健穿越波动',
      description: '在市场剧烈波动中保持了正现金流与正净利。',
    },
  ],
  hexagram: {
    name: '乾',
    omen: 'positive',
    lines: ['yang', 'yang', 'yang', 'yang', 'yang', 'yang'],
    text: '天行健，君子以自强不息。',
    colorHint: '#4ade80',
  },
  options: [
    {
      id: '1',
      title: '价格战抢占份额',
      description: '短期降价换取市场占有率提升',
      expectedDelta: { cash: -0.1, marketShare: 0.05 },
    },
    {
      id: '2',
      title: '收缩防守保现金',
      description: '削减开支保现金流安全',
      expectedDelta: { cash: 0.02, reputation: -0.01 },
    },
    {
      id: '3',
      title: '投研创新拉估值',
      description: '加码研发，提升长期估值与声誉',
      expectedDelta: { innovation: 0.08, cash: -0.05 },
    },
  ],
  ledger: {
    startingCash: 1000,
    passiveIncome: 120,
    passiveExpense: 80,
    decisionCost: 150,
    balance: 890,
  },
  branchingNarratives: [
    '分支A：强攻价格战，份额+5%，现金-10%',
    '分支B：收缩防守，现金+2%，声誉-1%',
  ],
};

// =========================
// 电影式叙事播放器组件
// =========================

interface CinematicPlayerProps {
  narrative: string;
  events: TurnResultDTO['events'];
  onEventTriggered?: (event: TurnResultDTO['events'][number]) => void;
}

/**
 * CinematicPlayer 负责：
 * 1. 实现打字机效果逐字输出 narrative；
 * 2. 在输出过程中检测 keyword 是否已经出现在文本中，触发 onEventTriggered；
 * 3. 不关心具体资产如何变动，由父组件决定数值和动画表现。
 */
function CinematicPlayer(props: CinematicPlayerProps) {
  const { narrative, events, onEventTriggered } = props;

  const [displayedText, setDisplayedText] = useState('');
  const triggeredKeywordsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);
  // 使用 ref 存储 onEventTriggered 回调，避免因回调引用变化导致重新播放
  const onEventTriggeredRef = useRef(onEventTriggered);
  // 记录上一次的 narrative，只有内容真正变化时才重置播放
  const prevNarrativeRef = useRef<string>('');

  // 更新回调 ref（不触发重新渲染）
  useEffect(() => {
    onEventTriggeredRef.current = onEventTriggered;
  }, [onEventTriggered]);

  useEffect(() => {
    // 只有当 narrative 内容真正变化时才重新开始播放
    if (narrative === prevNarrativeRef.current) {
      return;
    }
    prevNarrativeRef.current = narrative;

    // 每次 narrative 变化时，从头开始播放
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setDisplayedText('');
    triggeredKeywordsRef.current = new Set();

    // 如果 narrative 为空，不启动定时器
    if (!narrative) {
      return;
    }

    let index = 0;
    intervalRef.current = window.setInterval(() => {
      if (index > narrative.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return;
      }

      const nextText = narrative.slice(0, index);
      setDisplayedText(nextText);

      // 监听关键字是否已经出现在已输出文本中，触发对应事件
      events.forEach(eventItem => {
        if (triggeredKeywordsRef.current.has(eventItem.keyword)) {
          return;
        }
        if (nextText.includes(eventItem.keyword)) {
          triggeredKeywordsRef.current.add(eventItem.keyword);
          if (onEventTriggeredRef.current) {
            onEventTriggeredRef.current(eventItem);
          }
        }
      });

      index += 1;
    }, 30);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [narrative, events]); // 移除 onEventTriggered 依赖，使用 ref 代替

  return (
    <p className="typewriter-cursor leading-relaxed text-xl font-serif">
      {displayedText}
    </p>
  );
}

// ...接口定义保持不变
interface InferenceResult {
  sessionId: string;
  round: number;
  status: 'processing' | 'completed' | 'failed';
  result?: {
    narrative?: string;
    outcomes?: Array<{
      playerIndex: number;
      outcome: string;
      resources?: Record<string, unknown>;
    }>;
    events?: Array<{
      type: string;
      description: string;
    }>;
    nextRoundHints?: string;
    uiTurnResult?: TurnResultDTO;
  };
  completedAt?: string;
  error?: string;
}

interface InferenceProgress {
  sessionId: string;
  round: number;
  progress: number;
  message: string;
}

function InferenceResultPage() {
  const { sessionId, round } = useParams<{ sessionId: string; round: string }>();
  const navigate = useNavigate();
  useMessageRouter();

  const [result, setResult] = useState<InferenceResult | null>(null);
  const [progress, setProgress] = useState<InferenceProgress | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  // 资产看板的本地状态（从后端数据初始化，用于动效演示）
  const [assets, setAssets] = useState<Record<string, number>>({});
  const [mutatingResource, setMutatingResource] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // 统一的回合结果视图模型：优先使用后端返回，AI处理中时显示空数据
  const turnResult: TurnResultDTO = useMemo(() => {
    // 如果 AI 正在处理中，返回空数据结构（不显示 mock 数据）
    if (!result || result.status === 'processing') {
      return {
        narrative: '',
        events: [],
        redactedSegments: [],
        perEntityPanel: [],
        leaderboard: [],
        riskCard: '',
        opportunityCard: '',
        benefitCard: '',
        achievements: [],
        hexagram: undefined,
        options: [],
        ledger: undefined,
        branchingNarratives: [],
        roundTitle: undefined,
        cashFlowWarning: undefined,
      };
    }
    
    // AI 完成后，使用真实数据
    if (result.status === 'completed' && result.result) {
      // 优先使用 uiTurnResult，如果不存在则从 result.result 直接获取
      const ui = result.result.uiTurnResult || result.result;
      // 核心剧情：优先使用 uiTurnResult.narrative，其次使用 result.result.narrative
      const narrative = result.result.uiTurnResult?.narrative || result.result.narrative || '';
      
      return {
        narrative: narrative,
        events: (ui as any).events || [],
        redactedSegments: (ui as any).redactedSegments || [],
        perEntityPanel: (ui as any).perEntityPanel || [],
        leaderboard: (ui as any).leaderboard || [],
        riskCard: (ui as any).riskCard || '',
        opportunityCard: (ui as any).opportunityCard || '',
        benefitCard: (ui as any).benefitCard || '',
        achievements: (ui as any).achievements || [],
        hexagram: (ui as any).hexagram,
        options: (ui as any).options || [],
        perEntityOptions: (ui as any).perEntityOptions || {},
        ledger: (ui as any).ledger,
        branchingNarratives: (ui as any).branchingNarratives || [],
        roundTitle: (ui as any).roundTitle,
        cashFlowWarning: (ui as any).cashFlowWarning,
      };
    }
    
    // 失败或其他状态，返回空数据
    return {
      narrative: '',
      events: [],
      redactedSegments: [],
      perEntityPanel: [],
      leaderboard: [],
      riskCard: '',
      opportunityCard: '',
      benefitCard: '',
      achievements: [],
      hexagram: undefined,
      options: [],
      perEntityOptions: {},
      ledger: undefined,
      branchingNarratives: [],
      roundTitle: undefined,
      cashFlowWarning: undefined,
    };
  }, [result]);
  const renderHexagram = (hexagram?: TurnHexagram) => {
    if (!hexagram) return null;
    const omenColor =
      hexagram.omen === 'positive'
        ? hexagram.colorHint || '#4ade80'
        : hexagram.omen === 'negative'
        ? hexagram.colorHint || '#f87171'
        : hexagram.colorHint || '#94a3b8';
    return (
      <GlassCard
        title="卦象"
        extra={<Sparkles size={18} />}
        className="border border-white/10 bg-slate-950/40"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold" style={{ color: omenColor }}>
              {hexagram.name}
            </div>
            <div className="text-xs uppercase tracking-widest text-slate-400 animate-pulse">
              {hexagram.omen}
            </div>
          </div>
          <div className="flex gap-1">
            {hexagram.lines.map((line, idx) => (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-full ${
                  line === 'yang' ? 'bg-slate-100' : 'bg-slate-500'
                }`}
                style={{ opacity: 0.85 }}
              />
            ))}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{hexagram.text}</p>
        </div>
      </GlassCard>
    );
  };

  const renderLedger = (ledger?: TurnLedger) => {
    if (!ledger) return null;
    const rows: Array<{ label: string; value: number; accent: string }> = [
      { label: '期初现金', value: ledger.startingCash, accent: 'text-slate-200' },
      { label: '被动收入', value: ledger.passiveIncome, accent: 'text-emerald-300' },
      { label: '被动支出', value: -ledger.passiveExpense, accent: 'text-rose-300' },
      { label: '决策成本', value: -ledger.decisionCost, accent: 'text-amber-300' },
      { label: '期末余额', value: ledger.balance, accent: 'text-sky-300' },
    ];
    return (
      <GlassCard title="财务核算中心" extra={<BadgePercent size={18} />}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="p-3 rounded bg-slate-900/40 border border-slate-800/60 flex items-center justify-between"
            >
              <span className="text-slate-400">{row.label}</span>
              <span className={`font-mono font-semibold ${row.accent}`}>
                {row.value >= 0 ? `+${row.value}` : row.value}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    );
  };

  const renderOptions = (options?: TurnOption[], perEntityOptions?: Record<string, TurnOption[]>) => {
    // 优先使用新格式 perEntityOptions（按主体分组）
    if (perEntityOptions && Object.keys(perEntityOptions).length > 0) {
      return (
        <GlassCard title="战略选项" extra={<Flag size={18} />}>
          <div className="space-y-4">
            {Object.entries(perEntityOptions).map(([entityId, entityOptions]) => (
              <div key={entityId} className="space-y-2">
                <div className="text-sm font-semibold text-slate-300 border-b border-slate-700/50 pb-1">
                  主体 {entityId} 的策略选项
                </div>
                <div className="space-y-3">
                  {entityOptions.map(opt => (
                    <div
                      key={opt.id}
                      className="p-3 rounded bg-slate-900/40 border border-slate-800/60"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-100 font-semibold">{opt.title}</span>
                        <span className="text-[10px] uppercase text-slate-500">#{opt.id}</span>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{opt.description}</p>
                      {opt.expectedDelta && (
                        <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                          {Object.entries(opt.expectedDelta).map(([key, val]) => {
                            const isCashField = key.toLowerCase().includes('cash') || key.toLowerCase().includes('金');
                            const isLargeNumber = Math.abs(val) > 100;
                            
                            let displayValue: string;
                            if (isCashField || isLargeNumber) {
                              displayValue = val >= 0 
                                ? `+${val.toLocaleString()}` 
                                : val.toLocaleString();
                            } else if (Math.abs(val) <= 1) {
                              displayValue = val >= 0 
                                ? `+${(val * 100).toFixed(0)}%` 
                                : `${(val * 100).toFixed(0)}%`;
                            } else {
                              displayValue = val >= 0 ? `+${val}` : `${val}`;
                            }
                            
                            return (
                              <Tag key={key} color={val >= 0 ? 'green' : 'red'}>
                                {key}: {displayValue}
                              </Tag>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      );
    }
    
    // 兼容旧格式 options（全局选项）
    if (!options || options.length === 0) return null;
    return (
      <GlassCard title="战略选项" extra={<Flag size={18} />}>
        <div className="space-y-3">
          {options.map(opt => (
            <div
              key={opt.id}
              className="p-3 rounded bg-slate-900/40 border border-slate-800/60"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-100 font-semibold">{opt.title}</span>
                <span className="text-[10px] uppercase text-slate-500">#{opt.id}</span>
              </div>
              <p className="text-sm text-slate-300 mb-2">{opt.description}</p>
              {opt.expectedDelta && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                  {Object.entries(opt.expectedDelta).map(([key, val]) => {
                    // 智能格式化：cash 类字段显示为金额，其他字段根据数值大小判断
                    const isCashField = key.toLowerCase().includes('cash') || key.toLowerCase().includes('金');
                    const isLargeNumber = Math.abs(val) > 100;
                    
                    let displayValue: string;
                    if (isCashField || isLargeNumber) {
                      // 大数值显示为金额格式
                      displayValue = val >= 0 
                        ? `+${val.toLocaleString()}` 
                        : val.toLocaleString();
                    } else if (Math.abs(val) <= 1) {
                      // 小数值（0-1之间）显示为百分比
                      displayValue = val >= 0 
                        ? `+${(val * 100).toFixed(0)}%` 
                        : `${(val * 100).toFixed(0)}%`;
                    } else {
                      // 中等数值直接显示
                      displayValue = val >= 0 ? `+${val}` : `${val}`;
                    }
                    
                    return (
                      <Tag key={key} color={val >= 0 ? 'green' : 'red'}>
                        {key}: {displayValue}
                      </Tag>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    );
  };

  const renderEntityPanel = (panels?: TurnResultDTO['perEntityPanel']) => {
    if (!panels || panels.length === 0) return null;
    return (
      <GlassCard title="主体状态面板" extra={<TrendingUp size={18} />}>
        <div className="space-y-4">
          {panels.map(entity => (
            <div
              key={entity.id}
              className={`p-4 rounded-lg border ${
                entity.broken
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-slate-900/40 border-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-100">{entity.name}</span>
                  <Tag color={entity.broken ? 'error' : 'default'} className="text-[10px]">
                    {entity.id}
                  </Tag>
                </div>
                {entity.broken && (
                  <Tag color="error">已破产</Tag>
                )}
              </div>
              
              {/* 核心资源 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded bg-slate-800/40">
                  <span className="text-[10px] text-slate-400 uppercase">现金</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-mono text-emerald-300">
                      ¥{entity.cash?.toLocaleString() || 0}
                    </span>
                    {entity.delta?.cash && (
                      <span className={`text-xs ${entity.delta.cash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {entity.delta.cash >= 0 ? '+' : ''}{entity.delta.cash.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-800/40">
                  <span className="text-[10px] text-slate-400 uppercase">净收支</span>
                  <div className="text-sm font-mono">
                    <span className="text-emerald-300">+{entity.passiveIncome || 0}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-rose-300">-{entity.passiveExpense || 0}</span>
                  </div>
                </div>
              </div>
              
              {/* 动态属性 */}
              {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(entity.attributes).map(([key, value]) => (
                    <div key={key} className="px-2 py-1 rounded bg-slate-800/40 text-xs">
                      <span className="text-slate-400">{key}: </span>
                      <span className="text-slate-200 font-mono">{value}</span>
                      {entity.delta?.[key] && (
                        <span className={`ml-1 ${Number(entity.delta[key]) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {Number(entity.delta[key]) >= 0 ? '+' : ''}{entity.delta[key]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* 成就 */}
              {entity.achievementsUnlocked && entity.achievementsUnlocked.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entity.achievementsUnlocked.map((ach, idx) => (
                    <Tag key={idx} color="gold" className="text-[10px]">
                      🏆 {ach}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    );
  };

  const renderBranching = (branching?: string[]) => {
    if (!branching || branching.length === 0) return null;
    return (
      <GlassCard title="分支叙事" extra={<ScrollText size={18} />}>
        <div className="space-y-2 text-sm text-slate-200">
          {branching.map((line, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-slate-900/40 border border-slate-800/60"
            >
              {line}
            </div>
          ))}
        </div>
      </GlassCard>
    );
  };

  const loadResult = async () => {
    if (!sessionId || !round) return;
    try {
      // 首先尝试从 inference-result 接口获取
      const data = await gameAPI.getInferenceResult(sessionId, Number(round));
      setResult(data);
      
      // 如果 narrative 为空，尝试从 getGameState 获取（与 GameSession 保持一致）
      if (data.status === 'completed' && !data.result?.uiTurnResult?.narrative && !data.result?.narrative) {
        try {
          const state = await gameAPI.getGameState(sessionId);
          const rawResult = state.inferenceResult?.result as any;
          if (rawResult?.uiTurnResult?.narrative || rawResult?.narrative) {
            // 合并数据
            setResult({
              ...data,
              result: {
                ...data.result,
                narrative: rawResult?.narrative || data.result?.narrative,
                uiTurnResult: rawResult?.uiTurnResult || data.result?.uiTurnResult,
              },
            });
          }
        } catch {
          // 忽略备选数据源失败
        }
      }
      
      // 获取会话信息以获取 roomId（用于加入 WebSocket 房间）
      if (!roomId) {
        try {
          const sessionData = await gameAPI.getSession(sessionId);
          if (sessionData.roomId) {
            setRoomId(sessionData.roomId);
          }
        } catch {
          // 忽略获取会话信息失败
        }
      }
    } catch (err: any) {
      // 如果 inference-result 接口失败，尝试从 getGameState 获取
      try {
        const state = await gameAPI.getGameState(sessionId);
        const rawResult = state.inferenceResult?.result as any;
        if (rawResult) {
          setResult({
            sessionId,
            round: Number(round),
            status: state.inferenceResult?.status === 'completed' ? 'completed' : 'processing',
            result: {
              narrative: rawResult?.narrative,
              uiTurnResult: rawResult?.uiTurnResult,
              outcomes: rawResult?.outcomes,
              events: rawResult?.events,
              nextRoundHints: rawResult?.nextRoundHints,
            },
            completedAt: state.inferenceResult?.completedAt,
          });
          return;
        }
      } catch {
        // 忽略备选数据源失败
      }
      message.error('同步结果失败');
    }
  };

  /**
   * 当 CinematicPlayer 检测到关键字并触发事件时，更新资产并触发动效。
   */
  const handleEventTriggered = (eventItem: TurnResultDTO['events'][number]) => {
    // 更新资产数值（数值突变）
    const resourceKey = eventItem.resource || eventItem.affectedResource;
    if (resourceKey && eventItem.newValue !== undefined) {
      setAssets(prev => ({
        ...prev,
        [resourceKey]: eventItem.newValue as number,
      }));

      // 标记当前正在突变的资源，用于抖动和变红动画
      setMutatingResource(resourceKey);
    }

    // 短暂的全屏白闪效果
    setFlashActive(true);
    window.setTimeout(() => {
      setFlashActive(false);
    }, 100);

    // 抖动效果持续一小段时间后复位
    window.setTimeout(() => {
      setMutatingResource(null);
    }, 400);
  };

  useEffect(() => {
    loadResult();
    
    // 加入房间以接收 WebSocket 广播事件
    if (roomId) {
      wsService.trackRoom(roomId);
      wsService.send('join_room', { roomId });
    }
    
    const handleProgress = (p: any) => setProgress(p);
    const handleCompleted = () => loadResult();
    const handleFailed = (payload: any) => {
      const errorData = payload as { error?: string; details?: string };
      setResult({
        sessionId: sessionId || '',
        round: Number(round) || 0,
        status: 'failed',
        error: errorData.error || '推演失败',
        completedAt: new Date().toISOString(),
      });
    };
    
    // 游戏终止事件：主持人终止游戏后，玩家自动返回房间
    const handleGameFinished = (payload: any) => {
      // 检查是否是当前会话的终止事件
      if (payload.sessionId === sessionId || (roomId && payload.roomId === roomId)) {
        const reason = payload.reason;
        if (reason === 'terminated_by_host') {
          message.warning('主持人已终止游戏，正在返回房间...');
        } else if (reason === 'reset_by_host') {
          message.warning('主持人已重置房间，正在返回房间...');
        } else {
          message.info('游戏已结束，正在返回房间...');
        }
        // 延迟一小段时间让用户看到提示，然后跳转
        setTimeout(() => {
          if (roomId) {
            navigate(`/rooms/${roomId}/waiting`);
          } else {
            navigate('/rooms');
          }
        }, 1500);
      }
    };
    
    wsService.on('inference_progress', handleProgress);
    wsService.on('inference_completed', handleCompleted);
    wsService.on('inference_failed', handleFailed);
    wsService.on('game_finished', handleGameFinished);
    return () => {
      // 离开房间
      if (roomId) {
        wsService.untrackRoom(roomId);
      }
      wsService.off('inference_progress', handleProgress);
      wsService.off('inference_completed', handleCompleted);
      wsService.off('inference_failed', handleFailed);
      wsService.off('game_finished', handleGameFinished);
    };
  }, [sessionId, round, roomId, navigate]);

  return (
    <div className="min-h-screen p-8 text-slate-200 relative overflow-hidden">
      {/* 全屏白闪遮罩：仅在 flashActive 为 true 时短暂出现 */}
      {flashActive && (
        <div className="fixed inset-0 bg-white/80 pointer-events-none z-40" />
      )}
      <header className="max-w-6xl mx-auto mb-8 flex justify-between items-center">
        <Space size="large">
          <Button ghost icon={<ChevronLeft size={16} />} onClick={() => navigate(`/game/${sessionId}`)}>
            返回战场
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tech-gradient-text uppercase tracking-widest">推演视界</h1>
            <span className="text-xs text-slate-500">
              {turnResult.roundTitle || `SESSION: ${sessionId} · ROUND: ${round}`}
            </span>
          </div>
        </Space>
        {result?.status === 'processing' && (
          <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
            <Loader2 className="animate-spin" size={20} />
            <span className="font-bold tracking-tighter">AI INFERRING...</span>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto">
        <Row gutter={24}>
          <Col span={16}>
            <GlassCard title="核心叙事" extra={<ScrollText size={18} />}>
              <div className="min-h-[400px] p-8 bg-slate-950/40 rounded-xl leading-relaxed text-xl font-serif">
                {!result || result.status === 'processing' ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 opacity-40">
                    <Sparkles size={48} className="mb-4" />
                    <p>正在重构因果链路，构筑时空分叉...</p>
                  </div>
                ) : result.status === 'failed' ? (
                  <div className="flex flex-col items-center justify-center h-full py-20">
                    <AlertTriangle size={48} className="mb-4 text-rose-500" />
                    <p className="text-rose-400 font-bold mb-2">推演失败</p>
                    <p className="text-slate-400 text-sm text-center max-w-md">
                      {result.error || 'AI API调用失败，请检查API配置'}
                    </p>
                    {result.error?.includes('API') && (
                      <p className="text-slate-500 text-xs text-center mt-4 max-w-md">
                        提示：请检查主持人配置中的API端点、API密钥是否正确，或使用测试脚本验证API连接
                      </p>
                    )}
                  </div>
                ) : turnResult.narrative ? (
                  <CinematicPlayer
                    narrative={turnResult.narrative}
                    events={turnResult.events}
                    onEventTriggered={handleEventTriggered}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 opacity-40">
                    <ScrollText size={48} className="mb-4" />
                    <p>暂无叙事内容</p>
                    <p className="text-sm text-slate-500 mt-2">AI推演结果中未包含核心剧情</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {renderBranching(turnResult.branchingNarratives)}
            {renderOptions(turnResult.options, turnResult.perEntityOptions)}
            {renderEntityPanel(turnResult.perEntityPanel)}

            {result?.result?.nextRoundHints && (
              <GlassCard title="先导提示" className="border-indigo-500/30">
                <div className="flex gap-4">
                  <Flag className="text-indigo-400 shrink-0" size={24} />
                  <p className="text-slate-300 italic">{result.result.nextRoundHints}</p>
                </div>
              </GlassCard>
            )}
          </Col>

          <Col span={8}>
            {renderHexagram(turnResult.hexagram)}
            {renderLedger(turnResult.ledger)}
            {result?.status === 'processing' && (
              <GlassCard title="计算进度" extra={<Activity size={18} />}>
                <Progress
                  percent={progress?.progress || 0}
                  strokeColor={{ '0%': '#6366f1', '100%': '#a5b4fc' }}
                  status="active"
                />
                <p className="mt-4 text-xs text-slate-400">{progress?.message || '初始化计算单元...'}</p>
              </GlassCard>
            )}

            <GlassCard title="实体变动" extra={<TrendingUp size={18} />}>
              <div className="space-y-3">
                {Object.entries(assets).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-3 bg-white/5 rounded border border-white/10 flex justify-between items-center"
                  >
                    <span className="text-xs uppercase tracking-widest text-slate-400">
                      {key}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        mutatingResource === key
                          ? 'text-red-400 animate-bounce'
                          : 'text-slate-50'
                      }`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* 简版排行榜视图：使用 TurnResultDTO 的 leaderboard */}
            {turnResult.leaderboard.length > 0 && (
              <GlassCard title="排行榜" extra={<Flag size={18} />}>
                <div className="space-y-2 text-xs">
                  {turnResult.leaderboard.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-900/40 border border-slate-800/60"
                    >
                      <span className="font-mono text-slate-300">
                        #{entry.rank} {entry.name}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span className="font-mono text-sm">{entry.score}</span>
                        {typeof entry.rankChange === 'number' && entry.rankChange !== 0 && (
                          <span className="text-[10px] text-slate-500">
                            {entry.rankChange > 0
                              ? `▲${entry.rankChange}`
                              : `▼${Math.abs(entry.rankChange)}`}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* 本回合三卡片：风险 / 机会 / 效益 */}
            <GlassCard title="本回合评估" extra={<CheckCircle2 size={18} />}>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="mt-[2px] text-rose-400 font-mono text-[10px] tracking-widest">
                    风险
                  </span>
                  <p className="leading-snug">
                    {typeof turnResult.riskCard === 'string' ? turnResult.riskCard : turnResult.riskCard?.summary}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-[2px] text-emerald-400 font-mono text-[10px] tracking-widest">
                    机会
                  </span>
                  <p className="leading-snug">
                    {typeof turnResult.opportunityCard === 'string' ? turnResult.opportunityCard : turnResult.opportunityCard?.summary}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-[2px] text-sky-400 font-mono text-[10px] tracking-widest">
                    效益
                  </span>
                  <p className="leading-snug">
                    {typeof turnResult.benefitCard === 'string' ? turnResult.benefitCard : turnResult.benefitCard?.summary}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* 现金流警告 */}
            {turnResult.cashFlowWarning && turnResult.cashFlowWarning.length > 0 && (
              <GlassCard title="现金流警告" extra={<AlertTriangle size={18} className="text-rose-400" />}>
                <div className="space-y-2">
                  {turnResult.cashFlowWarning.map((warning, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border-l-2 pl-3 ${
                        warning.severity === 'critical'
                          ? 'bg-rose-500/20 border-rose-500'
                          : 'bg-amber-500/20 border-amber-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Tag color={warning.severity === 'critical' ? 'error' : 'warning'} className="text-[10px]">
                          {warning.severity === 'critical' ? '危急' : '警告'}
                        </Tag>
                        <span className="text-xs text-slate-300">{warning.entityId}</span>
                      </div>
                      <p className="text-xs text-slate-200">{warning.message}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* 成就解锁列表：使用 List / Empty 展示 TurnResultDTO 的 achievements */}
            <GlassCard title="成就解锁" extra={<Trophy size={18} />}>
              {turnResult.achievements.length > 0 ? (
              <List
                  size="small"
                  dataSource={turnResult.achievements}
                renderItem={item => (
                    <List.Item style={{ paddingInline: 8 }}>
                      <div className="flex flex-col gap-0.5 w-full">
                        <span className="text-xs text-slate-200 font-medium">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-slate-400">{item.description}</span>
                    </div>
                    </List.Item>
                )}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="本回合暂无特殊成就"
              />
              )}
            </GlassCard>

            <GlassCard title="突发事件" extra={<AlertTriangle size={18} />}>
              {result?.result?.events?.map((ev, i) => (
                <div key={i} className="mb-2 p-2 bg-rose-500/10 border-l-2 border-rose-500 pl-3">
                  <Tag color="error" className="mb-1">{ev.type}</Tag>
                  <p className="text-xs">{ev.description}</p>
                </div>
              )) || <p className="text-slate-500 text-xs text-center py-4">无突发情况</p>}
            </GlassCard>
          </Col>
        </Row>
      </main>
    </div>
  );
}

export default InferenceResultPage;
