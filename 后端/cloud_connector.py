import pymongo
import datetime
import sys

# ==========================================
# 🔌 配置区域 (由 jxq 维护)
# ==========================================
# 队友们请注意：
# 运行此代码前，必须在本地终端开启 SSH 隧道！
# 命令参考：ssh -L 27017:127.0.0.1:27017 root@<你的公网IP>
# ==========================================
MONGO_CONFIG = {
    "host": "mongo",       # 因为开了隧道，所以是本地
    "port": 27017,
    "user": "admin",           # 你的数据库账号
    "password": "123456",      # 你的数据库密码 (请修改为你设置的真实密码)
    "db_name": "sandbox_game"  # 数据库名
}

class CloudBridge:
    def __init__(self):
        """
        初始化：尝试打通到阿里云的电话
        """
        self.client = None
        self.db = None
        
        # 拼接连接暗号
        uri = f"mongodb://{MONGO_CONFIG['user']}:{MONGO_CONFIG['password']}@{MONGO_CONFIG['host']}:{MONGO_CONFIG['port']}/"
        
        try:
            # 尝试连接 (设置3秒超时，连不上别死等)
            print(f"⏳ [云端接口] 正在尝试连接云端数据库...")
            self.client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=3000)
            
            # 发个 Ping 包测试一下
            self.client.admin.command('ping')
            
            self.db = self.client[MONGO_CONFIG['db_name']]
            print(f"✅ [云端接口] 成功连接阿里云数据库！")
            
        except Exception as e:
            print(f"\n❌ [云端接口] 连接失败！严重错误！")
            print(f"   原因: {e}")
            print(f"   👉 请检查：你是不是忘了开 SSH 隧道？(ssh -L ...)\n")
            # 这里不报错退出，而是允许程序继续，但后续操作会失败
    
    def pull_latest_state(self, game_id):
        """
        【给 cz/whx 用】获取指定房间的最新存档
        用法: data = bridge.pull_latest_state("room_1")
        :return: 字典数据 or None
        """
        if not self.db: return None
        
        try:
            collection = self.db["game_timeline"]
            # 找 round_id 最大的那一条 (倒序排列取第一个)
            data = collection.find_one({"game_id": game_id}, sort=[("round_id", -1)])
            
            if data:
                print(f"⬇️  [下载] 获取到 {game_id} Round {data.get('round_id')} 数据")
                return data
            else:
                print(f"⚠️ [下载] 房间 {game_id} 暂无存档，可能是新游戏")
                return None
        except Exception as e:
            print(f"❌ [下载] 读取出错: {e}")
            return None

    def push_new_state(self, game_data):
        """
        【给 whx 用】上传推演完的新数据
        用法: bridge.push_new_state(my_json_data)
        :return: True/False
        """
        if not self.db: return False
        
        try:
            collection = self.db["game_timeline"]
            
            # 自动打上上传时间戳
            game_data["upload_time"] = datetime.datetime.now()
            
            result = collection.insert_one(game_data)
            print(f"⬆️  [上传] 数据同步成功！存档ID: {result.inserted_id}")
            return True
        except Exception as e:
            print(f"❌ [上传] 写入出错: {e}")
            return False

# ==========================================
# 🧪 自测代码 (队友可以直接运行这个文件测试连通性)
# ==========================================
if __name__ == "__main__":
    print("--- 正在测试云端连接 ---")
    bridge = CloudBridge()
    
    # 只有连接成功才进行后续测试
    if bridge.client:
        # 测试 1: 模拟上传
        test_data = {
            "game_id": "test_room_python",
            "round_id": 100,
            "msg": "Python接口测试数据",
            "timestamp": datetime.datetime.now()
        }
        if bridge.push_new_state(test_data):
            print("   -> 上传测试通过")
        
        # 测试 2: 模拟下载
        back_data = bridge.pull_latest_state("test_room_python")
        if back_data and back_data.get("msg") == "Python接口测试数据":
            print(f"   -> 下载测试通过: {back_data['msg']}")
            
        print("--- 测试结束，接口完美运行 ---")
    else:
        print("--- 测试中止，请先解决连接问题 ---")
