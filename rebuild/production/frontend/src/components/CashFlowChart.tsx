import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CashFlowChartProps {
  /** 历史现金数据 [{round: 1, cash: 10000}, ...] */
  history: Array<{ round: number; cash: number }>;
  /** 被动收入 */
  passiveIncome?: number;
  /** 被动支出 */
  passiveExpense?: number;
  /** 当前现金 */
  currentCash?: number;
}

/**
 * 现金流趋势图 - 简化版
 * 显示现金变化趋势和预测
 */
export function CashFlowChart({ 
  history, 
  passiveIncome = 0, 
  passiveExpense = 0,
  currentCash = 0 
}: CashFlowChartProps) {
  // 计算趋势
  const trend = useMemo(() => {
    if (history.length < 2) return 'stable';
    const recent = history.slice(-3);
    const changes = recent.slice(1).map((item, i) => item.cash - recent[i].cash);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    if (avgChange > 1000) return 'up';
    if (avgChange < -1000) return 'down';
    return 'stable';
  }, [history]);

  // 计算净现金流
  const netCashFlow = passiveIncome - passiveExpense;

  // 预测下一回合现金
  const predictedCash = currentCash + netCashFlow;

  // 计算最大值用于图表缩放
  const maxCash = Math.max(...history.map(h => h.cash), currentCash, 1);

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp size={16} className="text-emerald-400" />;
    if (trend === 'down') return <TrendingDown size={16} className="text-rose-400" />;
    return <Minus size={16} className="text-slate-400" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-400';
    if (trend === 'down') return 'text-rose-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 uppercase tracking-wider">现金流趋势</span>
        <span className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
          {getTrendIcon()}
          {trend === 'up' ? '上升' : trend === 'down' ? '下降' : '稳定'}
        </span>
      </div>

      {/* 简化的柱状图 */}
      <div className="flex items-end gap-1 h-16 mb-3">
        {history.slice(-6).map((item, index) => {
          const height = (item.cash / maxCash) * 100;
          return (
            <div
              key={item.round}
              className="flex-1 flex flex-col items-center"
            >
              <div
                className={`w-full rounded-t transition-all ${
                  index === history.slice(-6).length - 1 
                    ? 'bg-indigo-500' 
                    : 'bg-slate-700'
                }`}
                style={{ height: `${Math.max(height, 5)}%` }}
              />
              <span className="text-[10px] text-slate-500 mt-1">R{item.round}</span>
            </div>
          );
        })}
      </div>

      {/* 收支明细 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-emerald-500/10 rounded-lg p-2">
          <div className="text-emerald-400 text-[10px] uppercase">被动收入</div>
          <div className="text-emerald-300 font-mono">+{passiveIncome.toLocaleString()}</div>
        </div>
        <div className="bg-rose-500/10 rounded-lg p-2">
          <div className="text-rose-400 text-[10px] uppercase">被动支出</div>
          <div className="text-rose-300 font-mono">-{passiveExpense.toLocaleString()}</div>
        </div>
      </div>

      {/* 净现金流 */}
      <div className={`mt-2 p-2 rounded-lg ${netCashFlow >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">净现金流</span>
          <span className={`font-mono ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netCashFlow >= 0 ? '+' : ''}{netCashFlow.toLocaleString()}/回合
          </span>
        </div>
      </div>

      {/* 预测 */}
      {currentCash > 0 && (
        <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">下回合预测</span>
            <span className="font-mono text-slate-300">
              ≈ {predictedCash.toLocaleString()}
            </span>
          </div>
          {predictedCash < passiveExpense && (
            <div className="text-[10px] text-rose-400 mt-1">
              ⚠️ 现金流警告：可能无法支付下回合支出
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CashFlowChart;
