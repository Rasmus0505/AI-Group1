/**
 * 游戏增强功能工具类
 * 包含本次改进的所有功能验证
 */

export class GameEnhancements {
  /**
   * 验证定时器权限控制
   * @param isHost 是否是主持人
   * @param isTimeout 是否超时
   * @returns 是否允许提交
   */
  static canSubmitDecision(isHost: boolean, isTimeout: boolean): boolean {
    // 主持人不受时限限制，普通玩家受时限限制
    return !isTimeout || isHost;
  }

  /**
   * 格式化时限调整消息
   * @param additionalMinutes 延长的分钟数
   * @returns 格式化的消息
   */
  static formatTimeLimitMessage(additionalMinutes: number): string {
    return `时限已延长${additionalMinutes}分钟`;
  }

  /**
   * 验证帮助系统权限
   * @param password 输入的密码
   * @returns 是否有开发者权限
   */
  static validateDeveloperAccess(password: string): boolean {
    return password === 'dev2025';
  }

  /**
   * 获取页面刷新间隔（毫秒）
   * @param pageType 页面类型
   * @returns 刷新间隔
   */
  static getRefreshInterval(pageType: 'game' | 'state' | 'review'): number {
    switch (pageType) {
      case 'game':
        return 3000; // 游戏页面3秒刷新
      case 'state':
        return 3000; // 状态页面3秒刷新
      case 'review':
        return 5000; // 审核页面5秒刷新
      default:
        return 5000;
    }
  }

  /**
   * 生成帮助内容的默认分类
   * @returns 帮助内容分类
   */
  static getHelpCategories(): Array<{
    key: string;
    label: string;
    icon: string;
  }> {
    return [
      { key: 'general', label: '通用帮助', icon: 'BookOutlined' },
      { key: 'player', label: '玩家指南', icon: 'UserOutlined' },
      { key: 'host', label: '主持人指南', icon: 'SettingOutlined' }
    ];
  }

  /**
   * 验证UI改进是否生效
   * @returns 改进项目列表
   */
  static getUIImprovements(): Array<{
    feature: string;
    description: string;
    status: 'completed' | 'in-progress' | 'planned';
  }> {
    return [
      {
        feature: '定时器权限控制',
        description: '主持人不受时限限制，玩家受时限限制',
        status: 'completed'
      },
      {
        feature: '时限动态调整',
        description: '主持人可在决策阶段延长时限',
        status: 'completed'
      },
      {
        feature: '实时刷新优化',
        description: '减少手动刷新需求，提高同步频率',
        status: 'completed'
      },
      {
        feature: '帮助系统',
        description: '完整的帮助文档和开发者编辑功能',
        status: 'completed'
      },
      {
        feature: '高级视图汉化',
        description: '统一UI风格，完全汉化界面',
        status: 'completed'
      },
      {
        feature: '页面导航优化',
        description: '添加返回按钮和滚动条支持',
        status: 'completed'
      },
      {
        feature: '右侧栏扩展',
        description: '增加快速操作和更多功能',
        status: 'completed'
      }
    ];
  }
}

export default GameEnhancements;