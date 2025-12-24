/**
 * 主持人控制面板
 * 用于主持人手动控制剧情生成和数据解析流程
 */

import React, { useState } from 'react';

interface ApiConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

interface EntityInfo {
  id: string;
  name: string;
  currentCash?: number;
}

interface HostControlPanelProps {
  narrativeConfig: ApiConfig;
  parserConfig: ApiConfig;
  entities: EntityInfo[];
  currentRound: number;
  previousParserOutput?: string;  // 上回合数值解析API的原始输出
  playerDecisions?: string[];
  onNarrativeGenerated: (narrative: string) => void;
  onPanelDataParsed: (panelData: any, rawText: string, parseSuccess: boolean) => void;
}

/**
 * 主持人控制面板
 * 手动控制每一步：编写提示词 → 生成剧情 → 解析数据
 */
export const HostControlPanel: React.FC<HostControlPanelProps> = ({
  narrativeConfig,
  parserConfig,
  entities,
  currentRound,
  previousParserOutput,
  playerDecisions,
  onNarrativeGenerated,
  onPanelDataParsed
}) => {
  // 提示词
  const [prompt, setPrompt] = useState('');
  
  // 当前剧情
  const [currentNarrative, setCurrentNarrative] = useState('');
  
  // 解析结果
  const [parserRawText, setParserRawText] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  
  // 状态
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [parserLoading, setParserLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [parserError, setParserError] = useState<string | null>(null);
  
  // 步骤状态
  const [step, setStep] = useState<'prompt' | 'narrative' | 'parsed'>('prompt');

  // 生成剧情
  const handleGenerateNarrative = async () => {
    if (!prompt.trim()) {
      setNarrativeError('请输入提示词');
      return;
    }

    setNarrativeLoading(true);
    setNarrativeError(null);

    try {
      const response = await fetch('/api/dual/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: narrativeConfig,
          currentRound,
          previousParserOutput,  // 上回合数值解析输出
          playerDecisions,
          extraPrompt: prompt
        })
      });

      const result = await response.json();

      if (result.success && result.narrative) {
        setCurrentNarrative(result.narrative);
        setStep('narrative');
        onNarrativeGenerated(result.narrative);
      } else {
        setNarrativeError(result.error || '剧情生成失败');
      }
    } catch (error: any) {
      setNarrativeError(error.message || '网络错误');
    }

    setNarrativeLoading(false);
  };

  // 解析数据
  const handleParseData = async () => {
    if (!currentNarrative) {
      setParserError('请先生成剧情');
      return;
    }

    setParserLoading(true);
    setParserError(null);
    setParserRawText(null);
    setParseSuccess(false);

    try {
      const response = await fetch('/api/dual/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: parserConfig,
          narrative: currentNarrative,
          entities,
          currentRound
        })
      });

      const result = await response.json();

      // 始终保存原始文本
      const rawText = result.rawText || null;
      const success = result.parseSuccess || false;
      
      setParserRawText(rawText);
      setParseSuccess(success);

      if (result.success) {
        setStep('parsed');
        onPanelDataParsed(result.panelData, rawText, success);
      } else {
        // 即使解析失败，也显示原始文本
        if (rawText) {
          setStep('parsed');
          onPanelDataParsed(null, rawText, false);
        }
        setParserError(result.error || '数据解析失败');
      }
    } catch (error: any) {
      setParserError(error.message || '网络错误');
    }

    setParserLoading(false);
  };

  // 重置开始新回合
  const handleNewRound = () => {
    setPrompt('');
    setCurrentNarrative('');
    setParserRawText(null);
    setParseSuccess(false);
    setNarrativeError(null);
    setParserError(null);
    setStep('prompt');
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎮 主持人控制台 - 第 {currentRound} 回合</h2>

      {/* 步骤指示器 */}
      <div style={styles.stepIndicator}>
        <div style={{
          ...styles.step,
          ...(step === 'prompt' ? styles.stepActive : {}),
          ...(step !== 'prompt' ? styles.stepCompleted : {})
        }}>
          1. 编写提示词
        </div>
        <div style={styles.stepArrow}>→</div>
        <div style={{
          ...styles.step,
          ...(step === 'narrative' ? styles.stepActive : {}),
          ...(step === 'parsed' ? styles.stepCompleted : {})
        }}>
          2. 生成剧情
        </div>
        <div style={styles.stepArrow}>→</div>
        <div style={{
          ...styles.step,
          ...(step === 'parsed' ? styles.stepActive : {})
        }}>
          3. 解析数据
        </div>
      </div>

      {/* 玩家决策摘要 */}
      {playerDecisions && playerDecisions.length > 0 && (
        <div style={styles.decisionsSection}>
          <h4 style={styles.sectionTitle}>📋 本回合玩家决策</h4>
          <ul style={styles.decisionsList}>
            {playerDecisions.map((decision, index) => (
              <li key={index} style={styles.decisionItem}>{decision}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 1: 提示词输入 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>✏️ 提示词</h4>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`请输入本回合的推演提示词...

例如：
本回合是2024年第一季度。
- 市场整体呈现复苏态势
- 原材料价格上涨10%
- 政府出台新的环保政策

请根据各主体的决策，推演本季度的商业发展情况。`}
          style={styles.textarea}
          rows={8}
        />
        
        <div style={styles.buttonRow}>
          <button
            onClick={handleGenerateNarrative}
            disabled={narrativeLoading || !prompt.trim()}
            style={{
              ...styles.primaryButton,
              opacity: narrativeLoading || !prompt.trim() ? 0.6 : 1
            }}
          >
            {narrativeLoading ? '生成中...' : '🚀 生成剧情'}
          </button>
        </div>
        
        {narrativeError && (
          <div style={styles.errorMessage}>⚠️ {narrativeError}</div>
        )}
      </div>

      {/* Step 2: 剧情预览 */}
      {currentNarrative && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>📖 生成的剧情</h4>
          <div style={styles.narrativePreview}>
            {currentNarrative}
          </div>
          
          <div style={styles.buttonRow}>
            <button
              onClick={handleParseData}
              disabled={parserLoading}
              style={{
                ...styles.primaryButton,
                opacity: parserLoading ? 0.6 : 1
              }}
            >
              {parserLoading ? '解析中...' : '📊 解析数据'}
            </button>
            <button
              onClick={handleGenerateNarrative}
              disabled={narrativeLoading}
              style={styles.secondaryButton}
            >
              🔄 重新生成
            </button>
          </div>
          
          {parserError && (
            <div style={styles.errorMessage}>⚠️ {parserError}</div>
          )}
        </div>
      )}

      {/* Step 3: 完成状态 */}
      {step === 'parsed' && (
        <div style={styles.successSection}>
          <div style={styles.successIcon}>{parseSuccess ? '✅' : '⚠️'}</div>
          <h4 style={{
            ...styles.successTitle,
            color: parseSuccess ? '#34d399' : '#fbbf24'
          }}>
            {parseSuccess ? '本回合推演完成！' : '推演完成（解析部分失败）'}
          </h4>
          
          {/* 显示解析原始输出 */}
          {parserRawText && (
            <div style={styles.rawTextSection}>
              <h5 style={styles.rawTextTitle}>📊 解析API原始输出</h5>
              <div style={styles.rawTextBox}>
                <pre style={styles.rawTextPre}>{parserRawText}</pre>
              </div>
            </div>
          )}
          
          <p style={styles.successText}>
            {parseSuccess 
              ? '剧情已广播给所有玩家，面板数据已更新。等待玩家提交决策后，可以开始下一回合。'
              : '剧情已广播，但JSON解析失败。原始数据已显示，可手动处理或重新解析。'
            }
          </p>
          <div style={styles.buttonRow}>
            {!parseSuccess && (
              <button onClick={handleParseData} style={styles.secondaryButton}>
                🔄 重新解析
              </button>
            )}
            <button onClick={handleNewRound} style={styles.primaryButton}>
              📝 准备下一回合
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 样式定义
const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #2d2d44'
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: 600,
    color: '#e0e0e0'
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#252540',
    borderRadius: '8px'
  },
  step: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#6a6a8a',
    backgroundColor: '#1a1a2e'
  },
  stepActive: {
    color: '#e0e0e0',
    backgroundColor: '#6366f1'
  },
  stepCompleted: {
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)'
  },
  stepArrow: {
    color: '#4a4a6a',
    fontSize: '16px'
  },
  decisionsSection: {
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#252540',
    borderRadius: '8px'
  },
  decisionsList: {
    margin: '12px 0 0 0',
    paddingLeft: '20px',
    color: '#a0a0c0',
    fontSize: '14px',
    lineHeight: 1.8
  },
  decisionItem: {
    marginBottom: '4px'
  },
  section: {
    marginBottom: '20px'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#a0a0c0'
  },
  textarea: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#252540',
    border: '1px solid #3d3d5c',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#e0e0e0',
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.6,
    boxSizing: 'border-box'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px'
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'all 0.2s'
  },
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #4a4a6a',
    borderRadius: '8px',
    color: '#a0a0c0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
  },
  errorMessage: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '6px',
    color: '#ef4444',
    fontSize: '13px'
  },
  narrativePreview: {
    padding: '16px',
    backgroundColor: '#252540',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#d0d0e0',
    lineHeight: 1.8,
    maxHeight: '300px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap'
  },
  successSection: {
    textAlign: 'center',
    padding: '32px',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(52, 211, 153, 0.2)'
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  successTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#34d399'
  },
  successText: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#a0a0c0'
  },
  rawTextSection: {
    width: '100%',
    marginBottom: '16px',
    textAlign: 'left'
  },
  rawTextTitle: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#a0a0c0'
  },
  rawTextBox: {
    backgroundColor: '#0d0d1a',
    borderRadius: '8px',
    padding: '12px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  rawTextPre: {
    margin: 0,
    fontSize: '11px',
    color: '#a0a0c0',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace'
  }
};

export default HostControlPanel;
