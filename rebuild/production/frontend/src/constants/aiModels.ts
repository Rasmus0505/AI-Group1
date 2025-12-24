// AI Models Configuration
// This file contains preset AI model configurations for different providers

export interface AIModelConfig {
  provider: string;
  name: string;
  endpoint: string;
  model: string;
  bodyTemplate: Record<string, unknown>;
  description?: string;
}

export const PRESET_MODELS: AIModelConfig[] = [
  // DeepSeek Models
  {
    provider: 'deepseek',
    name: 'DeepSeek Chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    bodyTemplate: {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a game inference engine that generates game narratives and outcomes based on player decisions and game rules.'
        },
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true
    },
    description: 'DeepSeek Chat - Default recommended model'
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek Reasoner',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-reasoner',
    bodyTemplate: {
      model: 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: 'You are a game inference engine that generates game narratives and outcomes based on player decisions and game rules.'
        },
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true
    },
    description: 'DeepSeek Reasoner - Enhanced reasoning capability'
  },
  // OpenAI Models
  {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4-turbo-preview',
    bodyTemplate: {
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a game inference engine that generates game narratives and outcomes based on player decisions and game rules.'
        },
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    },
    description: 'OpenAI GPT-4 Turbo - High performance model'
  },
  {
    provider: 'openai',
    name: 'GPT-4',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4',
    bodyTemplate: {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a game inference engine that generates game narratives and outcomes based on player decisions and game rules.'
        },
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    },
    description: 'OpenAI GPT-4 - Most capable model'
  },
  {
    provider: 'openai',
    name: 'GPT-3.5 Turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    bodyTemplate: {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a game inference engine that generates game narratives and outcomes based on player decisions and game rules.'
        },
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    },
    description: 'OpenAI GPT-3.5 Turbo - Cost-effective option'
  },
  // Anthropic Claude Models
  {
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    bodyTemplate: {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    },
    description: 'Anthropic Claude 3.5 Sonnet - Advanced reasoning'
  },
  {
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-opus-20240229',
    bodyTemplate: {
      model: 'claude-3-opus-20240229',
      messages: [
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    },
    description: 'Anthropic Claude 3 Opus - Most capable model'
  },
  {
    provider: 'anthropic',
    name: 'Claude 3 Haiku',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307',
    bodyTemplate: {
      model: 'claude-3-haiku-20240307',
      messages: [
        {
          role: 'user',
          content: '{{prompt}}'
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    },
    description: 'Anthropic Claude 3 Haiku - Fast and efficient'
  },
  // Google Gemini Models
  {
    provider: 'google',
    name: 'Gemini 1.5 Pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
    model: 'gemini-1.5-pro',
    bodyTemplate: {
      contents: [
        {
          parts: [
            {
              text: '{{prompt}}'
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    },
    description: 'Google Gemini 1.5 Pro - Multimodal capabilities'
  },
  {
    provider: 'google',
    name: 'Gemini 1.5 Flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash',
    bodyTemplate: {
      contents: [
        {
          parts: [
            {
              text: '{{prompt}}'
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    },
    description: 'Google Gemini 1.5 Flash - Fast and efficient'
  },
  // Custom option
  {
    provider: 'custom',
    name: 'Custom Configuration',
    endpoint: '',
    model: '',
    bodyTemplate: {},
    description: 'Manually configure API endpoint and body template'
  }
];

export const DEFAULT_MODEL = PRESET_MODELS[0]; // DeepSeek Chat as default

