/**
 * 双API配置组件
 * 用于主持人配置界面，添加第二个API key
 */

import React, { useState } from 'react';

interface ApiConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

interface DualApiConfigProps {
  narrativeConfig: ApiConfig;
  parserConfig: ApiConfig;
  onNarrativeConfigChange: (config: ApiConfig) => void;
  onParserConfigChange: (config: ApiConfig) => void;
  onTestConnection?: (type: 'narrative' | 'parser') => Promise<boolean>;
}

/**
 * 主持人配置界面 - 双API配置区
 */
export const DualApiConfig: React.FC<DualApiConfigProps> = ({
  narrativeConfig,
  parserConfig,
  onNarrativeConfigChange,
  onParserConfigChange,
  onTestConnection
}) => {
  const [testingNarrative, setTestingNarrative] = useState(false);
  const [testingParser, setTestingParser] = useState(false);
  const [narrativeStatus, setNarrativeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [parserStatus, setParserStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 测试剧情API连接
  const handleTestNarrative = async () => {
    if (!onTestConnection) return;
    setTestingNarrative(true);
    setNarrativeStatus('idle');
    try {
      const success = await onTestConnection('narrative');
      setNarrativeStatus(success ? 'success' : 'error');
    } catch {
      setNarrativeStatus('error');
    }
    setTestingNarrative(false);
  };

  // 测试解析API连接
  const handleTestParser = async () => {
    if (!onTestConnection) return;
    setTestingParser(true);
    setParserStatus('idle');
    try {
      const success = await onTestConnection('parser');
      setParserStatus(success ? 'success' : 'error');
    } catch {
      setParserStatus('error');
    }
    setTestingParser(false);
  };

  // 使用相同配置
  const handleUseSameConfig = () => {
    onParserConfigChange({ ...narrativeConfig });
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.mainTitle}>🔧 双API配置</h2>
      <p style={styles.description}>
        配置两个独立的API：剧情推演API负责生成故事文本，数据解析API负责提取结构化数据。
        可以使用相同的API密钥，也可以使用不同的服务。
      </p>

      {/* 剧情推演API配置 */}
      <div style={styles.configSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📖</span>
            剧情推演API
          </h3>
          <span style={styles.sectionBadge}>必需</span>
        </div>
        <p style={styles.sectionDesc}>
          用于生成游戏剧情叙述，输出纯文本，不要求JSON格式
        </p>

        <div style={styles.formGroup}>
          <label style={styles.label}>API Endpoint</label>
          <input
            type="text"
            value={narrativeConfig.endpoint}
            onChange={(e) => onNarrativeConfigChange({ 
              ...narrativeConfig, 
              endpoint: e.target.value 
            })}
            placeholder="https://api.deepseek.com/v1/chat/completions"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>API Key</label>
          <input
            type="password"
            value={narrativeConfig.apiKey}
            onChange={(e) => onNarrativeConfigChange({ 
              ...narrativeConfig, 
              apiKey: e.target.value 
            })}
            placeholder="sk-xxxxxxxxxxxxxxxx"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>模型名称（可选）</label>
          <input
            type="text"
            value={narrativeConfig.model || ''}
            onChange={(e) => onNarrativeConfigChange({ 
              ...narrativeConfig, 
              model: e.target.value 
            })}
            placeholder="deepseek-chat"
            style={styles.input}
          />
        </div>

        <div style={styles.buttonRow}>
          <button 
            onClick={handleTestNarrative}
            disabled={testingNarrative || !narrativeConfig.endpoint || !narrativeConfig.apiKey}
            style={{
              ...styles.testButton,
              opacity: testingNarrative ? 0.6 : 1
            }}
          >
            {testingNarrative ? '测试中...' : '测试连接'}
          </button>
          {narrativeStatus === 'success' && (
            <span style={styles.successBadge}>✓ 连接成功</span>
          )}
          {narrativeStatus === 'error' && (
            <span style={styles.errorBadge}>✗ 连接失败</span>
          )}
        </div>
      </div>

      {/* 分隔线 + 快捷操作 */}
      <div style={styles.divider}>
        <button onClick={handleUseSameConfig} style={styles.copyButton}>
          ↓ 使用相同配置 ↓
        </button>
      </div>

      {/* 数据解析API配置 */}
      <div style={styles.configSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📊</span>
            数据解析API
          </h3>
          <span style={styles.sectionBadge}>必需</span>
        </div>
        <p style={styles.sectionDesc}>
          用于将剧情文本解析为结构化面板数据，要求JSON格式输出
        </p>

        <div style={styles.formGroup}>
          <label style={styles.label}>API Endpoint</label>
          <input
            type="text"
            value={parserConfig.endpoint}
            onChange={(e) => onParserConfigChange({ 
              ...parserConfig, 
              endpoint: e.target.value 
            })}
            placeholder="https://api.deepseek.com/v1/chat/completions"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>API Key</label>
          <input
            type="password"
            value={parserConfig.apiKey}
            onChange={(e) => onParserConfigChange({ 
              ...parserConfig, 
              apiKey: e.target.value 
            })}
            placeholder="sk-xxxxxxxxxxxxxxxx"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>模型名称（可选）</label>
          <input
            type="text"
            value={parserConfig.model || ''}
            onChange={(e) => onParserConfigChange({ 
              ...parserConfig, 
              model: e.target.value 
            })}
            placeholder="deepseek-chat"
            style={styles.input}
          />
        </div>

        <div style={styles.buttonRow}>
          <button 
            onClick={handleTestParser}
            disabled={testingParser || !parserConfig.endpoint || !parserConfig.apiKey}
            style={{
              ...styles.testButton,
              opacity: testingParser ? 0.6 : 1
            }}
          >
            {testingParser ? '测试中...' : '测试连接'}
          </button>
          {parserStatus === 'success' && (
            <span style={styles.successBadge}>✓ 连接成功</span>
          )}
          {parserStatus === 'error' && (
            <span style={styles.errorBadge}>✗ 连接失败</span>
          )}
        </div>
      </div>

      {/* 提示信息 */}
      <div style={styles.tips}>
        <h4 style={styles.tipsTitle}>💡 使用提示</h4>
        <ul style={styles.tipsList}>
          <li>两个API可以使用相同的密钥和端点</li>
          <li>剧情API建议使用较高的temperature（0.7-0.9）以获得更有创意的输出</li>
          <li>解析API建议使用较低的temperature（0.2-0.4）以获得更稳定的JSON输出</li>
          <li>如果解析失败，玩家仍可阅读剧情，主持人可手动重试解析</li>
        </ul>
      </div>
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
  mainTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: 600,
    color: '#e0e0e0'
  },
  description: {
    margin: '0 0 24px 0',
    fontSize: '14px',
    color: '#8a8aa0',
    lineHeight: 1.6
  },
  configSection: {
    backgroundColor: '#252540',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  sectionIcon: {
    fontSize: '20px'
  },
  sectionBadge: {
    padding: '4px 10px',
    backgroundColor: '#6366f1',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'white',
    fontWeight: 500
  },
  sectionDesc: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#8a8aa0'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#a0a0c0'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #3d3d5c',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#e0e0e0',
    outline: 'none',
    boxSizing: 'border-box'
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px'
  },
  testButton: {
    padding: '8px 20px',
    backgroundColor: '#3d3d5c',
    border: 'none',
    borderRadius: '6px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s'
  },
  successBadge: {
    color: '#34d399',
    fontSize: '13px',
    fontWeight: 500
  },
  errorBadge: {
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: 500
  },
  divider: {
    display: 'flex',
    justifyContent: 'center',
    margin: '8px 0'
  },
  copyButton: {
    padding: '8px 24px',
    backgroundColor: 'transparent',
    border: '1px dashed #4a4a6a',
    borderRadius: '6px',
    color: '#8a8aa0',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s'
  },
  tips: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(99, 102, 241, 0.2)'
  },
  tipsTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#a5b4fc'
  },
  tipsList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#8a8aa0',
    lineHeight: 1.8
  }
};

export default DualApiConfig;
