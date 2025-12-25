import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface ValidationResult {
  valid: boolean;
  level: 'error' | 'warning' | 'info' | 'success';
  message: string;
  rule?: string;
}

interface DecisionValidatorProps {
  /** 当前现金 */
  currentCash: number;
  /** 决策预估成本 */
  estimatedCost: number;
  /** 被动支出（每回合） */
  passiveExpense: number;
  /** 破产阈值 */
  bankruptcyThreshold?: number;
  /** 决策文本（用于内容检测） */
  decisionText?: string;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 自定义验证规则 */
  customValidators?: Array<(params: {
    currentCash: number;
    estimatedCost: number;
    passiveExpense: number;
    decisionText?: string;
  }) => ValidationResult | null>;
}

/**
 * DecisionValidator - 实时决策验证组件
 * 在玩家输入决策时实时检测合法性
 * 减少 AI 处理非法指令的负担，提升游戏严谨性
 */
const DecisionValidator: React.FC<DecisionValidatorProps> = ({
  currentCash,
  estimatedCost,
  passiveExpense,
  bankruptcyThreshold = 0,
  decisionText = '',
  showDetails = true,
  customValidators = [],
}) => {
  // 执行所有验证
  const validationResults = useMemo(() => {
    const results: ValidationResult[] = [];
    const remainingCash = currentCash - estimatedCost;
    const cashAfterPassive = remainingCash - passiveExpense;

    // 1. 现金流断裂检测
    if (remainingCash < bankruptcyThreshold) {
      results.push({
        valid: false,
        level: 'error',
        message: `现金流不足，此决策将导致立即破产（剩余: ${remainingCash.toLocaleString()} 元）`,
        rule: '现金流原则',
      });
    } else if (cashAfterPassive < bankruptcyThreshold) {
      results.push({
        valid: false,
        level: 'error',
        message: `执行后无法支付下回合被动支出，将导致破产`,
        rule: '现金流原则',
      });
    }

    // 2. 现金流警告（接近危险线）
    const dangerThreshold = passiveExpense * 2;
    if (remainingCash > bankruptcyThreshold && remainingCash < dangerThreshold) {
      results.push({
        valid: true,
        level: 'warning',
        message: `现金流紧张，仅够支撑约 ${Math.floor(remainingCash / passiveExpense)} 回合`,
        rule: '风险提示',
      });
    }

    // 3. 决策内容检测（简单关键词检测）
    if (decisionText) {
      // 检测可能的非法操作
      const illegalPatterns = [
        { pattern: /代替.*决策|替.*做决定/i, message: '不允许代替其他主体决策' },
        { pattern: /撮合.*合作|强制.*合作/i, message: '不允许系统撮合主体间合作' },
        { pattern: /作弊|外挂|bug/i, message: '检测到可能的违规关键词' },
      ];

      for (const { pattern, message } of illegalPatterns) {
        if (pattern.test(decisionText)) {
          results.push({
            valid: false,
            level: 'error',
            message,
            rule: '合规原则',
          });
        }
      }

      // 检测高风险操作
      const riskPatterns = [
        { pattern: /全部投入|孤注一掷|all.?in/i, message: '高风险操作：全额投入' },
        { pattern: /借贷|贷款|融资/i, message: '涉及借贷操作，请确认风险' },
      ];

      for (const { pattern, message } of riskPatterns) {
        if (pattern.test(decisionText)) {
          results.push({
            valid: true,
            level: 'warning',
            message,
            rule: '风险提示',
          });
        }
      }
    }

    // 4. 执行自定义验证器
    for (const validator of customValidators) {
      const result = validator({
        currentCash,
        estimatedCost,
        passiveExpense,
        decisionText,
      });
      if (result) {
        results.push(result);
      }
    }

    // 5. 如果没有问题，添加成功提示
    if (results.length === 0 && estimatedCost > 0) {
      results.push({
        valid: true,
        level: 'success',
        message: `决策可执行，预计剩余 ${remainingCash.toLocaleString()} 元`,
      });
    }

    return results;
  }, [currentCash, estimatedCost, passiveExpense, bankruptcyThreshold, decisionText, customValidators]);

  // 获取最高优先级的结果
  const primaryResult = useMemo(() => {
    const errorResult = validationResults.find(r => r.level === 'error');
    if (errorResult) return errorResult;
    
    const warningResult = validationResults.find(r => r.level === 'warning');
    if (warningResult) return warningResult;
    
    return validationResults[0];
  }, [validationResults]);

  // 是否有错误
  const hasError = validationResults.some(r => r.level === 'error');
  const hasWarning = validationResults.some(r => r.level === 'warning');

  // 获取图标
  const getIcon = (level: ValidationResult['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle size={14} className="text-rose-500" />;
      case 'warning':
        return <AlertTriangle size={14} className="text-amber-500" />;
      case 'info':
        return <Info size={14} className="text-blue-500" />;
      case 'success':
        return <CheckCircle size={14} className="text-emerald-500" />;
    }
  };

  // 获取样式
  const getStyle = (level: ValidationResult['level']) => {
    switch (level) {
      case 'error':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-600';
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    }
  };

  // 无需显示任何内容
  if (validationResults.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* 主要提示 */}
      {primaryResult && (
        <div className={`
          flex items-start gap-2 px-3 py-2 rounded-lg border text-sm
          ${getStyle(primaryResult.level)}
        `}>
          {getIcon(primaryResult.level)}
          <div className="flex-1">
            <span>{primaryResult.message}</span>
            {primaryResult.rule && (
              <span className="ml-2 text-xs opacity-70">[{primaryResult.rule}]</span>
            )}
          </div>
        </div>
      )}

      {/* 详细信息（可选） */}
      {showDetails && validationResults.length > 1 && (
        <div className="pl-4 space-y-1">
          {validationResults.slice(1).map((result, index) => (
            <div
              key={index}
              className={`
                flex items-center gap-1.5 text-xs
                ${result.level === 'error' ? 'text-rose-600' :
                  result.level === 'warning' ? 'text-amber-600' :
                  result.level === 'success' ? 'text-emerald-600' : 'text-slate-500'}
              `}
            >
              {getIcon(result.level)}
              <span>{result.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 财务摘要 */}
      {estimatedCost > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
          <span>当前: {currentCash.toLocaleString()} 元</span>
          <span>成本: -{estimatedCost.toLocaleString()} 元</span>
          <span className={hasError ? 'text-rose-500' : hasWarning ? 'text-amber-500' : 'text-emerald-500'}>
            剩余: {(currentCash - estimatedCost).toLocaleString()} 元
          </span>
        </div>
      )}
    </div>
  );
};

export default DecisionValidator;
