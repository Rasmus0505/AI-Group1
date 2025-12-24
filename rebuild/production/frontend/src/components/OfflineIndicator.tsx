import { useEffect, useState } from 'react';
import { Alert } from 'antd';
import { WifiOff } from 'lucide-react';

/**
 * 离线状态指示器
 * 当网络断开时显示顶部警告条
 */
export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert
      message={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={16} />
          网络连接已断开
        </span>
      }
      description="请检查网络连接，部分功能可能无法使用"
      type="warning"
      showIcon={false}
      banner
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 9999,
        textAlign: 'center'
      }}
    />
  );
};

export default OfflineIndicator;
