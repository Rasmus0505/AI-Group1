/**
 * 剧情展示组件
 * 用于在玩家视图下方显示AI生成的剧情文本
 */

import React, { useState, useEffect, useRef } from 'react';

interface NarrativeDisplayProps {
  narrative: string | null;
  isLoading: boolean;
  error: string | null;
  round: number;
  onRetry?: () => void;
}

/**
 * 玩家视图 - 剧情展示区
 * 放置在玩家普通视图的下方，大范围文本输出区
 */
export const NarrativeDisplay: React.FC<NarrativeDisplayProps> = ({
  narrative,
  isLoading,
  error,
  round,
  onRetry
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // 新剧情到达时自动滚动到顶部
  useEffect(() => {
    if (narrative && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [narrative]);

  return (
    <div className="narrative-display-container" style={styles.container}>
      {/* 标题栏 */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <span style={styles.icon}>📖</span>
          <h3 style={styles.title}>第 {round} 回合 - 剧情推演</h3>
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
        <div 
          ref={containerRef}
          style={styles.content}
        >
          {/* 加载状态 */}
          {isLoading && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>AI正在推演剧情，请稍候...</p>
            </div>
          )}

          {/* 错误状态 */}
          {error && !isLoading && (
            <div style={styles.errorContainer}>
              <span style={styles.errorIcon}>⚠️</span>
              <p style={styles.errorText}>{error}</p>
              {onRetry && (
                <button onClick={onRetry} style={styles.retryButton}>
                  重试
                </button>
              )}
            </div>
          )}

          {/* 剧情内容 */}
          {narrative && !isLoading && (
            <div style={styles.narrativeContent}>
              {narrative.split('\n').map((paragraph, index) => (
                <p key={index} style={styles.paragraph}>
                  {highlightKeywords(paragraph)}
                </p>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!narrative && !isLoading && !error && (
            <div style={styles.emptyContainer}>
              <span style={styles.emptyIcon}>📝</span>
              <p style={styles.emptyText}>等待主持人开始本回合推演...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 高亮关键词（事件、金额、百分比等）
 */
function highlightKeywords(text: string): React.ReactNode {
  // 匹配金额
  const moneyPattern = /([¥￥]\s*[\d,]+(?:\.\d+)?(?:万|亿)?|[\d,]+(?:\.\d+)?(?:万|亿)?元)/g;
  // 匹配百分比
  const percentPattern = /(\d+(?:\.\d+)?%)/g;
  // 匹配关键动作词
  const actionPattern = /(成功|失败|增长|下降|突破|危机|机遇|合作|竞争|收购|投资)/g;

  let result = text;
  
  // 简单的关键词高亮（实际项目中可以用更复杂的方案）
  result = result.replace(moneyPattern, '<span class="highlight-money">$1</span>');
  result = result.replace(percentPattern, '<span class="highlight-percent">$1</span>');
  result = result.replace(actionPattern, '<span class="highlight-action">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

// 样式定义
const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    border: '1px solid #2d2d44',
    marginTop: '20px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#252540',
    borderBottom: '1px solid #2d2d44'
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  icon: {
    fontSize: '24px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#e0e0e0'
  },
  toggleButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #4a4a6a',
    borderRadius: '6px',
    color: '#a0a0c0',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  content: {
    padding: '20px',
    maxHeight: '400px',
    overflowY: 'auto',
    minHeight: '200px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #2d2d44',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '16px',
    color: '#a0a0c0',
    fontSize: '14px'
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
    fontSize: '32px',
    marginBottom: '12px'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'center',
    margin: '0 0 16px 0'
  },
  retryButton: {
    padding: '10px 24px',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
  },
  narrativeContent: {
    lineHeight: 1.8,
    color: '#d0d0e0'
  },
  paragraph: {
    marginBottom: '16px',
    fontSize: '15px',
    textIndent: '2em'
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  emptyText: {
    color: '#6a6a8a',
    fontSize: '14px'
  }
};

// CSS动画（需要在全局CSS中添加）
const globalStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .highlight-money {
    color: #fbbf24;
    font-weight: 600;
  }
  
  .highlight-percent {
    color: #34d399;
    font-weight: 600;
  }
  
  .highlight-action {
    color: #60a5fa;
    font-weight: 500;
  }
`;

export default NarrativeDisplay;
