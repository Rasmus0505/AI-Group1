/**
 * 双API测试路由
 * 提供独立的API端点用于测试双API架构
 */

import { Router, Request, Response } from 'express';
import { generateNarrative, NarrativeConfig, NarrativeRequest } from './narrativeApi';
import { parseNarrative, ParserConfig, ParserRequest } from './parserApi';

const router = Router();

/**
 * POST /api/dual/init
 * 游戏初始化：生成背景故事 + 解析初始数据
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { narrativeConfig, parserConfig, extraPrompt } = req.body as {
      narrativeConfig: NarrativeConfig;
      parserConfig: ParserConfig;
      extraPrompt?: string;
    };

    if (!narrativeConfig?.endpoint || !narrativeConfig?.apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少剧情API配置'
      });
    }

    if (!parserConfig?.endpoint || !parserConfig?.apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少解析API配置'
      });
    }

    // Step 1: 生成背景故事
    const narrativeResult = await generateNarrative(narrativeConfig, {
      type: 'init',
      prompt: extraPrompt
    });

    if (!narrativeResult.success || !narrativeResult.narrative) {
      return res.json({
        success: false,
        step: 'narrative',
        error: narrativeResult.error || '背景故事生成失败'
      });
    }

    // Step 2: 解析初始化数据
    const parseResult = await parseNarrative(parserConfig, {
      type: 'init',
      narrative: narrativeResult.narrative
    });

    return res.json({
      success: true,
      narrative: narrativeResult.narrative,
      parserRawText: parseResult.rawText,     // 解析API的原始输出
      initData: parseResult.panelData || null,
      parseSuccess: parseResult.parseSuccess,
      parseError: parseResult.parseSuccess ? null : '无法解析JSON结构'
    });

  } catch (error: any) {
    console.error('Init route error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

/**
 * POST /api/dual/narrative
 * 生成剧情文本（回合推演）
 */
router.post('/narrative', async (req: Request, res: Response) => {
  try {
    const { config, currentRound, previousParserOutput, playerDecisions, extraPrompt } = req.body as {
      config: NarrativeConfig;
      currentRound: number;
      previousParserOutput?: string;  // 上回合数值解析API的原始输出
      playerDecisions?: string[];
      extraPrompt?: string;
    };

    if (!config?.endpoint || !config?.apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少API配置（endpoint或apiKey）'
      });
    }

    const result = await generateNarrative(config, {
      type: 'round',
      prompt: extraPrompt,
      previousParserOutput,
      playerDecisions,
      currentRound
    });
    
    return res.json(result);

  } catch (error: any) {
    console.error('Narrative route error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

/**
 * POST /api/dual/parse
 * 解析剧情为面板数据
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { config, narrative, entities, currentRound } = req.body as {
      config: ParserConfig;
      narrative: string;
      entities?: Array<{ id: string; name: string; currentCash?: number }>;
      currentRound?: number;
    };

    if (!config?.endpoint || !config?.apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少API配置（endpoint或apiKey）'
      });
    }

    if (!narrative) {
      return res.status(400).json({
        success: false,
        error: '缺少剧情文本（narrative）'
      });
    }

    const result = await parseNarrative(config, {
      type: 'round',
      narrative,
      entities,
      currentRound
    });
    
    // 返回原始文本和解析结果
    return res.json({
      success: result.success,
      rawText: result.rawText,           // 原始文本（始终返回）
      panelData: result.panelData,       // 解析后的数据
      parseSuccess: result.parseSuccess, // 解析是否成功
      error: result.error
    });

  } catch (error: any) {
    console.error('Parse route error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

/**
 * POST /api/dual/full-round
 * 完整回合处理：生成剧情 + 解析数据
 */
router.post('/full-round', async (req: Request, res: Response) => {
  try {
    const {
      narrativeConfig,
      parserConfig,
      currentRound,
      previousParserOutput,
      playerDecisions,
      entities,
      extraPrompt
    } = req.body;

    // 验证配置
    if (!narrativeConfig?.endpoint || !narrativeConfig?.apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少剧情API配置'
      });
    }

    if (!parserConfig?.endpoint || !parserConfig?.apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少解析API配置'
      });
    }

    // Step 1: 生成剧情（传入上回合数值解析输出 + 玩家决策）
    const narrativeResult = await generateNarrative(narrativeConfig, {
      type: 'round',
      prompt: extraPrompt,
      previousParserOutput,
      playerDecisions,
      currentRound: currentRound || 1
    });

    if (!narrativeResult.success || !narrativeResult.narrative) {
      return res.json({
        success: false,
        step: 'narrative',
        error: narrativeResult.error || '剧情生成失败'
      });
    }

    // Step 2: 解析数据
    const parseResult = await parseNarrative(parserConfig, {
      type: 'round',
      narrative: narrativeResult.narrative,
      entities: entities || [],
      currentRound: currentRound || 1
    });

    return res.json({
      success: true,
      narrative: narrativeResult.narrative,
      parserRawText: parseResult.rawText,     // 解析API的原始输出
      panelData: parseResult.panelData || null,
      parseSuccess: parseResult.parseSuccess,
      parseError: parseResult.parseSuccess ? null : '无法解析JSON结构'
    });

  } catch (error: any) {
    console.error('Full round route error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

export default router;
