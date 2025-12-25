import { useEffect, useState } from 'react';
import { Drawer, Table, Tag, Space, Button, Select, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminAPI, AdminRoom } from '../services/admin';
import { useAuthStore } from '../stores/authStore';

interface OnlineRoomsPanelProps {
  open: boolean;
  onClose: () => void;
}

function OnlineRoomsPanel({ open, onClose }: OnlineRoomsPanelProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('active');
  const [devCode, setDevCode] = useState('');
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Support multiple developer usernames (consistent with backend)
  const adminUsername = import.meta.env.VITE_ADMIN_USERNAME || 'developer';
  const adminUsernames = [adminUsername, 'developer', '开发者账号']; // Legacy support for old data
  const isDeveloper = user?.username ? adminUsernames.includes(user.username) : false;

  const loadRooms = async (pageNum = page, size = pageSize, status = statusFilter) => {
    setLoading(true);
    try {
      const apiStatus =
        status === 'all' ? 'all' : status === 'active' ? undefined : status; // active=默认 waiting+playing
      const result = await adminAPI.listRooms({
        page: pageNum,
        limit: size,
        status: apiStatus,
      });
      setRooms(result.rooms);
      setTotal(result.total);
      setPage(result.page);
      setPageSize(result.limit);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '获取在线房间失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadRooms(1, pageSize, statusFilter);
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

  const handleCloseRoom = async (record: AdminRoom) => {
    setActionLoadingId(record.id);
    try {
      await adminAPI.closeRoom(record.id);
      message.success(`已关闭房间：${record.name}`);
      loadRooms();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '关闭房间失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const columns: ColumnsType<AdminRoom> = [
    {
      title: '房间ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      ellipsis: true,
    },
    {
      title: '房间名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: value => {
        let color: 'blue' | 'green' | 'default' | 'orange' = 'default';
        if (value === 'waiting') color = 'blue';
        else if (value === 'playing') color = 'green';
        else if (value === 'closed' || value === 'finished') color = 'orange';
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: '人数',
      dataIndex: 'currentPlayers',
      key: 'players',
      render: (_, record) => `${record.currentPlayers}/${record.maxPlayers}`,
    },
    {
      title: '房主',
      dataIndex: 'host',
      key: 'host',
      render: host =>
        host ? `${host.nickname || host.username || host.id || '-'}` : '-' as string,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: value => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) =>
        devModeEnabled ? (
          <Button
            size="small"
            danger
            loading={actionLoadingId === record.id}
            onClick={() => handleCloseRoom(record)}
          >
            关闭房间
          </Button>
        ) : (
          <span style={{ color: '#999' }}>只读</span>
        ),
    },
  ];

  return (
    <Drawer
      title="在线房间"
      width={900}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Select
            size="small"
            value={statusFilter || 'active'}
            style={{ width: 140 }}
            onChange={value => {
              setStatusFilter(value);
              loadRooms(1, pageSize, value);
            }}
            options={[
              { label: '活跃房间(等待/进行)', value: 'active' },
              { label: '仅等待中', value: 'waiting' },
              { label: '仅进行中', value: 'playing' },
              { label: '已关闭/结束', value: 'closed' },
              { label: '全部状态', value: 'all' },
            ]}
          />
          <Button size="small" onClick={() => loadRooms()}>
            刷新
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          <input
            type="password"
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
        <Table<AdminRoom>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rooms}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              loadRooms(p, ps);
            },
          }}
          size="small"
        />
      </Space>
    </Drawer>
  );
}

export default OnlineRoomsPanel;


