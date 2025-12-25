import { Skeleton, Progress, Card } from 'antd';
import { Loader2 } from 'lucide-react';

interface GameLoadingSkeletonProps {
  progress?: number;
  message?: string;
}

/**
 * 游戏加载骨架屏
 * 提供更好的加载状态视觉反馈
 */
export const GameLoadingSkeleton = ({ 
  progress = 0, 
  message = '正在同步战场状态...' 
}: GameLoadingSkeletonProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card 
        className="w-full max-w-md"
        style={{ 
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* 头部骨架 */}
        <div className="flex justify-between items-center mb-6">
          <Skeleton.Button active style={{ width: 120, height: 24 }} />
          <Skeleton.Avatar active size={40} />
        </div>

        {/* 状态栏骨架 */}
        <div className="flex gap-2 mb-6">
          <Skeleton.Button active style={{ width: 80, height: 32 }} />
          <Skeleton.Button active style={{ width: 80, height: 32 }} />
          <Skeleton.Button active style={{ width: 80, height: 32 }} />
        </div>

        {/* 内容区骨架 */}
        <Skeleton active paragraph={{ rows: 4 }} className="mb-6" />

        {/* 加载进度 */}
        {progress > 0 && (
          <Progress 
            percent={progress} 
            status="active" 
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            className="mb-4"
          />
        )}

        {/* 加载提示 */}
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={16} />
          <span>{message}</span>
        </div>
      </Card>
    </div>
  );
};

export default GameLoadingSkeleton;
