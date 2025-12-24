import React, { useEffect, useState } from 'react';
import { Award, X } from 'lucide-react';
import type { TurnAchievement } from '../types/turnResult';

interface AchievementPopupProps {
  /** 成就数据 */
  achievement: TurnAchievement;
  /** 关闭回调 */
  onClose: () => void;
  /** 自动关闭延迟（毫秒），0 表示不自动关闭 */
  autoCloseDelay?: number;
}

/**
 * AchievementPopup - 成就解锁弹窗（浅色玻璃态风格）
 * - 显示成就标题、描述、触发原因
 * - 支持自动关闭
 * - 带入场动画
 */
const AchievementPopup: React.FC<AchievementPopupProps> = ({
  achievement,
  onClose,
  autoCloseDelay = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 入场动画
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // 自动关闭
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    if (autoCloseDelay > 0) {
      closeTimer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
    }

    return () => {
      clearTimeout(showTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [autoCloseDelay]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      className={`
        fixed top-20 right-4 z-50
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving 
          ? 'opacity-100 translate-x-0' 
          : 'opacity-0 translate-x-8'
        }
      `}
    >
      <div
        className="
          relative w-80 rounded-xl overflow-hidden
          bg-gradient-to-br from-amber-50 to-yellow-50
          border border-amber-200
          shadow-lg shadow-amber-100/50
          backdrop-blur-sm
        "
      >
        {/* 顶部装饰条 */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />

        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="
            absolute top-3 right-3
            w-6 h-6 rounded-full
            flex items-center justify-center
            bg-amber-100 hover:bg-amber-200
            text-amber-600 hover:text-amber-700
            transition-colors
          "
        >
          <X size={14} />
        </button>

        {/* 内容 */}
        <div className="p-4">
          {/* 图标和标签 */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="
                w-12 h-12 rounded-xl
                bg-gradient-to-br from-amber-400 to-yellow-500
                flex items-center justify-center
                shadow-lg shadow-amber-200/50
              "
            >
              {achievement.icon ? (
                <span className="text-2xl">{achievement.icon}</span>
              ) : (
                <Award size={24} className="text-white" />
              )}
            </div>
            <div>
              <div className="text-[10px] text-amber-500 uppercase tracking-wider mb-0.5">
                成就解锁
              </div>
              <div className="text-lg font-bold text-amber-800">
                {achievement.title}
              </div>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-sm text-amber-700 leading-relaxed mb-2">
            {achievement.description}
          </p>

          {/* 触发原因 */}
          {achievement.triggerReason && (
            <div className="text-xs text-amber-500 border-t border-amber-200 pt-2 mt-2">
              触发原因：{achievement.triggerReason}
            </div>
          )}

          {/* 主体标识 */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-amber-200">
            <span className="text-[10px] text-amber-500">
              主体 {achievement.entityId}
            </span>
            <span className="text-[10px] text-amber-500">
              ID: {achievement.id}
            </span>
          </div>
        </div>

        {/* 进度条（自动关闭倒计时） */}
        {autoCloseDelay > 0 && (
          <div className="h-0.5 bg-amber-100">
            <div
              className="h-full bg-amber-400 transition-all ease-linear"
              style={{
                width: isVisible ? '0%' : '100%',
                transitionDuration: `${autoCloseDelay}ms`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * AchievementManager - 成就管理器
 * 用于管理多个成就弹窗的显示队列
 */
interface AchievementManagerProps {
  /** 成就列表 */
  achievements: TurnAchievement[];
  /** 全部关闭后的回调 */
  onAllClosed?: () => void;
}

export const AchievementManager: React.FC<AchievementManagerProps> = ({
  achievements,
  onAllClosed,
}) => {
  const [queue, setQueue] = useState<TurnAchievement[]>([]);
  const [current, setCurrent] = useState<TurnAchievement | null>(null);

  useEffect(() => {
    if (achievements.length > 0) {
      setQueue(prev => [...prev, ...achievements]);
    }
  }, [achievements]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
    }
  }, [current, queue]);

  const handleClose = () => {
    setCurrent(null);
    if (queue.length === 0 && onAllClosed) {
      onAllClosed();
    }
  };

  if (!current) return null;

  return <AchievementPopup achievement={current} onClose={handleClose} />;
};

export default AchievementPopup;
