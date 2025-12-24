/**
 * 解析文本展示组件
 * 用于在玩家视图显示数据解析API的原始输出
 */

import React, { useState, useRef, useEffect } from 'react';

interface ParserTextDisplayProps {
  rawText: string | null;
  isLoading: boolean;
  parseSuccess: boolean;
  error: string | null;
  round: number;
}

/**
 * 玩家视图 - 解析数据展示区
 * 显示解析API的原始输出文本
 */
export const ParserTextDisplay: React.FC<ParserTextDisplayProps> = ({
  rawText,
  isLoading,
  parseSuccess,
  error,
  round
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (rawText && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [rawText]);

  return (
    <div style={styles.container}>
      {/* 标题栏 */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <span style={styles.icon}>📊</span>
          <h3 style={styles.title}>第 {round} 回合 - 数据解析</h3>
          {parseSuccess && <span style={styles.successBadge}>✓ 解析成功</span>}
          {rawText && !parseSuccess && <span style={styles.warningBadge}>⚠ 解析失败</span>}
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          style={styles.toggleButton}
        >
          {isExpanded ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>

      {/* 内容区 */}
      {isExpanded && (
        <div ref={containerRef} style={styles.content}>
          {/* 加载状态 */}
          {isLoading && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>AI正在解析数据，请稍候...</p>
            </div>
          )}

          {/* 错误状态 */}
          {error && !isLoading && !rawText && (
            <div style={styles.errorContainer}>
              <span style={styles.errorIcon}>⚠️</span>
              <p style={styles.errorText}>{error}</p>
            </div>
          )}

          {/* 解析文本内容 */}
          {rawText && !isLoading && (
            <div>
              {/* 解析状态提示 */}
              {!parseSuccess && (
                <div style={styles.parseWarning}>
                  <span>⚠️</span>
                  <span>JSON解析失败，但原始数据已显示。面板数据可能无法自动更新。</span>
                </div>
              )}
              
              {/* 原始文本 */}
              <div style={styles.rawTextContent}>
                <pre style={styles.preText}>{rawText}</pre>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {!rawText && !isLoading && !error && (
            <div style={styles.emptyContainer}>
              <span style={styles.emptyIcon}>📋</span>
              <p style={styles.emptyText}>等待数据解析...</p>
            </div>
          )}
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
    border: '1px solid #2d2d44',
    marginTop: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    backgroundColor: '#252540',
    borderBottom: '1px solid #2d2d44'
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  icon: {
    fontSize: '22px'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0'
  },
  successBadge: {
    padding: '4px 10px',
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#34d399',
    fontWeight: 500
  },
  warningBadge: {
    padding: '4px 10px',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#fbbf24',
    fontWeight: 500
  },
  toggleButton: {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    border: '1px solid #4a4a6a',
    borderRadius: '6px',
    color: '#a0a0c0',
    cursor: 'pointer',
    fontSize: '13px'
  },
  content: {
    padding: '16px 20px',
    maxHeight: '350px',
    overflowY: 'auto',
    minHeight: '150px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px'
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #2d2d44',
    borderTop: '3px solid #34d399',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '14px',
    color: '#a0a0c0',
    fontSize: '13px'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '8px'
  },
  errorIcon: {
    fontSize: '28px',
    marginBottom: '10px'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '13px',
    textAlign: 'center',
    margin: 0
  },
  parseWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: '6px',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#fbbf24'
  },
  rawTextContent: {
    backgroundColor: '#0d0d1a',
    borderRadius: '8px',
    padding: '14px',
    overflow: 'auto'
  },
  preText: {
    margin: 0,
    fontSize: '12px',
    color: '#a0a0c0',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace'
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px'
  },
  emptyIcon: {
    fontSize: '40px',
    marginBottom: '12px',
    opacity: 0.5
  },
  emptyText: {
    color: '#6a6a8a',
    fontSize: '13px'
  }
};

export default ParserTextDisplay;
