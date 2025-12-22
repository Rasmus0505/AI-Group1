import { useEffect } from 'react';
import { message as antdMessage } from 'antd';
import { wsService } from '../services/websocket';

type Handler = (data: unknown) => void;

const showInfo = (content: string) => antdMessage.info(content);
const showSuccess = (content: string) => antdMessage.success(content);
const showWarning = (content: string) => antdMessage.warning(content);
const showError = (content: string) => antdMessage.error(content);

export function useMessageRouter() {
  useEffect(() => {
    const handlers: Array<[string, Handler]> = [
      [
        'system_message',
        payload => {
          if (payload && typeof payload === 'object' && 'message' in payload) {
            showInfo((payload as { message?: string }).message || '系统消息');
          } else {
            console.log('system_message', payload);
          }
        },
      ],
      [
        'chat_message',
        payload => {
          const data = payload as { from?: string; message?: string };
          showInfo(`聊天(${data.from || 'unknown'}): ${data.message || ''}`);
        },
      ],
      [
        'player_joined',
        payload => {
          const data = payload as {
            username?: string;
            userId?: string;
            roomId?: string;
            rejoined?: boolean;
          };
          showSuccess(
            `${data.username || data.userId || '玩家'} ${data.rejoined ? '重新加入' : '加入'} 房间 ${
              data.roomId || ''
            }`
          );
        },
      ],
      [
        'player_left',
        payload => {
          const data = payload as { username?: string; userId?: string; roomId?: string };
          showWarning(`${data.username || data.userId || '玩家'} 离开房间 ${data.roomId || ''}`);
        },
      ],
      [
        'game_state_update',
        payload => {
          console.log('game_state_update', payload);
        },
      ],
      [
        'round_stage_changed',
        payload => {
          const data = payload as { stage?: string; round?: number };
          showInfo(`回合阶段切换：${data.round ?? ''} -> ${data.stage || ''}`);
        },
      ],
      [
        'decision_status_update',
        payload => {
          console.log('decision_status_update', payload);
        },
      ],
      [
        'decision_deadline_update',
        payload => {
          console.log('decision_deadline_update', payload);
        },
      ],
      [
        'inference_started',
        payload => {
          showInfo('推演开始');
          console.log('inference_started', payload);
        },
      ],
      [
        'inference_completed',
        payload => {
          showSuccess('推演完成');
          console.log('inference_completed', payload);
        },
      ],
      [
        'decision_options_ready',
        payload => {
          showSuccess('决策选项已生成');
          console.log('decision_options_ready', payload);
        },
      ],
      [
        'achievement_unlocked',
        payload => {
          const data = payload as { name?: string };
          showSuccess(`成就解锁：${data.name || ''}`);
        },
      ],
      [
        'milestone_recorded',
        payload => {
          const data = payload as { title?: string };
          showInfo(`里程碑记录：${data.title || ''}`);
        },
      ],
      [
        'public_statement',
        payload => {
          const data = payload as { message?: string };
          showInfo(`公开声明：${data.message || ''}`);
        },
      ],
      [
        'trade_request',
        payload => {
          showInfo('收到交易请求');
          console.log('trade_request', payload);
        },
      ],
      [
        'trade_status_update',
        payload => {
          console.log('trade_status_update', payload);
        },
      ],
      [
        'cooperation_request',
        payload => {
          showInfo('收到合作请求');
          console.log('cooperation_request', payload);
        },
      ],
      [
        'cooperation_status_update',
        payload => {
          console.log('cooperation_status_update', payload);
        },
      ],
      [
        'cooperation_negotiation',
        payload => {
          console.log('cooperation_negotiation', payload);
        },
      ],
      [
        'task_update',
        payload => {
          console.log('task_update', payload);
        },
      ],
      [
        'multi_round_event_progress',
        payload => {
          console.log('multi_round_event_progress', payload);
        },
      ],
      [
        'multi_round_event_completed',
        payload => {
          console.log('multi_round_event_completed', payload);
        },
      ],
      [
        'error',
        payload => {
          const data = payload as { message?: string };
          showError(data.message || 'WebSocket 错误');
        },
      ],
    ];

    handlers.forEach(([event, handler]) => wsService.on(event, handler));

    return () => {
      handlers.forEach(([event, handler]) => wsService.off(event, handler));
    };
  }, []);
}
