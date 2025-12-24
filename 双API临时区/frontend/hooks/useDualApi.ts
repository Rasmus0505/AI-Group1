/**
 * 双API调用Hook
 * 封装剧情生成和数据解析的API调用逻辑
 */

import { useState, useCallback } from 'react';

// API配置类型
interface ApiConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

// 主体信息
interface EntityInfo {
  id: string;
  name: string;
  currentCash?: number;
  attributes?: Record<string, number>;
}

// 面板数据类型
interface PanelData {
  roundTitle: string;
  perEntityPanel: any[];
  leaderboard: any[];
  events: any[];
  options: any[];
  hexagram?: any;
  riskCard?: string;
  opportunityCard?: string;
  nextRoundHints?: string;
  cashFlowWarning?: any[];
}

// Hook状态
interface DualApiState {
  // 剧情状态
  narrativeLoading: boolean;
  narrative: string | null;
  narrativeError: string | null;
  
  // 解析状态
  parserLoading: boolean;
  parserRawText: string | null;  // 解析API原始输出
  parseSuccess: boolean;         // JSON解析是否成功
  panelData: PanelData | null;
  parserError: string | null;
}

// 解析结果类型
interface ParseResult {
  rawText: string | null;
  parseSuccess: boolean;
  panelData: PanelData | null;
}

// Hook返回类型
interface UseDualApiReturn extends DualApiState {
  // 生成剧情
  generateNarrative: (
    config: ApiConfig,
    prompt: string,
    options?: {
      previousParserOutput?: string;  // 上回合数值解析输出
      playerDecisions?: string[];
      currentRound?: number;
    }
  ) => Promise<string | null>;
  
  // 解析数据
  parseNarrative: (
    config: ApiConfig,
    narrative: string,
    entities: EntityInfo[],
    currentRound: number
  ) => Promise<ParseResult>;
  
  // 完整回合（生成+解析）
  executeFullRound: (
    narrativeConfig: ApiConfig,
    parserConfig: ApiConfig,
    prompt: string,
    entities: EntityInfo[],
    currentRound: number,
    options?: {
      previousParserOutput?: string;  // 上回合数值解析输出
      playerDecisions?: string[];
    }
  ) => Promise<{ narrative: string | null; parseResult: ParseResult }>;
  
  // 重置状态
  reset: () => void;
}

/**
 * 双API调用Hook
 */
export function useDualApi(): UseDualApiReturn {
  const [state, setState] = useState<DualApiState>({
    narrativeLoading: false,
    narrative: null,
    narrativeError: null,
    parserLoading: false,
    parserRawText: null,
    parseSuccess: false,
    panelData: null,
    parserError: null
  });

  // 生成剧情
  const generateNarrative = useCallback(async (
    config: ApiConfig,
    prompt: string,
    options?: {
      previousParserOutput?: string;
      playerDecisions?: string[];
      currentRound?: number;
    }
  ): Promise<string | null> => {
    setState(prev => ({
      ...prev,
      narrativeLoading: true,
      narrativeError: null
    }));

    try {
      const response = await fetch('/api/dual/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          currentRound: options?.currentRound || 1,
          previousParserOutput: options?.previousParserOutput,
          playerDecisions: options?.playerDecisions,
          extraPrompt: prompt
        })
      });

      const result = await response.json();

      if (result.success && result.narrative) {
        setState(prev => ({
          ...prev,
          narrativeLoading: false,
          narrative: result.narrative
        }));
        return result.narrative;
      } else {
        setState(prev => ({
          ...prev,
          narrativeLoading: false,
          narrativeError: result.error || '剧情生成失败'
        }));
        return null;
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        narrativeLoading: false,
        narrativeError: error.message || '网络错误'
      }));
      return null;
    }
  }, []);

  // 解析数据
  const parseNarrative = useCallback(async (
    config: ApiConfig,
    narrative: string,
    entities: EntityInfo[],
    currentRound: number
  ): Promise<ParseResult> => {
    setState(prev => ({
      ...prev,
      parserLoading: true,
      parserError: null,
      parserRawText: null,
      parseSuccess: false
    }));

    try {
      const response = await fetch('/api/dual/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          narrative,
          entities,
          currentRound
        })
      });

      const result = await response.json();

      // 始终保存原始文本
      const rawText = result.rawText || null;
      const parseSuccess = result.parseSuccess || false;
      const panelData = result.panelData || null;

      setState(prev => ({
        ...prev,
        parserLoading: false,
        parserRawText: rawText,
        parseSuccess: parseSuccess,
        panelData: panelData,
        parserError: result.success ? null : (result.error || '数据解析失败')
      }));

      return { rawText, parseSuccess, panelData };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        parserLoading: false,
        parserError: error.message || '网络错误'
      }));
      return { rawText: null, parseSuccess: false, panelData: null };
    }
  }, []);

  // 完整回合
  const executeFullRound = useCallback(async (
    narrativeConfig: ApiConfig,
    parserConfig: ApiConfig,
    prompt: string,
    entities: EntityInfo[],
    currentRound: number,
    options?: {
      previousParserOutput?: string;
      playerDecisions?: string[];
    }
  ): Promise<{ narrative: string | null; parseResult: ParseResult }> => {
    // Step 1: 生成剧情（传入上回合数值解析输出）
    const narrative = await generateNarrative(narrativeConfig, prompt, {
      previousParserOutput: options?.previousParserOutput,
      playerDecisions: options?.playerDecisions,
      currentRound
    });
    
    if (!narrative) {
      return { narrative: null, parseResult: { rawText: null, parseSuccess: false, panelData: null } };
    }

    // Step 2: 解析数据
    const parseResult = await parseNarrative(parserConfig, narrative, entities, currentRound);

    return { narrative, parseResult };
  }, [generateNarrative, parseNarrative]);

  // 重置状态
  const reset = useCallback(() => {
    setState({
      narrativeLoading: false,
      narrative: null,
      narrativeError: null,
      parserLoading: false,
      parserRawText: null,
      parseSuccess: false,
      panelData: null,
      parserError: null
    });
  }, []);

  return {
    ...state,
    generateNarrative,
    parseNarrative,
    executeFullRound,
    reset
  };
}

export default useDualApi;
