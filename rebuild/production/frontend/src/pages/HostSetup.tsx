import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Steps,
  message,
  Typography,
  Tag,
  Divider,
  Select,
  Collapse,
  Spin,
  Alert,
  Table,
  Switch,
  Tooltip,
  Modal,
} from 'antd';
import {
  ReloadOutlined,
  RocketOutlined,
  SaveOutlined,
  QuestionCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { hostConfigAPI, HostConfig } from '../services/rooms';
import { gameAPI, gameInitAPI, GameInitResult } from '../services/game';
import { HelpButton } from '../components/HelpButton';
import { DEFAULT_GAME_RULES } from '../constants/defaultRules';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

// 主流 AI 模型提供商配置
const AI_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (推荐)' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4', name: 'GLM-4' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash' },
    ],
    defaultModel: 'glm-4',
  },
  {
    id: 'qwen',
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: [
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
    ],
    defaultModel: 'qwen-plus',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (月之暗面)',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    models: [
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K' },
      { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K' },
    ],
    defaultModel: 'moonshot-v1-32k',
  },
  {
    id: 'custom',
    name: '自定义',
    endpoint: '',
    models: [],
    defaultModel: '',
  },
];

type ApiFormValues = {
  provider: string;
  model: string;
  apiKey: string;
  endpoint: string;
  streamOutput: boolean;
  customHeaders?: string;
  customBodyTemplate?: string;
};

type RulesFormValues = {
  gameRules?: string;
};

type PlayerFormValues = {
  totalDecisionEntities: number;
  humanPlayerCount: number;
  aiPlayerCount: number;
  decisionTimeLimit: number;
  timeoutStrategy?: string;
};

type GameInitFormValues = {
  initialCash: number;
  gameMode: 'multi_control' | 'single_protagonist';
  industryTheme?: string;
};


function HostSetup() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<HostConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formApi] = Form.useForm<ApiFormValues>();
  const [formRules] = Form.useForm<RulesFormValues>();
  const [formPlayers] = Form.useForm<PlayerFormValues>();
  const [formInit] = Form.useForm<GameInitFormValues>();
  
  // API Key 显示状态
  const [showApiKey, setShowApiKey] = useState(false);
  
  // 当前选择的提供商
  const [selectedProvider, setSelectedProvider] = useState<string>('deepseek');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  
  // 游戏初始化状态
  const [initData, setInitData] = useState<GameInitResult | null>(null);
  const [generatingInit, setGeneratingInit] = useState(false);
  
  // 默认规则Modal状态
  const [defaultRulesVisible, setDefaultRulesVisible] = useState(false);
  
  // 标记是否已从服务器加载配置（防止 provider 变化时覆盖已保存的值）
  const [configLoaded, setConfigLoaded] = useState(false);

  const currentStep = useMemo(() => {
    if (config?.initializationCompleted) return 4;
    if (initData) return 3;
    if (config?.validationStatus === 'validated') return 2;
    return 1;
  }, [config, initData]);

  // 根据提供商更新可用模型（仅在用户手动切换且配置未加载时更新）
  useEffect(() => {
    const provider = AI_PROVIDERS.find(p => p.id === selectedProvider);
    if (provider) {
      setAvailableModels(provider.models);
      // 只有在配置未加载时才设置默认值，避免覆盖已保存的配置
      if (!configLoaded && provider.id !== 'custom') {
        formApi.setFieldsValue({
          endpoint: provider.endpoint,
          model: provider.defaultModel,
        });
      }
    }
  }, [selectedProvider, formApi, configLoaded]);

  // 加载配置并同步到表单
  const loadConfig = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      // 先检查房间状态，如果游戏已开始则重定向
      try {
        const session = await gameAPI.getActiveSessionByRoom(roomId);
        if (session && session.sessionId) {
          message.info('游戏已开始，正在跳转到游戏页面...');
          navigate(`/game/${session.sessionId}/state`, { replace: true });
          return;
        }
      } catch {
        // 没有活跃会话，继续加载配置
      }
      
      const data = await hostConfigAPI.get(roomId);
      setConfig(data);
      
      // 解析已保存的配置
      let provider = 'deepseek';
      let model = 'deepseek-chat';
      let apiKey = '';
      let streamOutput = false;
      
      // 从 headers 中提取 API Key
      if (data.apiHeaders) {
        const headers = data.apiHeaders as Record<string, string>;
        const authHeader = headers['Authorization'] || headers['authorization'];
        if (authHeader) {
          apiKey = authHeader.replace(/^Bearer\s+/i, '');
        }
      }
      
      // 从 bodyTemplate 中提取 model 和 stream
      if (data.apiBodyTemplate) {
        const body = data.apiBodyTemplate as Record<string, unknown>;
        if (body.model) model = body.model as string;
        if (body.stream !== undefined) streamOutput = body.stream as boolean;
      }
      
      // 识别提供商
      if (data.apiProvider) {
        provider = data.apiProvider;
      } else if (data.apiEndpoint) {
        const matchedProvider = AI_PROVIDERS.find(p => 
          p.endpoint && data.apiEndpoint?.includes(new URL(p.endpoint).hostname)
        );
        if (matchedProvider) provider = matchedProvider.id;
      }
      
      setSelectedProvider(provider);
      
      formApi.setFieldsValue({
        provider,
        model,
        apiKey,
        endpoint: data.apiEndpoint || '',
        streamOutput,
      });
      
      formRules.setFieldsValue({ gameRules: data.gameRules || undefined });
      formPlayers.setFieldsValue({
        totalDecisionEntities: data.totalDecisionEntities || undefined,
        humanPlayerCount: data.humanPlayerCount || undefined,
        aiPlayerCount: data.aiPlayerCount || undefined,
        decisionTimeLimit: data.decisionTimeLimit || undefined,
        timeoutStrategy: data.timeoutStrategy || undefined,
      });
      
      // 尝试加载已保存的初始化数据
      try {
        const savedInit = await gameInitAPI.getInit(roomId);
        if (savedInit) {
          setInitData(savedInit);
        }
      } catch {
        // 忽略，可能还没有初始化数据
      }
      
      // 标记配置已加载，防止 provider useEffect 覆盖已保存的值
      setConfigLoaded(true);
    } catch (error) {
      message.error((error as Error).message || '获取主持人配置失败');
    } finally {
      setLoading(false);
    }
  }, [roomId, formApi, formRules, formPlayers, navigate]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 构建 API 配置并保存
  const handleSaveApi = async (values: ApiFormValues) => {
    if (!roomId) return;
    
    if (!values.apiKey) {
      message.error('请输入 API Key');
      return;
    }
    
    setSaving(true);
    try {
      const provider = AI_PROVIDERS.find(p => p.id === values.provider);
      
      // 构建 headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${values.apiKey}`,
      };
      
      // 构建 body template
      const bodyTemplate: Record<string, unknown> = {
        model: values.model || provider?.defaultModel || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是《凡墙皆是门》游戏的推演引擎，根据玩家的决策和游戏规则，生成游戏剧情和结果。',
          },
          {
            role: 'user',
            content: '{{prompt}}',
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: values.streamOutput || false,
      };
      
      const payload = {
        apiProvider: values.provider,
        apiEndpoint: values.endpoint,
        apiHeaders: headers,
        apiBodyTemplate: bodyTemplate,
      };
      
      const data = await hostConfigAPI.updateApi(roomId, payload);
      setConfig(data);
      message.success('API 配置已保存');
    } catch (error) {
      message.error((error as Error).message || '保存 API 配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async (values: RulesFormValues) => {
    if (!roomId) return;
    setSaving(true);
    try {
      const data = await hostConfigAPI.updateRules(roomId, { gameRules: values.gameRules });
      setConfig(data);
      message.success('规则已保存');
    } catch (error) {
      message.error((error as Error).message || '保存规则失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlayers = async (values: PlayerFormValues) => {
    if (!roomId) return;
    setSaving(true);
    try {
      const data = await hostConfigAPI.updatePlayers(roomId, {
        totalDecisionEntities: values.totalDecisionEntities,
        humanPlayerCount: values.humanPlayerCount,
        aiPlayerCount: values.aiPlayerCount,
        decisionTimeLimit: values.decisionTimeLimit,
        timeoutStrategy: values.timeoutStrategy || 'auto_submit',
      });
      setConfig(data);
      message.success('玩家配置已保存');
    } catch (error) {
      message.error((error as Error).message || '保存玩家配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!roomId) return;
    setSaving(true);
    try {
      const data = await hostConfigAPI.validate(roomId, { status: 'validated' });
      setConfig(data);
      message.success('验证已通过');
    } catch (error) {
      message.error((error as Error).message || '验证失败');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!roomId) return;
    setSaving(true);
    try {
      const data = await hostConfigAPI.complete(roomId);
      setConfig(data);
      message.success('主持人配置已完成');
    } catch (error) {
      message.error((error as Error).message || '完成配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 生成游戏初始化数据（带进度轮询）
  const handleGenerateInit = async (values: GameInitFormValues) => {
    if (!roomId || !config) return;
    
    const entityCount = config.totalDecisionEntities || 4;
    if (entityCount < 2) {
      message.error('请先在玩家配置中设置主体数量（至少2个）');
      return;
    }

    // 检查API配置
    if (!config.apiEndpoint || !config.apiHeaders) {
      message.error('请先完成AI API配置');
      return;
    }

    setGeneratingInit(true);
    
    const hideLoading = message.loading({
      content: '正在生成初始化数据，这可能需要1-3分钟，请耐心等待...',
      duration: 0,
    });
    
    // 进度模拟定时器（给用户反馈）
    const progressSteps = [
      { time: 5000, msg: '正在构建游戏背景...', percent: 20 },
      { time: 15000, msg: '正在生成主体信息...', percent: 40 },
      { time: 30000, msg: '正在生成年度卦象...', percent: 60 },
      { time: 45000, msg: '正在生成初始选项...', percent: 80 },
      { time: 60000, msg: '即将完成，请稍候...', percent: 90 },
    ];
    
    const progressTimers: ReturnType<typeof setTimeout>[] = [];
    progressSteps.forEach(step => {
      const timer = setTimeout(() => {
        message.info(step.msg, 2);
      }, step.time);
      progressTimers.push(timer);
    });
    
    // 重试机制
    const maxRetries = 2;
    let currentAttempt = 0;
    
    const attemptGeneration = async (): Promise<any> => {
      currentAttempt++;
      
      try {
        console.log(`开始生成初始化数据... (尝试 ${currentAttempt}/${maxRetries + 1})`, {
          roomId,
          entityCount,
          gameMode: values.gameMode,
          initialCash: values.initialCash,
          industryTheme: values.industryTheme,
          apiEndpoint: config.apiEndpoint,
          hasApiHeaders: !!config.apiHeaders
        });

        const result = await gameInitAPI.generateInit(roomId, {
          entityCount,
          gameMode: values.gameMode,
          initialCash: values.initialCash,
          industryTheme: values.industryTheme,
        });
        
        console.log('初始化数据生成成功:', result);
        return result;
      } catch (error: any) {
        console.error(`Generate init error (attempt ${currentAttempt}):`, error);
        
        // 如果是超时错误且还有重试次数，则重试
        if ((error.code === 'ECONNABORTED' || error.message?.includes('timeout')) && currentAttempt <= maxRetries) {
          message.warning(`第${currentAttempt}次尝试超时，正在重试... (${currentAttempt}/${maxRetries + 1})`);
          // 等待2秒后重试
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptGeneration();
        }
        
        throw error;
      }
    };
    
    try {
      const result = await attemptGeneration();
      setInitData(result);
      message.success('游戏初始化数据生成成功！');
    } catch (error: any) {
      console.error('Generate init error:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '生成初始化数据失败';
      
      if (error.message?.includes('超时') || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = `AI生成超时（已重试${maxRetries}次）。根据后端日志显示，AI初始化过程正在正常进行中，这通常需要1-5分钟时间。建议：1) 检查网络连接稳定性 2) 稍后再试 3) 如果问题持续，可能是网络环境限制`;
      } else if (error.response?.status === 401 || error.message?.includes('认证')) {
        errorMessage = 'API密钥无效或已过期，请检查AI API配置中的密钥是否正确';
      } else if (error.response?.status === 404 || error.message?.includes('端点')) {
        errorMessage = 'API端点不存在，请检查AI API配置中的端点地址';
      } else if (error.response?.status === 429) {
        errorMessage = 'API调用频率超限，请稍后重试';
      } else if (error.response?.status >= 500) {
        errorMessage = 'AI服务器错误，请稍后重试';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
      
      // 显示详细错误信息供调试
      if (error.response?.data) {
        console.error('API Error Details:', error.response.data);
      }
      
      // 显示网络错误详情
      if (error.code) {
        console.error('Network Error Code:', error.code);
        
        // 为ECONNABORTED提供特殊提示
        if (error.code === 'ECONNABORTED') {
          message.info('提示：AI初始化可能仍在后台进行，建议等待30秒后刷新页面查看', 10);
        }
      }
    } finally {
      // 清理所有进度定时器
      progressTimers.forEach(timer => clearTimeout(timer));
      hideLoading();
      setGeneratingInit(false);
    }
  };

  // 保存初始化数据
  const handleSaveInit = async () => {
    if (!roomId || !initData) return;
    setSaving(true);
    try {
      await gameInitAPI.saveInit(roomId, initData);
      message.success('初始化数据已保存');
    } catch (error) {
      message.error((error as Error).message || '保存初始化数据失败');
    } finally {
      setSaving(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomId) return;
    setSaving(true);
    try {
      const session = await gameAPI.startGame(roomId);
      message.success('游戏已开始！');
      navigate(`/game/${session.sessionId}`);
    } catch (error) {
      message.error((error as Error).message || '开始游戏失败');
    } finally {
      setSaving(false);
    }
  };


  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: 24 }}>
      <Space align="center">
        <Button onClick={() => navigate(-1)}>返回</Button>
        <Title level={3} style={{ margin: 0 }}>
          主持人初始化配置
        </Title>
        <Tag color="blue">房间ID: {roomId}</Tag>
        {config?.validationStatus && (
          <Tag color={config.validationStatus === 'validated' ? 'green' : 'orange'}>
            验证: {config.validationStatus}
          </Tag>
        )}
        {config?.initializationCompleted && <Tag color="green">配置完成</Tag>}
        <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
          刷新
        </Button>
        <HelpButton />
      </Space>

      <Steps
        current={currentStep}
        items={[
          { title: 'API配置' },
          { title: '规则与玩家' },
          { title: '游戏初始化' },
          { title: '验证' },
          { title: '完成' },
        ]}
      />

      {/* Step 1 - API 配置（简化版） */}
      <Card title="Step 1 - AI 模型配置" loading={loading}>
        <Form form={formApi} layout="vertical" onFinish={handleSaveApi} initialValues={{ provider: 'deepseek', streamOutput: false }}>
          {/* 提供商选择 */}
          <Form.Item
            label="AI 服务提供商"
            name="provider"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select
              placeholder="选择 AI 服务提供商"
              onChange={(value) => setSelectedProvider(value)}
              options={AI_PROVIDERS.map(p => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>

          {/* 模型选择 */}
          <Form.Item
            label="模型"
            name="model"
            rules={[{ required: selectedProvider !== 'custom', message: '请选择模型' }]}
          >
            {selectedProvider === 'custom' ? (
              <Input placeholder="输入模型名称，如 gpt-4" />
            ) : (
              <Select
                placeholder="选择模型"
                options={availableModels.map(m => ({ value: m.id, label: m.name }))}
              />
            )}
          </Form.Item>

          {/* API Key 输入 */}
          <Form.Item
            label={
              <Space>
                API Key
                <Tooltip title="从对应服务商获取的 API 密钥，用于调用 AI 服务">
                  <QuestionCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            name="apiKey"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password
              placeholder="sk-xxxxxxxxxxxxxxxx"
              visibilityToggle={{
                visible: showApiKey,
                onVisibleChange: setShowApiKey,
              }}
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          {/* API Endpoint（自定义时显示） */}
          <Form.Item
            label="API Endpoint"
            name="endpoint"
            rules={[{ required: true, message: '请输入 API 地址' }]}
            hidden={selectedProvider !== 'custom'}
          >
            <Input placeholder="https://api.example.com/v1/chat/completions" />
          </Form.Item>

          {/* 流式输出开关 */}
          <Form.Item
            label={
              <Space>
                流式输出
                <Tooltip title="开启后 AI 响应会逐字显示，但目前后端暂不支持，建议关闭">
                  <QuestionCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            name="streamOutput"
            valuePropName="checked"
          >
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>

          {/* 高级配置（折叠） */}
          {selectedProvider === 'custom' && (
            <Collapse ghost style={{ marginBottom: 16 }}>
              <Panel header="高级配置（可选）" key="advanced">
                <Form.Item label="自定义 Headers (JSON)" name="customHeaders">
                  <TextArea rows={3} placeholder='{"X-Custom-Header": "value"}' />
                </Form.Item>
                <Form.Item label="自定义 Body 模板 (JSON)" name="customBodyTemplate">
                  <TextArea rows={4} placeholder='使用 {{prompt}} 作为占位符' />
                </Form.Item>
              </Panel>
            </Collapse>
          )}

          <Button type="primary" htmlType="submit" loading={saving}>
            保存 API 配置
          </Button>
        </Form>

        {/* 配置提示 */}
        <Alert
          message="配置说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>推荐使用 DeepSeek，性价比高且效果好</li>
              <li>API Key 请从对应服务商官网获取</li>
              <li>流式输出目前后端暂不支持，建议保持关闭</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* Step 2 - 规则与玩家配置 */}
      <Card title="Step 2 - 规则与玩家配置" loading={loading}>
        <Form form={formRules} layout="vertical" onFinish={handleSaveRules}>
          <Form.Item 
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>游戏规则 (Markdown 可选)</span>
                <Button 
                  type="link" 
                  size="small"
                  icon={<BookOutlined />}
                  onClick={() => setDefaultRulesVisible(true)}
                >
                  查看默认蓝本规则
                </Button>
              </div>
            } 
            name="gameRules"
          >
            <TextArea 
              rows={6} 
              placeholder="在此描述游戏规则，留空则使用默认的《凡墙皆是门》蓝本规则..." 
            />
          </Form.Item>
          
          <Alert
            message="规则配置说明"
            description={
              <div>
                <p style={{ margin: '0 0 8px 0' }}>• 留空将自动使用《凡墙皆是门》默认蓝本规则</p>
                <p style={{ margin: '0 0 8px 0' }}>• 支持 Markdown 格式，可以添加标题、列表等</p>
                <p style={{ margin: 0 }}>• 点击右上角"查看默认蓝本规则"可以参考完整的默认规则</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存规则
            </Button>
          </Space>
        </Form>

        <Divider />

        <Form form={formPlayers} layout="vertical" onFinish={handleSavePlayers}>
          <Alert
            message="人数配置公式"
            description="人类玩家数 + AI玩家数 = 总决策主体数"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            label="总决策主体数"
            name="totalDecisionEntities"
            rules={[{ required: true, message: '请输入总主体数' }]}
            tooltip="游戏中参与决策的企业/角色总数（人类玩家 + AI玩家）"
          >
            <InputNumber 
              min={2} 
              max={10} 
              placeholder="2-10" 
              style={{ width: 120 }} 
              onChange={(value) => {
                if (value) {
                  const humanCount = formPlayers.getFieldValue('humanPlayerCount') || 0;
                  const aiCount = value - humanCount;
                  if (aiCount >= 0) {
                    formPlayers.setFieldsValue({ aiPlayerCount: aiCount });
                  }
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="人类玩家数"
            name="humanPlayerCount"
            rules={[
              { required: true, message: '请输入人类玩家数' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const total = getFieldValue('totalDecisionEntities');
                  const aiCount = getFieldValue('aiPlayerCount') || 0;
                  if (total && value + aiCount !== total) {
                    return Promise.reject(new Error(`人类玩家(${value}) + AI玩家(${aiCount}) 必须等于总主体数(${total})`));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber 
              min={1} 
              placeholder="请输入..." 
              style={{ width: 120 }} 
              onChange={(value) => {
                if (value !== null && value !== undefined) {
                  const total = formPlayers.getFieldValue('totalDecisionEntities');
                  if (total) {
                    const aiCount = total - value;
                    formPlayers.setFieldsValue({ aiPlayerCount: Math.max(0, aiCount) });
                  }
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="AI玩家数"
            name="aiPlayerCount"
            rules={[
              { required: true, message: '请输入AI玩家数' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const total = getFieldValue('totalDecisionEntities');
                  const humanCount = getFieldValue('humanPlayerCount') || 0;
                  if (total && humanCount + value !== total) {
                    return Promise.reject(new Error(`人类玩家(${humanCount}) + AI玩家(${value}) 必须等于总主体数(${total})`));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber 
              min={0} 
              placeholder="请输入..." 
              style={{ width: 120 }} 
              onChange={(value) => {
                if (value !== null && value !== undefined) {
                  const total = formPlayers.getFieldValue('totalDecisionEntities');
                  if (total) {
                    const humanCount = total - value;
                    formPlayers.setFieldsValue({ humanPlayerCount: Math.max(1, humanCount) });
                  }
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="决策时限(分钟)"
            name="decisionTimeLimit"
            rules={[{ required: true, message: '请输入决策时限' }]}
          >
            <InputNumber min={1} max={30} placeholder="1-30" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item label="超时策略" name="timeoutStrategy">
            <Select placeholder="选择超时策略" style={{ width: 200 }}>
              <Select.Option value="auto_submit">自动提交（推荐）</Select.Option>
              <Select.Option value="skip">跳过本回合</Select.Option>
              <Select.Option value="extend">延长时间</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存玩家配置
          </Button>
        </Form>
      </Card>


      {/* Step 3 - 游戏初始化 */}
      <Card title="Step 3 - 游戏初始化（AI生成）" loading={loading}>
        <Alert
          message="游戏初始化向导"
          description="配置初始参数后，AI 将自动生成商业背景故事、主体初始状态、年度卦象和初始决策选项。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Form form={formInit} layout="vertical" onFinish={handleGenerateInit}>
          <Form.Item
            label="初始资金（元）"
            name="initialCash"
            rules={[{ required: true, message: '请输入初始资金' }]}
            initialValue={1000000}
          >
            <InputNumber
              min={10000}
              step={100000}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item
            label="游戏模式"
            name="gameMode"
            rules={[{ required: true, message: '请选择游戏模式' }]}
            initialValue="multi_control"
          >
            <Select>
              <Select.Option value="multi_control">多主体操控模式（所有主体由玩家控制）</Select.Option>
              <Select.Option value="single_protagonist">单主角模式（玩家控制一个主体）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="行业主题（可选）" name="industryTheme">
            <Input placeholder="如：科技、零售、制造、金融..." />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<RocketOutlined />}
              loading={generatingInit}
              disabled={!config?.totalDecisionEntities || config.totalDecisionEntities < 2}
            >
              {generatingInit ? '正在生成...' : '生成初始化数据'}
            </Button>
            {initData && (
              <Button icon={<SaveOutlined />} onClick={handleSaveInit} loading={saving}>
                保存初始化数据
              </Button>
            )}
            {initData && (
              <Button icon={<ReloadOutlined />} onClick={() => setInitData(null)}>
                重新生成
              </Button>
            )}
          </Space>
        </Form>

        {generatingInit && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>AI 正在生成游戏初始化数据，请稍候...</Paragraph>
          </div>
        )}

        {initData && !generatingInit && (
          <div style={{ marginTop: 24 }}>
            <Divider>生成结果预览</Divider>
            
            <Collapse defaultActiveKey={['story', 'entities']}>
              <Panel header="商业背景故事" key="story">
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {initData.backgroundStory}
                </Paragraph>
              </Panel>
              
              <Panel header={`主体初始状态（${initData.entities.length}个）`} key="entities">
                <Table
                  dataSource={initData.entities}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'ID', dataIndex: 'id', width: 60 },
                    { title: '名称', dataIndex: 'name', width: 120 },
                    {
                      title: '初始资金',
                      dataIndex: 'cash',
                      render: (v: number) => `¥${v.toLocaleString()}`,
                    },
                    {
                      title: '被动收入',
                      dataIndex: 'passiveIncome',
                      render: (v: number) => `+¥${v.toLocaleString()}`,
                    },
                    {
                      title: '被动支出',
                      dataIndex: 'passiveExpense',
                      render: (v: number) => `-¥${v.toLocaleString()}`,
                    },
                    {
                      title: '属性',
                      dataIndex: 'attributes',
                      render: (attrs: Record<string, number>) =>
                        Object.entries(attrs || {})
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', '),
                    },
                  ]}
                />
              </Panel>
              
              <Panel header="年度卦象" key="hexagram">
                <Space direction="vertical">
                  <Text strong>
                    {initData.yearlyHexagram.name}
                    <Tag
                      color={
                        initData.yearlyHexagram.omen === 'positive'
                          ? 'green'
                          : initData.yearlyHexagram.omen === 'negative'
                          ? 'red'
                          : 'default'
                      }
                      style={{ marginLeft: 8 }}
                    >
                      {initData.yearlyHexagram.omen === 'positive'
                        ? '吉'
                        : initData.yearlyHexagram.omen === 'negative'
                        ? '凶'
                        : '中'}
                    </Tag>
                  </Text>
                  <Text type="secondary">
                    爻象：{initData.yearlyHexagram.lines.join(' ')}
                  </Text>
                  <Paragraph>{initData.yearlyHexagram.text}</Paragraph>
                  {initData.yearlyHexagram.yearlyTheme && (
                    <Text>年度主题：{initData.yearlyHexagram.yearlyTheme}</Text>
                  )}
                </Space>
              </Panel>
              
              <Panel header="初始决策选项" key="options">
                {initData.initialOptions.map((opt) => (
                  <Card key={opt.id} size="small" style={{ marginBottom: 8 }}>
                    <Text strong>
                      {opt.id}. {opt.title}
                    </Text>
                    <Paragraph type="secondary" style={{ margin: '4px 0' }}>
                      {opt.description}
                    </Paragraph>
                    {opt.expectedDelta && (
                      <Space wrap>
                        {Object.entries(opt.expectedDelta).map(([k, v]) => {
                          // 处理嵌套对象的情况（如按主体分组的预期变化）
                          if (typeof v === 'object' && v !== null) {
                            return Object.entries(v).map(([subK, subV]) => (
                              <Tag key={`${k}-${subK}`} color={typeof subV === 'number' && subV >= 0 ? 'green' : 'red'}>
                                {k}/{subK}: {typeof subV === 'number' ? (subV >= 0 ? '+' : '') + subV : String(subV)}
                              </Tag>
                            ));
                          }
                          // 处理普通数值
                          const numVal = typeof v === 'number' ? v : 0;
                          return (
                            <Tag key={k} color={numVal >= 0 ? 'green' : 'red'}>
                              {k}: {numVal >= 0 ? '+' : ''}{numVal}
                            </Tag>
                          );
                        })}
                      </Space>
                    )}
                  </Card>
                ))}
              </Panel>
              
              <Panel header="资金公式" key="formula">
                <Text code>{initData.cashFormula}</Text>
              </Panel>
            </Collapse>
          </div>
        )}
      </Card>

      {/* Step 4 - 验证与完成 */}
      <Card title="Step 4 - 验证与完成" loading={loading}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>当前状态：</Text>
            <Tag color={config?.validationStatus === 'validated' ? 'green' : 'orange'}>
              {config?.validationStatus || 'pending'}
            </Tag>
          </div>
          <Space>
            <Button type="primary" onClick={handleValidate} loading={saving}>
              标记验证通过
            </Button>
            <Button
              onClick={handleComplete}
              loading={saving}
              disabled={config?.initializationCompleted}
            >
              完成配置
            </Button>
            {config?.initializationCompleted && (
              <Button
                type="primary"
                danger
                onClick={handleStartGame}
                loading={saving}
              >
                开始游戏
              </Button>
            )}
          </Space>
          {config?.configurationCompletedAt && (
            <Text type="secondary">
              完成时间：{new Date(config.configurationCompletedAt).toLocaleString()}
            </Text>
          )}
        </Space>
      </Card>

      {/* 配置快照 */}
      <Card
        title="当前配置快照"
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={loadConfig}>
            刷新快照
          </Button>
        }
      >
        {config ? (
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(config, null, 2)}
          </pre>
        ) : (
          <Text type="secondary">尚未加载配置</Text>
        )}
      </Card>

      {/* 默认规则查看Modal */}
      <Modal
        title={
          <Space>
            <BookOutlined />
            <span>《凡墙皆是门》默认蓝本规则</span>
          </Space>
        }
        open={defaultRulesVisible}
        onCancel={() => setDefaultRulesVisible(false)}
        width={800}
        footer={[
          <Button 
            key="copy" 
            onClick={() => {
              navigator.clipboard.writeText(DEFAULT_GAME_RULES);
              message.success('规则已复制到剪贴板');
            }}
          >
            复制规则
          </Button>,
          <Button 
            key="use" 
            type="primary"
            onClick={() => {
              formRules.setFieldsValue({ gameRules: DEFAULT_GAME_RULES });
              setDefaultRulesVisible(false);
              message.success('默认规则已填入表单，请记得保存');
            }}
          >
            使用此规则
          </Button>,
          <Button key="close" onClick={() => setDefaultRulesVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ 
          maxHeight: '60vh', 
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #d9d9d9'
        }}>
          <div style={{ 
            whiteSpace: 'pre-wrap', 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.8',
            color: '#262626',
            margin: 0
          }}>
            {DEFAULT_GAME_RULES.split('\n').map((line, index) => {
              if (line.startsWith('# ')) {
                return <h1 key={index} style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff', marginBottom: '16px', marginTop: index > 0 ? '24px' : '0' }}>{line.substring(2)}</h1>;
              } else if (line.startsWith('## ')) {
                return <h2 key={index} style={{ fontSize: '16px', fontWeight: 'bold', color: '#52c41a', marginBottom: '12px', marginTop: '20px' }}>{line.substring(3)}</h2>;
              } else if (line.startsWith('### ')) {
                return <h3 key={index} style={{ fontSize: '14px', fontWeight: 'bold', color: '#fa8c16', marginBottom: '8px', marginTop: '16px' }}>{line.substring(4)}</h3>;
              } else if (line.startsWith('- ')) {
                return <div key={index} style={{ marginLeft: '16px', marginBottom: '4px' }}>• {line.substring(2)}</div>;
              } else if (line.trim() === '') {
                return <div key={index} style={{ height: '8px' }} />;
              } else {
                return <div key={index} style={{ marginBottom: '4px' }}>{line}</div>;
              }
            })}
          </div>
        </div>
        <Alert
          message="使用说明"
          description="这是《凡墙皆是门》游戏的默认规则蓝本。您可以直接使用这些规则，也可以根据需要进行修改。留空规则配置将自动使用此默认蓝本。"
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </Space>
  );
}

export default HostSetup;
