import { useEffect, useState, useMemo } from 'react';
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
  Collapse,
  Select,
} from 'antd';
import { hostConfigAPI, HostConfig } from '../services/rooms';
import { gameAPI } from '../services/game';
import { PRESET_MODELS, DEFAULT_MODEL, AIModelConfig } from '../constants/aiModels';

const { Title, Text } = Typography;
const { TextArea } = Input;

const safeParseJson = (value?: string) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('JSON 解析失败，请检查格式');
  }
};

type ApiFormValues = {
  apiProvider?: string;
  apiEndpoint?: string;
  apiKey?: string;
  apiHeaders?: string;
  apiBodyTemplate?: string;
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

function HostSetup() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<HostConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModelConfig | null>(null);
  const [formApi] = Form.useForm();
  const [formRules] = Form.useForm();
  const [formPlayers] = Form.useForm();

  const currentStep = useMemo(() => {
    if (config?.initializationCompleted) return 3;
    if (config?.validationStatus === 'validated') return 2;
    return 1;
  }, [config]);

  const extractApiKey = (headers: Record<string, unknown> | null | undefined): string => {
    if (!headers || typeof headers !== 'object') return '';
    const authHeader = headers['Authorization'] || headers['authorization'];
    if (typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      return match ? match[1] : '';
    }
    return '';
  };

  const loadConfig = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await hostConfigAPI.get(roomId);
      setConfig(data);
      const apiKey = extractApiKey(data.apiHeaders);
      
      // Find matching preset model or use default
      let modelConfig: AIModelConfig | null = null;
      if (data.apiProvider && data.apiEndpoint) {
        modelConfig = PRESET_MODELS.find(
          m => m.provider === data.apiProvider && 
               m.endpoint === data.apiEndpoint
        ) || null;
      }
      
      // If no match found, use default model (DeepSeek Chat)
      if (!modelConfig) {
        modelConfig = DEFAULT_MODEL;
      }
      
      setSelectedModel(modelConfig);
      
      // Set form values with defaults if missing
      formApi.setFieldsValue({
        apiProvider: data.apiProvider || modelConfig.provider,
        apiEndpoint: data.apiEndpoint || modelConfig.endpoint,
        apiKey: apiKey,
        apiHeaders: data.apiHeaders ? JSON.stringify(data.apiHeaders, null, 2) : 
                    JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
        apiBodyTemplate: data.apiBodyTemplate ? JSON.stringify(data.apiBodyTemplate, null, 2) : 
                        JSON.stringify(modelConfig.bodyTemplate, null, 2),
      });
      formRules.setFieldsValue({ gameRules: data.gameRules });
      formPlayers.setFieldsValue({
        totalDecisionEntities: data.totalDecisionEntities,
        humanPlayerCount: data.humanPlayerCount,
        aiPlayerCount: data.aiPlayerCount,
        decisionTimeLimit: data.decisionTimeLimit,
        timeoutStrategy: data.timeoutStrategy,
      });
    } catch (error) {
      message.error((error as Error).message || '获取主持人配置失败');
      // Set default values on error
      setSelectedModel(DEFAULT_MODEL);
      formApi.setFieldsValue({
        apiProvider: DEFAULT_MODEL.provider,
        apiEndpoint: DEFAULT_MODEL.endpoint,
        apiKey: '',
        apiHeaders: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
        apiBodyTemplate: JSON.stringify(DEFAULT_MODEL.bodyTemplate, null, 2),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Set default values if config is empty
  useEffect(() => {
    if (!config && roomId && !loading) {
      setSelectedModel(DEFAULT_MODEL);
      formApi.setFieldsValue({
        apiProvider: DEFAULT_MODEL.provider,
        apiEndpoint: DEFAULT_MODEL.endpoint,
        apiKey: '',
        apiHeaders: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
        apiBodyTemplate: JSON.stringify(DEFAULT_MODEL.bodyTemplate, null, 2),
      });
    }
  }, [config, roomId, loading, formApi]);

  const handleModelSelect = (value: string) => {
    const model = PRESET_MODELS.find(m => `${m.provider}-${m.model}` === value);
    if (model && model.provider !== 'custom') {
      setSelectedModel(model);
      formApi.setFieldsValue({
        apiProvider: model.provider,
        apiEndpoint: model.endpoint,
        apiBodyTemplate: JSON.stringify(model.bodyTemplate, null, 2),
      });
    } else {
      setSelectedModel(null);
      formApi.setFieldsValue({
        apiProvider: '',
        apiEndpoint: '',
        apiBodyTemplate: '',
      });
    }
  };

  const getModelSelectValue = (): string | undefined => {
    if (!selectedModel) return undefined;
    return `${selectedModel.provider}-${selectedModel.model}`;
  };

  const handleSaveApi = async (values: ApiFormValues) => {
    if (!roomId) return;
    setSaving(true);
    try {
      // Build headers: prioritize apiKey if provided, otherwise use apiHeaders JSON
      let apiHeaders: Record<string, unknown> | undefined;
      if (values.apiKey && values.apiKey.trim()) {
        apiHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${values.apiKey.trim()}`
        };
      } else if (values.apiHeaders) {
        apiHeaders = safeParseJson(values.apiHeaders);
      }

      // Auto-fill body template if provider is deepseek and template is empty
      let apiBodyTemplate = safeParseJson(values.apiBodyTemplate);
      if (values.apiProvider === 'deepseek' && !apiBodyTemplate) {
        apiBodyTemplate = {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个游戏推演引擎，根据玩家的决策和游戏规则，生成游戏剧情和结果。'
            },
            {
              role: 'user',
              content: '{{prompt}}'
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          stream: true
        };
      } else if (values.apiProvider === 'deepseek' && apiBodyTemplate && typeof apiBodyTemplate === 'object') {
        // Ensure stream is enabled for deepseek
        apiBodyTemplate = { ...apiBodyTemplate, stream: true };
      }

      const payload = {
        apiProvider: values.apiProvider,
        apiEndpoint: values.apiEndpoint,
        apiHeaders: apiHeaders,
        apiBodyTemplate: apiBodyTemplate,
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
      </Space>

      <Steps
        current={currentStep}
        items={[
          { title: 'API配置' },
          { title: '规则与玩家配置' },
          { title: '验证' },
          { title: '完成' },
        ]}
      />

      <Card title="Step 1 - API配置" loading={loading}>
        <Form form={formApi} layout="vertical" onFinish={handleSaveApi}>
          <Form.Item 
            label="预置模型" 
            name="presetModel"
            extra="选择预置模型将自动填充配置，或选择自定义进行手动配置"
          >
            <Select
              placeholder="选择预置模型"
              onChange={handleModelSelect}
              value={getModelSelectValue()}
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            >
              {PRESET_MODELS.map(model => {
                const providerColor = 
                  model.provider === 'deepseek' ? 'blue' : 
                  model.provider === 'openai' ? 'green' : 
                  model.provider === 'anthropic' ? 'purple' : 
                  model.provider === 'google' ? 'orange' : 'default';
                return (
                  <Select.Option 
                    key={`${model.provider}-${model.model}`} 
                    value={`${model.provider}-${model.model}`}
                  >
                    <Space>
                      <Tag color={providerColor}>{model.provider}</Tag>
                      <span>{model.name}</span>
                      {model.description && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          - {model.description}
                        </Text>
                      )}
                    </Space>
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item label="服务提供商" name="apiProvider">
            <Input placeholder="例如 deepseek / openai / custom" />
          </Form.Item>
          <Form.Item label="API Endpoint" name="apiEndpoint">
            <Input placeholder="https://api.deepseek.com/v1/chat/completions" />
          </Form.Item>
          <Form.Item 
            label="API Key" 
            name="apiKey"
            extra="输入你的 API Key，系统会自动构建 Authorization Header"
          >
            <Input.Password 
              placeholder="输入你的 API Key（例如：sk-xxxxxxxxxxxxx）"
              addonBefore="Bearer"
            />
          </Form.Item>
          <Collapse ghost>
            <Collapse.Panel header="高级配置（可选）" key="advanced">
              <Form.Item label="Headers (JSON)" name="apiHeaders">
                <TextArea rows={4} placeholder='{"Authorization":"Bearer xxx","Content-Type":"application/json"}' />
              </Form.Item>
              <Form.Item 
                label="Body 模板 (JSON)" 
                name="apiBodyTemplate"
                extra="选择 deepseek 作为服务提供商时，如果留空将自动使用默认的流式输出模板"
              >
                <TextArea rows={8} placeholder='{"model":"deepseek-chat","messages":[{"role":"system","content":"..."}],"temperature":0.7,"max_tokens":2000,"stream":true}' />
              </Form.Item>
            </Collapse.Panel>
          </Collapse>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存 API 配置
          </Button>
        </Form>
      </Card>

      <Card title="Step 2 - 规则与玩家配置" loading={loading}>
        <Form form={formRules} layout="vertical" onFinish={handleSaveRules}>
          <Form.Item label="游戏规则 (Markdown 可选)" name="gameRules">
            <TextArea rows={4} placeholder="在此描述游戏规则..." />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存规则
            </Button>
          </Space>
        </Form>

        <Divider />

        <Form form={formPlayers} layout="vertical" onFinish={handleSavePlayers}>
          <Form.Item
            label="总决策主体数"
            name="totalDecisionEntities"
            rules={[{ required: true, message: '请输入总主体数' }]}
          >
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item
            label="人类玩家数"
            name="humanPlayerCount"
            rules={[{ required: true, message: '请输入人类玩家数' }]}
          >
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item
            label="AI玩家数"
            name="aiPlayerCount"
            rules={[{ required: true, message: '请输入AI玩家数' }]}
          >
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item
            label="决策时限(分钟)"
            name="decisionTimeLimit"
            rules={[{ required: true, message: '请输入决策时限' }]}
          >
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item label="超时策略" name="timeoutStrategy">
            <Input placeholder="auto_submit / skip / extend 等" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存玩家配置
          </Button>
        </Form>
      </Card>

      <Card title="Step 3 - 验证与完成" loading={loading}>
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
                className="btn-strong glow"
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

      <Card title="当前配置快照">
        {config ? (
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(config, null, 2)}</pre>
        ) : (
          <Text type="secondary">尚未加载配置</Text>
        )}
      </Card>
    </Space>
  );
}

export default HostSetup;
