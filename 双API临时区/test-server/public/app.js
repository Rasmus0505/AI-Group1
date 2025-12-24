/**
 * 双API测试前端逻辑
 */

// 游戏状态
let gameState = {
  round: 0,
  narrative: '',
  parserRawText: '',
  panelData: null,
  parseSuccess: false
};

// 获取API配置
function getNarrativeConfig() {
  return {
    endpoint: document.getElementById('narrativeEndpoint').value,
    apiKey: document.getElementById('narrativeApiKey').value,
    model: document.getElementById('narrativeModel').value || 'deepseek-chat'
  };
}

function getParserConfig() {
  return {
    endpoint: document.getElementById('parserEndpoint').value,
    apiKey: document.getElementById('parserApiKey').value || document.getElementById('narrativeApiKey').value,
    model: document.getElementById('parserModel').value || 'deepseek-chat'
  };
}

// 复制API Key
function copyNarrativeKey() {
  document.getElementById('parserApiKey').value = document.getElementById('narrativeApiKey').value;
  showStatus('已复制', 'success');
}

// 显示状态
function showStatus(message, type = 'loading') {
  const bar = document.getElementById('statusBar');
  bar.textContent = message;
  bar.className = 'status ' + type;
  bar.style.display = 'block';
  if (type !== 'loading') {
    setTimeout(() => { bar.style.display = 'none'; }, 3000);
  }
}

// 更新步骤指示器
function updateSteps(current) {
  ['step1', 'step2', 'step3', 'step4'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.className = 'step';
    if (i + 1 < current) el.className = 'step done';
    if (i + 1 === current) el.className = 'step active';
  });
}

// 初始化游戏
async function initGame() {
  const narrativeConfig = getNarrativeConfig();
  const parserConfig = getParserConfig();
  
  if (!narrativeConfig.apiKey) {
    showStatus('请输入剧情API Key', 'error');
    return;
  }

  showStatus('正在初始化游戏，生成背景故事...', 'loading');
  document.getElementById('btnInit').disabled = true;
  updateSteps(1);

  try {
    const response = await fetch('/api/dual/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narrativeConfig, parserConfig })
    });
    
    const result = await response.json();
    
    if (result.success) {
      gameState.round = 1;
      gameState.narrative = result.narrative;
      gameState.parserRawText = result.parserRawText || '';
      gameState.panelData = result.panelData;
      gameState.parseSuccess = result.parseSuccess;
      
      // 更新UI
      document.getElementById('currentRound').textContent = '1';
      document.getElementById('gameStatus').textContent = '进行中';
      document.getElementById('gameStatus').style.color = '#34d399';
      
      // 显示剧情
      document.getElementById('narrativeSection').style.display = 'block';
      document.getElementById('narrativeOutput').textContent = result.narrative;
      
      // 显示解析结果
      document.getElementById('parserSection').style.display = 'block';
      document.getElementById('parserOutput').textContent = result.parserRawText || '(无解析输出)';
      document.getElementById('parseStatus').textContent = result.parseSuccess ? '✓ JSON解析成功' : '⚠ JSON解析失败';
      document.getElementById('parseStatus').style.color = result.parseSuccess ? '#34d399' : '#fbbf24';
      
      // 显示决策区
      document.getElementById('decisionsSection').style.display = 'block';
      
      // 更新按钮
      document.getElementById('btnInit').style.display = 'none';
      document.getElementById('btnNarrative').disabled = true;
      document.getElementById('btnParse').disabled = true;
      document.getElementById('btnNextRound').disabled = false;
      
      updateSteps(3);
      showStatus('初始化完成！请输入玩家决策后点击"下一回合"', 'success');
    } else {
      showStatus('初始化失败: ' + result.error, 'error');
      document.getElementById('btnInit').disabled = false;
    }
  } catch (error) {
    showStatus('请求失败: ' + error.message, 'error');
    document.getElementById('btnInit').disabled = false;
  }
}

// 生成剧情
async function generateNarrative() {
  const config = getNarrativeConfig();
  
  // 收集决策
  const decisions = [];
  const decA = document.getElementById('decisionA').value.trim();
  const decB = document.getElementById('decisionB').value.trim();
  const decC = document.getElementById('decisionC').value.trim();
  if (decA) decisions.push('主体A: ' + decA);
  if (decB) decisions.push('主体B: ' + decB);
  if (decC) decisions.push('主体C: ' + decC);
  
  const extraPrompt = document.getElementById('extraPrompt').value.trim();

  showStatus(`正在生成第${gameState.round}回合剧情...`, 'loading');
  document.getElementById('btnNarrative').disabled = true;
  updateSteps(1);

  try {
    const response = await fetch('/api/dual/narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        currentRound: gameState.round,
        previousParserOutput: gameState.parserRawText,
        playerDecisions: decisions,
        extraPrompt
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      gameState.narrative = result.narrative;
      
      document.getElementById('narrativeOutput').textContent = result.narrative;
      document.getElementById('btnParse').disabled = false;
      
      updateSteps(2);
      showStatus('剧情生成完成！点击"解析数据"继续', 'success');
    } else {
      showStatus('剧情生成失败: ' + result.error, 'error');
      document.getElementById('btnNarrative').disabled = false;
    }
  } catch (error) {
    showStatus('请求失败: ' + error.message, 'error');
    document.getElementById('btnNarrative').disabled = false;
  }
}

// 解析数据
async function parseData() {
  const config = getParserConfig();

  showStatus('正在解析数据...', 'loading');
  document.getElementById('btnParse').disabled = true;

  try {
    const response = await fetch('/api/dual/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        narrative: gameState.narrative
      })
    });
    
    const result = await response.json();
    
    gameState.parserRawText = result.rawText || '';
    gameState.panelData = result.panelData;
    gameState.parseSuccess = result.parseSuccess;
    
    document.getElementById('parserOutput').textContent = result.rawText || '(无输出)';
    document.getElementById('parseStatus').textContent = result.parseSuccess ? '✓ JSON解析成功' : '⚠ JSON解析失败';
    document.getElementById('parseStatus').style.color = result.parseSuccess ? '#34d399' : '#fbbf24';
    
    document.getElementById('btnNextRound').disabled = false;
    
    updateSteps(3);
    showStatus('解析完成！输入决策后点击"下一回合"', 'success');
  } catch (error) {
    showStatus('请求失败: ' + error.message, 'error');
    document.getElementById('btnParse').disabled = false;
  }
}

// 下一回合
function nextRound() {
  gameState.round++;
  document.getElementById('currentRound').textContent = gameState.round;
  
  // 清空决策输入
  document.getElementById('decisionA').value = '';
  document.getElementById('decisionB').value = '';
  document.getElementById('decisionC').value = '';
  document.getElementById('extraPrompt').value = '';
  
  // 更新按钮状态
  document.getElementById('btnNarrative').disabled = false;
  document.getElementById('btnParse').disabled = true;
  document.getElementById('btnNextRound').disabled = true;
  
  updateSteps(1);
  showStatus(`第${gameState.round}回合开始，请输入决策后点击"生成剧情"`, 'success');
}

// 重置游戏
function resetGame() {
  gameState = { round: 0, narrative: '', parserRawText: '', panelData: null, parseSuccess: false };
  
  document.getElementById('currentRound').textContent = '0';
  document.getElementById('gameStatus').textContent = '未开始';
  document.getElementById('gameStatus').style.color = '#6a6a8a';
  
  document.getElementById('narrativeSection').style.display = 'none';
  document.getElementById('parserSection').style.display = 'none';
  document.getElementById('decisionsSection').style.display = 'none';
  document.getElementById('statusBar').style.display = 'none';
  
  document.getElementById('btnInit').style.display = 'inline-block';
  document.getElementById('btnInit').disabled = false;
  document.getElementById('btnNarrative').disabled = true;
  document.getElementById('btnParse').disabled = true;
  document.getElementById('btnNextRound').disabled = true;
  
  document.getElementById('decisionA').value = '';
  document.getElementById('decisionB').value = '';
  document.getElementById('decisionC').value = '';
  document.getElementById('extraPrompt').value = '';
  
  updateSteps(0);
}
