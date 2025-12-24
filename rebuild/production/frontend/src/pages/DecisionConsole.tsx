import React, { useMemo, useState } from 'react';
import { Card, Progress, Input, Button, Divider, Tag, Typography, Modal, Alert, Table, Spin } from 'antd';
import { Activity, TrendingUp, ShieldCheck, Zap, Layers, BookOpen, BarChart2 } from 'lucide-react';
import { TurnResultDTO, TurnLedger, TurnHexagram, TurnOption, TurnEntityPanel } from '../types/turnResult';
import DivinationOverlay from '../components/DivinationOverlay';

const { Title, Text, Paragraph } = Typography;

type PaletteKey = 'deepBlue' | 'darkGold' | 'inkGreen' | 'roseCopper';

const palette: Record<PaletteKey, { text: string; border: string; bg: string }> = {
  deepBlue: { text: 'text-blue-200', border: 'border-blue-500/60', bg: 'bg-blue-500/10' },
  darkGold: { text: 'text-amber-200', border: 'border-amber-500/60', bg: 'bg-amber-500/10' },
  inkGreen: { text: 'text-emerald-200', border: 'border-emerald-500/60', bg: 'bg-emerald-500/10' },
  roseCopper: { text: 'text-rose-200', border: 'border-rose-500/60', bg: 'bg-rose-500/10' },
};

const getEntityPalette = (entity: TurnEntityPanel) => {
  const key = (entity.paletteKey as PaletteKey) || 'deepBlue';
  return palette[key] || palette.deepBlue;
};

const mockHexagram: TurnHexagram = {
  name: '风雷益',
  omen: 'positive',
  lines: ['yang', 'yin', 'yang', 'yang', 'yin', 'yin'],
  text: '利用安身立命，利涉大川。',
  colorHint: '#34d399',
};

const mockLedger: TurnLedger = {
  startingCash: 1200000,
  passiveIncome: 180000,
  passiveExpense: 90000,
  decisionCost: 220000,
  balance: 1110000,
};

const mockOptions: TurnOption[] = [
  {
    id: 'opt-1',
    title: '加码研发与渠道合作',
    description: '聚焦 5G 终端渠道，换取核心渠道覆盖。',
    expectedDelta: { cash: -8, marketShare: 12, reputation: 6 },
  },
  {
    id: 'opt-2',
    title: '压缩成本，稳健扩张',
    description: '降低可变成本，推迟大额扩产。',
    expectedDelta: { cash: 6, marketShare: -3, reputation: 2 },
  },
  {
    id: 'opt-3',
    title: '海外市场试探投放',
    description: '小额试投，验证区域增长弹性。',
    expectedDelta: { cash: -2, marketShare: 5, reputation: 4 },
  },
];

const mockEntities: TurnEntityPanel[] = [
  {
    id: 'A',
    name: '主体 A',
    cash: 520000,
    marketShare: 24,
    reputation: 68,
    innovation: 72,
    passiveIncome: 80000,
    passiveExpense: 45000,
    delta: { cash: 20000, marketShare: 2 },
    broken: false,
    achievementsUnlocked: [],
    creditRating: 'A-',
    paletteKey: 'deepBlue',
    accentColor: '#38bdf8',
  },
  {
    id: 'B',
    name: '主体 B',
    cash: 410000,
    marketShare: 21,
    reputation: 61,
    innovation: 64,
    passiveIncome: 70000,
    passiveExpense: 40000,
    delta: { cash: -15000, marketShare: -1 },
    broken: false,
    achievementsUnlocked: [],
    creditRating: 'BBB+',
    paletteKey: 'darkGold',
    accentColor: '#f59e0b',
  },
  {
    id: 'C',
    name: '主体 C',
    cash: 330000,
    marketShare: 18,
    reputation: 57,
    innovation: 58,
    passiveIncome: 60000,
    passiveExpense: 38000,
    delta: { cash: 10000, marketShare: 1 },
    broken: false,
    achievementsUnlocked: [],
    creditRating: 'BBB',
    paletteKey: 'inkGreen',
    accentColor: '#34d399',
  },
  {
    id: 'D',
    name: '主体 D',
    cash: 280000,
    marketShare: 16,
    reputation: 55,
    innovation: 52,
    passiveIncome: 55000,
    passiveExpense: 36000,
    delta: { cash: -5000, marketShare: 0 },
    broken: false,
    achievementsUnlocked: [],
    creditRating: 'BB+',
    paletteKey: 'roseCopper',
    accentColor: '#fb7185',
  },
];

const mockTurnResult: TurnResultDTO = {
  narrative:
    '本季度，渠道战与成本战交织，主体 A 率先加码 5G 终端合作，带动市场份额回升；主体 B 收缩开支，现金流趋稳；主体 C 小步试探海外市场；主体 D 继续稳健运营，观察行业风向。',
  events: [
    { keyword: '渠道合作', resource: 'marketShare', newValue: 24 },
    { keyword: '成本压缩', resource: 'cash', newValue: 410000 },
  ],
  perEntityPanel: mockEntities,
  leaderboard: [
    { id: 'A', name: '主体 A', score: 640, rank: 1, rankChange: 1 },
    { id: 'B', name: '主体 B', score: 590, rank: 2, rankChange: -1 },
    { id: 'C', name: '主体 C', score: 540, rank: 3, rankChange: 0 },
    { id: 'D', name: '主体 D', score: 500, rank: 4, rankChange: 0 },
  ],
  riskCard: '渠道依赖度提升，需防范单点失效。',
  opportunityCard: '海外小额试投反馈良好，可评估扩大规模。',
  benefitCard: '被动收入稳定，现金流安全边际尚可。',
  achievements: [],
  hexagram: mockHexagram,
  options: mockOptions,
  ledger: mockLedger,
  branchingNarratives: ['主线：渠道扩张', '分支：成本压缩试验', '分支：海外试投'],
  redactedSegments: [],
  nextRoundHints: '关注渠道谈判续约与海外投放 ROI。',
};

const formatDelta = (expected?: Record<string, number>) => {
  if (!expected) return '—';
  const entries = Object.entries(expected);
  if (!entries.length) return '—';
  return entries
    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}%`)
    .join(' / ');
};

const DeltaBadge: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-slate-400">{label}</span>
    <span className={value >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
      {value >= 0 ? '+' : ''}
      {value}
    </span>
  </div>
);

const HexagramLines: React.FC<{ lines: Array<'yang' | 'yin'>; colorHint?: string }> = ({ lines, colorHint }) => (
  <div className="flex flex-col gap-1 text-sm tracking-widest" style={{ color: colorHint || '#a5f3fc' }}>
    {lines.map((line, idx) => (
      <div key={idx} className="flex items-center gap-1">
        <span className="text-xs text-slate-400">第 {idx + 1} 爻</span>
        <div className="flex-1 h-1 rounded bg-slate-600 overflow-hidden">
          <div
            className={`h-full ${line === 'yang' ? 'bg-cyan-300' : 'bg-slate-300'}`}
            style={{ width: line === 'yang' ? '100%' : '45%' }}
          />
        </div>
        <span className="uppercase text-slate-300 text-[11px]">{line}</span>
      </div>
    ))}
  </div>
);

const DecisionConsole: React.FC<{ turnResult?: TurnResultDTO }> = ({ turnResult = mockTurnResult }) => {
  const [introVisible, setIntroVisible] = useState(true);
  const [ritualVisible, setRitualVisible] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [bankruptVisible, setBankruptVisible] = useState(false);
  const hexagram = useMemo(() => turnResult.hexagram || mockHexagram, [turnResult]);
  const ledger = useMemo(() => turnResult.ledger || mockLedger, [turnResult]);
  const options = useMemo(() => turnResult.options || mockOptions, [turnResult]);
  const entities = useMemo(() => turnResult.perEntityPanel || mockEntities, [turnResult]);
  const cashCoverage =
    ledger.passiveExpense > 0 ? ledger.balance / ledger.passiveExpense : Infinity;
  const isCashWarning = cashCoverage <= 1.2; // 余额接近被动支出临界
  const hasBankrupt = entities.some(e => e.cash <= 0 || e.broken);
  const [ritualActive, setRitualActive] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-6 space-y-6 relative">
      <Modal
        open={introVisible}
        closable={false}
        footer={
          <div className="flex items-center justify-between">
            <Button onClick={() => { setRitualVisible(true); setRitualActive(true); }}>
              观看起卦仪式
            </Button>
            <Button type="primary" onClick={() => { setIntroVisible(false); setRitualVisible(false); }}>
              进入本回合（季度）
            </Button>
          </div>
        }
      >
        <Title level={4} className="!text-slate-800">凡墙皆是门 · 背景故事</Title>
        <Paragraph className="text-slate-700 mb-2">
          在周期性的市场震荡中，四面墙壁即是四扇门。赛道、政策、资本、技术的缝隙正打开，季度节奏的博弈迫使各主体在现金流、渠道与创新之间寻找平衡。
        </Paragraph>
        <Paragraph className="text-slate-700 mb-0">
          规则提醒：本游戏以“季度”为回合；主体数量由房间配置决定；未提交指令的主体只结算被动收支；现金流安全优先于扩张冲动。
        </Paragraph>
        <Divider />
        <Text strong className="text-slate-800">初始财报（动态主体）</Text>
        <Table
          size="small"
          pagination={false}
          className="mt-2"
          columns={[
            { title: '主体', dataIndex: 'name', key: 'name' },
            { title: '现金', dataIndex: 'cash', key: 'cash', render: (v: number) => `¥ ${v.toLocaleString()}` },
            { title: '被动收入', dataIndex: 'passiveIncome', key: 'passiveIncome', render: (v: number) => `+¥ ${v.toLocaleString()}` },
            { title: '被动支出', dataIndex: 'passiveExpense', key: 'passiveExpense', render: (v: number) => `-¥ ${v.toLocaleString()}` },
            { title: '市占%', dataIndex: 'marketShare', key: 'marketShare' },
            { title: '信用', dataIndex: 'creditRating', key: 'creditRating' },
          ]}
          dataSource={entities.map((e, idx) => ({
            key: e.id || idx,
            name: e.name,
            cash: e.cash,
            passiveIncome: e.passiveIncome,
            passiveExpense: e.passiveExpense,
            marketShare: e.marketShare ?? '—',
            creditRating: e.creditRating ?? '—',
          }))}
        />
      </Modal>

      <Modal
        open={hasBankrupt}
        footer={null}
        closable={false}
        title="破产清算"
        onCancel={() => setBankruptVisible(false)}
      >
        <Alert
          type="error"
          showIcon
          message="有主体现金流归零或被标记破产，进入清算/复盘。"
          description="请查看本回合财务与排名，主持人可在结果阶段结束后决定是否结束对局或引导增资方案。"
        />
        <Divider />
        <div className="text-sm text-slate-700 space-y-1">
          <div>• 审视现金流：检查被动支出与主动决策支出的来源，评估是否需要减项。</div>
          <div>• 资产变现：若需复活，可考虑减持低收益资产或引入增资方案。</div>
          <div>• 结束条件：主持人可在结果阶段决定是否终局或进入增资讨论。</div>
        </div>
      </Modal>
      <DivinationOverlay
        visible={ritualVisible}
        lines={hexagram.lines || mockHexagram.lines}
        onComplete={() => {
          setRitualVisible(false);
          setRitualActive(false);
          setShowSpinner(true);
          setTimeout(() => setShowSpinner(false), 1500);
          setBankruptVisible(hasBankrupt);
        }}
        onCancel={() => {
          setRitualVisible(false);
          setRitualActive(false);
          setBankruptVisible(hasBankrupt);
        }}
        onPauseEffects={() => {
          // placeholder: pause global particles if available
        }}
        onResumeEffects={() => {
          // placeholder: resume global particles if available
        }}
        title="卦象显现 · 季度开局"
      />
      {showSpinner && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <Spin tip="推演中..." size="large" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} className="!text-slate-50">商业决策控制台 · 季度回合</Title>
          <Text className="text-slate-400">金融赛博夜光风格 · 数据对齐季度节奏</Text>
        </div>
        <Tag color="cyan" className="px-3 py-1 text-sm border border-cyan-500/40 bg-cyan-500/10">
          当前回合：20XX Q2
        </Tag>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900/70 border border-cyan-500/30 shadow-lg shadow-cyan-900/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="text-cyan-300" size={18} />
                <Text className="text-cyan-200">周易卦象</Text>
              </div>
              <Title level={4} className="!text-slate-50 mt-1">{hexagram.name}</Title>
              <Tag
                color={hexagram.omen === 'positive' ? 'green' : hexagram.omen === 'negative' ? 'red' : 'geekblue'}
                className="mt-1"
              >
                {hexagram.omen === 'positive' ? '吉' : hexagram.omen === 'negative' ? '凶' : '中'}
              </Tag>
            </div>
            <div
              className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/50 shadow-lg"
              style={{
                boxShadow: `0 0 24px ${hexagram.colorHint || '#22d3ee'}`,
                animation: 'pulse 2.4s ease-in-out infinite',
              }}
            />
          </div>
          <Divider className="border-slate-700" />
          <HexagramLines lines={hexagram.lines} colorHint={hexagram.colorHint} />
          <Paragraph className="mt-3 text-slate-300 leading-relaxed">{hexagram.text}</Paragraph>
        </Card>

        <Card className="bg-slate-900/70 border border-emerald-500/30 shadow-lg shadow-emerald-900/30">
          <div className="flex items-center gap-2">
            <BarChart2 className="text-emerald-300" size={18} />
            <Text className="text-emerald-200">财务核算中心（元）</Text>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div className="p-3 rounded border border-slate-700 bg-slate-800/60">
              <Text className="text-slate-400">初始资金</Text>
              <Title level={5} className="!text-slate-50 mt-1">¥ {ledger.startingCash.toLocaleString()}</Title>
            </div>
            <div className="p-3 rounded border border-slate-700 bg-slate-800/60">
              <Text className="text-slate-400">被动收入</Text>
              <Title level={5} className="!text-emerald-300 mt-1">+¥ {ledger.passiveIncome.toLocaleString()}</Title>
            </div>
            <div className="p-3 rounded border border-slate-700 bg-slate-800/60">
              <Text className="text-slate-400">被动支出（锁定）</Text>
              <Title level={5} className="!text-rose-300 mt-1">-¥ {ledger.passiveExpense.toLocaleString()}</Title>
              <div className="text-[11px] text-slate-500 mt-1">不可编辑·基础成本</div>
            </div>
            <div className="p-3 rounded border border-amber-500/40 bg-amber-500/10">
              <Text className="text-amber-200">决策成本（主动）</Text>
              <Title level={5} className="!text-amber-100 mt-1">-¥ {ledger.decisionCost.toLocaleString()}</Title>
              <div className="text-[11px] text-amber-200/80 mt-1">本回合主动决策支出</div>
            </div>
          </div>
          <Divider className="border-slate-700" />
          <div className="flex items-center justify-between">
            <Text className="text-slate-300">当前余额</Text>
            <div className="flex items-center gap-2">
              {isCashWarning && (
                <Tag color="red" className="animate-pulse border border-rose-500/50">
                  破产预警
                </Tag>
              )}
              <Title
                level={4}
                className={`mt-0 ${isCashWarning ? '!text-rose-300 animate-pulse' : '!text-cyan-200'}`}
              >
                ¥ {ledger.balance.toLocaleString()}
              </Title>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            现金覆盖倍数：{Number.isFinite(cashCoverage) ? cashCoverage.toFixed(2) : '∞'}（余额 / 被动支出）
          </div>
        </Card>

        <Card className="bg-slate-900/70 border border-amber-500/30 shadow-lg shadow-amber-900/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-amber-300" size={18} />
            <Text className="text-amber-200">排行榜 · 利润/市占/信用</Text>
          </div>
          <div className="mt-4 space-y-3">
            {turnResult.leaderboard.map(entry => {
              const entity = entities.find(e => e.id === entry.id);
              const colors = entity ? getEntityPalette(entity) : palette.deepBlue;
              const rankClass =
                entry.rankChange && entry.rankChange !== 0
                  ? `rank-pulse ${entry.rankChange > 0 ? 'rank-up' : 'rank-down'}`
                  : '';
              return (
                <div
                  key={entry.id}
                  className={`p-3 rounded border ${colors.border} ${colors.bg} flex items-center justify-between ${rankClass}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800/70 border border-slate-700 flex items-center justify-center text-sm text-slate-200">
                      {entry.rank}
                    </div>
                    <div>
                      <Text className={`${colors.text} font-semibold`}>{entry.name}</Text>
                      <div className="text-xs text-slate-400">信用 {entity?.creditRating || '—'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-300">评分 {entry.score}</div>
                    <div className="text-xs text-slate-400">市占 {entity?.marketShare ?? '—'}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-slate-900/70 border border-cyan-500/30 shadow-lg shadow-cyan-900/30">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="text-cyan-300" size={18} />
            <Text className="text-cyan-200">推演叙事（季度节奏）</Text>
          </div>
          <Paragraph className="text-slate-200 leading-relaxed">{turnResult.narrative}</Paragraph>
          {turnResult.branchingNarratives && turnResult.branchingNarratives.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {turnResult.branchingNarratives.map((b, idx) => (
                <Tag key={idx} color="geekblue">{b}</Tag>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-slate-900/70 border border-emerald-500/30 shadow-lg shadow-emerald-900/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="text-emerald-300" size={18} />
            <Text className="text-emerald-200">风险 / 机会 / 效益</Text>
          </div>
          <div className="space-y-2 text-sm">
            <div className="p-3 rounded border border-rose-500/40 bg-rose-500/10">
              <Text className="text-rose-200">风险</Text>
              <Paragraph className="text-slate-200 mb-0">{turnResult.riskCard}</Paragraph>
            </div>
            <div className="p-3 rounded border border-amber-500/40 bg-amber-500/10">
              <Text className="text-amber-200">机会</Text>
              <Paragraph className="text-slate-200 mb-0">{turnResult.opportunityCard}</Paragraph>
            </div>
            <div className="p-3 rounded border border-emerald-500/40 bg-emerald-500/10">
              <Text className="text-emerald-200">效益</Text>
              <Paragraph className="text-slate-200 mb-0">{turnResult.benefitCard}</Paragraph>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900/70 border border-amber-500/30 shadow-lg shadow-amber-900/30">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="text-amber-300" size={18} />
            <Text className="text-amber-200">智能决策选项</Text>
          </div>
          <div className="space-y-3">
            {options.map(opt => (
              <div key={opt.id} className="p-3 rounded border border-slate-700 bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <Text className="text-slate-100 font-semibold">{opt.title}</Text>
                  <Tag color="cyan">{formatDelta(opt.expectedDelta)}</Tag>
                </div>
                <Paragraph className="text-slate-300 mb-1">{opt.description}</Paragraph>
              </div>
            ))}
          </div>
          <Divider className="border-slate-700" />
          <div className="space-y-2">
            <Text className="text-slate-200">非标准决策输入</Text>
            <Input.TextArea rows={3} placeholder="输入自定义策略指令..." className="bg-slate-800/80 text-slate-100" />
            <Button type="primary" className="bg-cyan-500/80 border-cyan-400 hover:bg-cyan-400 text-slate-900 font-semibold">
              提交决策
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2 bg-slate-900/70 border border-cyan-500/30 shadow-lg shadow-cyan-900/30">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="text-cyan-300" size={18} />
            <Text className="text-cyan-200">多主体对比</Text>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entities.map(entity => {
              const colors = getEntityPalette(entity);
              return (
                <div key={entity.id} className={`p-3 rounded border ${colors.border} ${colors.bg} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <Text className={`${colors.text} font-semibold`}>{entity.name}</Text>
                    <Tag color="cyan" className="text-xs">信用 {entity.creditRating || '—'}</Tag>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-200">
                    <div>现金 ¥ {entity.cash.toLocaleString()}</div>
                    <div>市占 {entity.marketShare ?? '—'}%</div>
                    <div>声誉 {entity.reputation ?? '—'}</div>
                    <div>创新 {entity.innovation ?? '—'}</div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <DeltaBadge value={entity.delta.cash || 0} label="现金Δ" />
                    <DeltaBadge value={(entity.delta.marketShare as number) || 0} label="市占Δ" />
                  </div>
                  <div className="mt-2">
                    <Text className="text-slate-400 text-xs">被动</Text>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-300">+¥ {entity.passiveIncome.toLocaleString()}</span>
                      <span className="text-rose-300">-¥ {entity.passiveExpense.toLocaleString()}</span>
                    </div>
                  </div>
                  <Progress
                    percent={Math.min(100, Math.max(0, (entity.marketShare || 0) * 2))}
                    size="small"
                    strokeColor={entity.accentColor || '#22d3ee'}
                    trailColor="#1f2937"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DecisionConsole;

