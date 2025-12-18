import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import TeamList from './components/TeamList/TeamList';
import Terminal from './components/Terminal/Terminal';
import InputArea from './components/InputArea/InputArea';
import EventLog from './components/EventLog/EventLog';
import { initGame, sendAction, sendActionStream, configureApi } from './engine/api';
// Re-import local engine for Demo Mode
import { initialState, processDecision } from './engine/gameLogic';
import { mockAI } from './engine/mockAI';
import { helpContent } from './engine/helpContent';
import './index.css';

// Default state to prevent UI crash before API loads
const defaultState = {
  companyName: "Nexus Corp",
  turn: 0,
  attributes: {
    cash: 1000,
    morale: 50,
    reputation: 50,
    innovation: 10
  },
  players: [
    {
      id: "player_human",
      name: "CEO (你)",
      type: "human",
      position: "ceo"
    },
    {
      id: "player_ai_tech",
      name: "CTO (AI)",
      type: "ai",
      position: "cto"
    },
    {
      id: "player_ai_market",
      name: "CMO (AI)",
      type: "ai",
      position: "cmo"
    }
  ],
  history: [
    { id: -1, type: 'system', text: "正在初始化..." }
  ]
};

// Help Modal Component
function HelpModal({ onClose }) {
  // Render markdown content as plain text with line breaks
  const renderHelpContent = () => {
    return helpContent.split('\n').map((line, index) => {
      // Handle headings
      if (line.startsWith('# ')) {
        return <h2 key={index} style={{ color: 'var(--color-accent)', marginTop: '1rem', marginBottom: '0.5rem' }}>{line.replace('# ', '')}</h2>;
      } else if (line.startsWith('## ')) {
        return <h3 key={index} style={{ color: 'var(--color-accent)', marginTop: '1rem', marginBottom: '0.5rem' }}>{line.replace('## ', '')}</h3>;
      } else if (line.startsWith('---')) {
        return <hr key={index} style={{ borderColor: 'var(--color-glass)', margin: '1rem 0' }} />;
      } else if (line.trim()) {
        return <p key={index} style={{ marginBottom: '0.5rem' }}>{line}</p>;
      } else {
        return <br key={index} />;
      }
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        border: '1px solid var(--color-accent)',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
        color: '#e0e0e0'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
        {renderHelpContent()}
      </div>
    </div>
  );
}

// Initialization Settings Modal Component
function InitSettingsModal({ isOpen, onClose, onSave, currentSettings }) {
  const [settings, setSettings] = React.useState(currentSettings || `# 初始化设定

## 公司背景
Nexus Corp 是一家专注于量子计算和神经接口技术的科技公司，成立于2035年。

## 游戏规则
1. 保持四个核心指标（现金、士气、声望、创新）不为零
2. 每个决策都会影响这些指标
3. 游戏目标是带领公司走向成功

## AI 行为要求
1. 根据当前公司状态生成合理的建议
2. 对玩家的自定义指令进行分析和响应
3. 保持剧情的连贯性和挑战性
`);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        border: '1px solid var(--color-accent)',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '700px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
        color: '#e0e0e0'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
        <h2 style={{ color: 'var(--color-accent)', marginTop: 0 }}>⚙️ 初始化设定</h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem' }}>
          输入游戏初始化设定，AI 将根据这些设定生成背景故事和游戏规则。
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <textarea
            value={settings}
            onChange={(e) => setSettings(e.target.value)}
            rows={15}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--color-glass)',
              borderRadius: '4px',
              color: '#e0e0e0',
              fontFamily: 'Monaco, Menlo, "Courier New", monospace',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
            placeholder="输入初始化设定..."
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setSettings(currentSettings || `# 初始化设定

## 公司背景
Nexus Corp 是一家专注于量子计算和神经接口技术的科技公司，成立于2035年。

## 游戏规则
1. 保持四个核心指标（现金、士气、声望、创新）不为零
2. 每个决策都会影响这些指标
3. 游戏目标是带领公司走向成功

## AI 行为要求
1. 根据当前公司状态生成合理的建议
2. 对玩家的自定义指令进行分析和响应
3. 保持剧情的连贯性和挑战性
`)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-glass)',
              borderRadius: '4px',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            重置
          </button>
          <button
            onClick={() => onSave(settings)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            保存设定
          </button>
        </div>
      </div>
    </div>
  );
}

// Landing Page Component
function LandingPage({ onStart, onShowHelp }) {
  const [showApiMenu, setShowApiMenu] = useState(false);
  const [localKey, setLocalKey] = useState("");
  const [remoteKey, setRemoteKey] = useState("");
  const [showInitSettingsModal, setShowInitSettingsModal] = useState(false);
  const [initSettings, setInitSettings] = useState("");

  if (showApiMenu) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'radial-gradient(circle at center, #1b2735 0%, #090a0f 100%)',
        color: '#fff',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Back Button within Menu */}
        <button
          onClick={() => setShowApiMenu(false)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-muted)',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ← 返回选择
        </button>

        <h2 style={{ marginBottom: '2rem', color: 'var(--color-accent)' }}>🚀 正式模式 (API 通道)</h2>

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setShowInitSettingsModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: '1px solid var(--color-accent)',
              borderRadius: '4px',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}
          >
            ⚙️ 初始化设定
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            自定义游戏规则和AI行为，生成个性化的背景故事
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '500px' }}>

          {/* Channel 1: Local */}
          <div style={{ padding: '1.5rem', border: '1px solid var(--color-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>📡 本地部署通道 (Localhost)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>无需联网，连接本地运行的 python main.py</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="输入 Key (可选)..."
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--color-glass)',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
              <button
                onClick={() => onStart('official', { url: 'http://localhost:8000', key: localKey, initSettings: initSettings })}
                style={{
                  padding: '10px 20px',
                  background: 'var(--color-accent)',
                  border: 'none',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                连接本地
              </button>
            </div>
          </div>

          {/* Channel 2: Remote */}
          <div style={{ padding: '1.5rem', border: '1px solid var(--color-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>☁️ 远程调用通道 (Remote API)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>需联网，在此模式下前端将直接作为客户端连接远程服务器</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="输入 API Key..."
                value={remoteKey}
                onChange={(e) => setRemoteKey(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--color-glass)',
                  color: '#fff',
                  borderRadius: '4px'
                }}
              />
              <button
                onClick={() => onStart('official', { url: 'https://api.nexus-corp.com', key: remoteKey, initSettings: initSettings })}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                连接远程
              </button>
            </div>
          </div>

        </div>

        {/* Initialize Settings Modal */}
        <InitSettingsModal
          isOpen={showInitSettingsModal}
          onClose={() => setShowInitSettingsModal(false)}
          onSave={(settings) => {
            setInitSettings(settings);
            setShowInitSettingsModal(false);
          }}
          currentSettings={initSettings}
        />
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'radial-gradient(circle at center, #1b2735 0%, #090a0f 100%)',
      color: '#fff',
      textAlign: 'center',
      position: 'relative'
    }}>
      {/* Landing Page Help Button */}
      <button
        onClick={onShowHelp}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'transparent',
          border: '1px solid var(--color-glass)',
          color: 'var(--color-accent)',
          padding: '8px 15px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          zIndex: 10
        }}
      >
        ❓ 帮助
      </button>

      <h1 style={{
        fontSize: '3rem',
        letterSpacing: '0.5rem',
        textShadow: '0 0 20px rgba(0, 240, 255, 0.8)',
        marginBottom: '3rem',
        fontFamily: 'var(--font-main)'
      }}>
        凡墙皆是门
        <span style={{ display: 'block', fontSize: '1rem', letterSpacing: '4px', marginTop: '10px', color: 'var(--color-accent)' }}>EVERY WALL IS A DOOR</span>
      </h1>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <button
          onClick={() => onStart('demo')}
          style={{
            padding: '1rem 2rem',
            background: 'rgba(0, 240, 255, 0.1)',
            border: '1px solid var(--color-accent)',
            color: 'var(--color-accent)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 240, 255, 0.3)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)'}
        >
          🧪 演示模式 (无后端)
        </button>

        <button
          onClick={() => setShowApiMenu(true)}
          style={{
            padding: '1rem 2rem',
            background: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            color: '#000',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          🚀 正式模式 (完整版)
        </button>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('home'); // 'home' | 'game'
  const [gameMode, setGameMode] = useState(null); // 'demo' | 'official'
  const [initSettings, setInitSettings] = useState(""); // 初始化设定

  const [gameState, setGameState] = useState(defaultState);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deltas, setDeltas] = useState({});
  const [events, setEvents] = useState([]);

  // Handle mode selection from Landing Page
  const startGame = (mode, config) => {
    setGameMode(mode);
    if (mode === 'official' && config) {
      configureApi(config.url, config.key);
      if (config.initSettings) {
        setInitSettings(config.initSettings);
      }
    }
    setView('game');
  };

  // Init game logic when view switches to 'game'
  useEffect(() => {
    if (view !== 'game') return;

    const init = async () => {
      if (gameMode === 'official') {
        // --- Official Mode (API) ---
        try {
          const data = await initGame(initSettings);
          setGameState(data.state);
          setCurrentOptions(data.options);
          setDeltas({}); // Reset deltas on init
        } catch (err) {
          console.error("Failed to init API game:", err);
          // Fallback narrative with retry hint
          setGameState(prev => ({
            ...prev,
            history: [
              ...prev.history,
              { id: Date.now(), type: 'system', text: `❌ 连接失败 (${err.message})。请检查 API 地址或 Key 是否正确，后端是否已运行。` }
            ]
          }));
        }
      } else {
        // --- Demo Mode (Local) ---
        setGameState(initialState);
        const options = mockAI.generateOptions(initialState);
        setCurrentOptions(options);
        setDeltas({});
      }
    };

    init();
  }, [view, gameMode, initSettings]);

  const handleExecute = async (selectedOptionIds, customText, playerId = 'player_human', playerPosition = 'ceo') => {
    // 防止重复提交
    if (isLoading) return;
    setIsLoading(true);

    // 处理多选选项和自定义输入
    if (gameMode === 'official') {
      try {
        // 立即显示“思考中”状态
        setGameState(prev => ({
          ...prev,
          history: [
            ...prev.history,
            { id: Date.now(), type: 'system', text: `📡 指令已发送: [${customText || "选择选项"}]...` }
          ]
        }));

        // 收集选中的选项
        const selectedOptions = currentOptions.filter(opt => selectedOptionIds.includes(opt.id));

        // 构建决策对象
        const action = {
          label: selectedOptions.length > 0 ? selectedOptions.map(opt => opt.label).join(', ') : "Custom Directive",
          customText: customText.trim() || null,
          gameId: "default_room",
          playerId: playerId,
          playerPosition: playerPosition
        };

        // Streaming Handler (V4.0)
        let streamingNarrative = "";
        let streamingId = Date.now() + 100;

        await sendActionStream(action, (chunk) => {
          // Handle Stream Events from Backend
          if (chunk.type === 'log') {
            // System Log (Analyst Status)
            setGameState(prev => ({
              ...prev,
              history: [...prev.history, { id: Date.now(), type: 'system', text: `[SYSTEM] ${chunk.content}`, isLog: true }]
            }));
          }
          else if (chunk.type === 'delta') {
            // Instant Attribute Update (Red/Green Flash)
            setDeltas(chunk.data);
          }
          else if (chunk.type === 'thought') {
            // Logic Process text (for Terminal)
            setGameState(prev => ({
              ...prev,
              history: [...prev.history, { id: Date.now(), type: 'system', text: "🧠 逻辑推演完成", logicChain: chunk.content }]
            }));
          }
          else if (chunk.type === 'token') {
            // Narrative Streaming (Typewriter effect)
            streamingNarrative += chunk.content;

            // Update the last "streaming" message or add new one
            setGameState(prev => {
              const history = [...prev.history];
              const last = history[history.length - 1];
              if (last && last.isStreaming) {
                last.text = streamingNarrative;
                return { ...prev, history };
              } else {
                return { ...prev, history: [...history, { id: streamingId, type: 'system', text: streamingNarrative, isStreaming: true }] };
              }
            });
          }
          else if (chunk.type === 'done') {
            // Finalize Turn
            setGameState(chunk.state);
            setCurrentOptions(prevOpts => chunk.state.current_options || []); // Correctly set new options
            if (chunk.event_summary) {
              setEvents(prev => [...prev, chunk.event_summary]);
            }
          }
        });

      } catch (err) {
        console.error("API Error:", err);
        setGameState(prev => ({
          ...prev,
          history: [
            ...prev.history,
            { id: Date.now(), type: 'system', text: `❌ 连接中断: ${err.message}.` }
          ]
        }));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Demo Mode
      try {
        // Capture state before decision for simplistic delta calc in Demo Mode
        const stateBefore = { ...gameState.attributes };

        // 处理选中的选项
        const selectedOptions = currentOptions.filter(opt => selectedOptionIds.includes(opt.id));

        // 先处理所有选中的选项
        let nextState = { ...gameState };

        // 依次处理每个选中的选项
        for (const opt of selectedOptions) {
          nextState = processDecision(nextState, opt);
        }

        // 处理自定义输入
        if (customText.trim()) {
          const analysis = mockAI.analyzeInput(customText, nextState);
          const customDecision = {
            label: "Custom Directive",
            customText: customText,
            effects: analysis.effects,
            resultNarrative: analysis.resultNarrative,
            playerId: playerId,
            playerPosition: playerPosition
          };
          nextState = processDecision(nextState, customDecision);
        }

        // Calculate Deltas for Demo Mode
        const stateAfter = nextState.attributes;
        const newDeltas = {};
        for (let key in stateAfter) {
          const diff = stateAfter[key] - (stateBefore[key] || 0);
          if (diff !== 0) newDeltas[key] = diff;
        }
        setDeltas(newDeltas);

        // 生成新选项
        const newOptions = mockAI.generateOptions(nextState);
        setGameState(nextState);
        setCurrentOptions(newOptions);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Render Landing Page
  if (view === 'home') {
    return (
      <>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
        <LandingPage onStart={startGame} onShowHelp={() => setShowHelp(true)} />
      </>
    );
  }

  // Render Game Interface
  return (
    <div className="app-container" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundImage: 'radial-gradient(circle at 50% 10%, #1a1a3a 0%, #0a0a16 70%)',
      overflow: 'hidden' /* Prevent body scroll */
    }}>
      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Header - Minimal Height */}
      <header style={{
        padding: '0.5rem 1rem',
        textAlign: 'center',
        position: 'relative',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0
      }}>
        {/* Back Button */}
        <button
          onClick={() => setView('home')}
          style={{
            position: 'absolute',
            top: '50%',
            left: '1rem',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-muted)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          ← 首页
        </button>

        <h1 style={{
          fontSize: '1.2rem',
          letterSpacing: '4px',
          color: 'var(--color-text)',
          margin: 0,
          textShadow: '0 0 10px rgba(0, 240, 255, 0.5)'
        }}>
          EVERY WALL IS A DOOR
        </h1>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '5px' }}>
          CEO: 玩家 | Turn: {gameState.turn} | Mode: <span style={{ color: gameMode === 'official' ? '#0f0' : '#0ff' }}>{gameMode === 'official' ? 'Official' : 'Demo'}</span>
        </div>

        {/* Help Button */}
        <button
          onClick={() => setShowHelp(true)}
          style={{
            position: 'absolute',
            top: '50%',
            right: '1rem',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: '1px solid var(--color-glass-border)',
            color: 'var(--color-accent)',
            padding: '2px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          ❓ 帮助
        </button>
      </header>

      {/* Main Content Content - Flex Row */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Left Sidebar: Fixed Width, Smaller, 3 Sections */}
        <div style={{
          width: '220px', // Reduced from 260px
          padding: '0.5rem', // Reduced padding
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(0,0,0,0.2)',
          overflow: 'hidden',
          fontSize: '0.85rem' // Global smaller font for sidebar
        }}>

          <Dashboard attributes={gameState.attributes} deltas={deltas} />

          <TeamList players={gameState.players} />

          <EventLog events={events} />

          {/* Placeholder for future sidebar content */}
        </div>

        {/* Right Main Area: Terminal (Flex 1, Scrollable) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem',
          overflow: 'hidden' /* Internal overflow handled by Terminal */
        }}>
          {/* Pass height 100% to Terminal container to ensure it scrolls */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <Terminal history={gameState.history} />
          </div>
        </div>

      </div>

      {/* Footer: Input Area (Fixed Height) */}
      <div style={{
        padding: '1rem 2rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        flexShrink: 0
      }}>
        <InputArea
          options={currentOptions}
          onExecute={handleExecute}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}

export default App;
