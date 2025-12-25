import React, { useState } from 'react';
import { MessageSquare, Lock, Users } from 'lucide-react';
import { Input, Button } from 'antd';

type ChatTab = 'public' | 'private' | 'alliance';

interface ChatSystemProps {
  lastSharedSnippet?: string;
}

const ChatSystem: React.FC<ChatSystemProps> = ({ lastSharedSnippet }) => {
  const [activeTab, setActiveTab] = useState<ChatTab>('public');
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setInputValue('');
  };

  const tabStyle = (tab: ChatTab) => ({
    flex: 1,
    padding: '6px 8px',
    fontSize: 12,
    textAlign: 'center' as const,
    borderRadius: 8,
    border: activeTab === tab ? '1px solid #e2e8f0' : '1px solid transparent',
    background: activeTab === tab ? '#fff' : 'transparent',
    color: activeTab === tab ? '#0f172a' : '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        通讯中心
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, background: '#f8fafc', padding: 4, borderRadius: 10 }}>
        <button type="button" onClick={() => setActiveTab('public')} style={tabStyle('public')}>
          <MessageSquare size={12} /> 公开
        </button>
        <button type="button" onClick={() => setActiveTab('private')} style={tabStyle('private')}>
          <Lock size={12} /> 私聊
        </button>
        <button type="button" onClick={() => setActiveTab('alliance')} style={tabStyle('alliance')}>
          <Users size={12} /> 联盟
        </button>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, fontSize: 13, color: '#64748b', marginBottom: 12 }}>
        {activeTab === 'public' && <p>公开频道对所有参与者可见。</p>}
        {activeTab === 'private' && (
          <>
            {lastSharedSnippet && (
              <div style={{ marginBottom: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>来自叙事的分享:</div>
                <div style={{ fontSize: 12, color: '#374151' }}>{lastSharedSnippet}</div>
              </div>
            )}
            <p>私聊消息仅对选定的对手可见。</p>
          </>
        )}
        {activeTab === 'alliance' && <p>联盟频道用于协调和共享计划。</p>}
      </div>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="输入消息..."
          onPressEnter={handleSend}
        />
        <Button type="primary" onClick={handleSend}>发送</Button>
      </div>
    </div>
  );
};

export default ChatSystem;
