import { useEffect, useState } from 'react';
import { Drawer, Table, Tag, Space, Button, Input, Select, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminAPI, AdminUser } from '../services/admin';
import { useAuthStore } from '../stores/authStore';

interface UserRegistryPanelProps {
  open: boolean;
  onClose: () => void;
}

function UserRegistryPanel({ open, onClose }: UserRegistryPanelProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('all');
  const [devCode, setDevCode] = useState('');
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Support multiple developer usernames (consistent with backend)
  const adminUsername = import.meta.env.VITE_ADMIN_USERNAME || 'developer';
  const adminUsernames = [adminUsername, 'developer', '开发者账号']; // Legacy support for old data
  const isDeveloper = user?.username ? adminUsernames.includes(user.username) : false;

  const loadUsers = async (pageNum = page, size = pageSize, status = statusFilter) => {
    setLoading(true);
    try {
      const result = await adminAPI.listUsers({
        page: pageNum,
        limit: size,
        status: status === 'all' ? undefined : status,
      });
      setUsers(result.users);
      setTotal(result.total);
      setPage(result.page);
      setPageSize(result.limit);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '获取在册用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadUsers(1, pageSize, statusFilter);
      setDevModeEnabled(false);
      setDevCode('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDevCodeConfirm = () => {
    if (!isDeveloper) {
      message.error('当前账号无权进入开发者模式');
      return;
    }
    if (devCode === 'wskfz') {
      setDevModeEnabled(true);
      message.success('开发者模式已开启');
    } else {
      message.error('密令错误');
    }
  };

  const handleFreeze = async (record: AdminUser) => {
    setActionLoadingId(record.id);
    try {
      await adminAPI.freezeUser(record.id);
      message.success(`已冻结用户：${record.username}`);
      loadUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '冻结用户失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnfreeze = async (record: AdminUser) => {
    setActionLoadingId(record.id);
    try {
      await adminAPI.unfreezeUser(record.id);
      message.success(`已解冻用户：${record.username}`);
      loadUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '解冻用户失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (record: AdminUser) => {
    setActionLoadingId(record.id);
    try {
      await adminAPI.deleteUser(record.id);
      message.success(`已删除用户：${record.username}`);
      loadUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '删除用户失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: '用户ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      ellipsis: true,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: value => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: value => (
        <Tag color={value === 'active' ? 'green' : value === 'frozen' ? 'red' : 'default'}>
          {value === 'active' ? '正常' : value === 'frozen' ? '已冻结' : value}
        </Tag>
      ),
    },
    {
      title: '在线',
      dataIndex: 'online',
      key: 'online',
      render: value => (
        <Tag color={value ? 'green' : 'default'}>{value ? '在线(近登录)' : '离线'}</Tag>
      ),
    },
    {
      title: '所在房间',
      dataIndex: 'room',
      key: 'room',
      render: room =>
        room ? (
          <span>
            {room.name} ({room.id})
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: value => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) =>
        devModeEnabled ? (
          <Space>
            {record.status === 'active' && (
              <Button
                size="small"
                danger
                loading={actionLoadingId === record.id}
                onClick={() => handleFreeze(record)}
              >
                冻结
              </Button>
            )}
            {record.status === 'frozen' && (
              <Button
                size="small"
                loading={actionLoadingId === record.id}
                onClick={() => handleUnfreeze(record)}
              >
                解冻
              </Button>
            )}
            <Button
              size="small"
              danger
              loading={actionLoadingId === record.id}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#999' }}>只读</span>
        ),
    },
  ];

  return (
    <Drawer
      title="在册用户"
      width={900}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Select
            size="small"
            value={statusFilter || 'all'}
            style={{ width: 120 }}
            onChange={value => {
              const v = value === 'all' ? 'all' : value;
              setStatusFilter(v);
              loadUsers(1, pageSize, v);
            }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '正常', value: 'active' },
              { label: '已冻结', value: 'frozen' },
            ]}
          />
          <Button size="small" onClick={() => loadUsers()}>
            刷新
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          <Input.Password
            size="small"
            style={{ width: 200 }}
            placeholder="开发者密令"
            value={devCode}
            onChange={e => setDevCode(e.target.value)}
          />
          <Button size="small" onClick={handleDevCodeConfirm}>
            解锁管理操作
          </Button>
          {devModeEnabled && <Tag color="purple">开发者模式已开启</Tag>}
        </Space>
        <Table<AdminUser>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={users}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              loadUsers(p, ps);
            },
          }}
          size="small"
        />
      </Space>
    </Drawer>
  );
}

export default UserRegistryPanel;


