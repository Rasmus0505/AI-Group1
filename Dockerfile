# 使用官方 Python 基础镜像
FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 复制后端目录的依赖文件
COPY 后端/requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码到容器
COPY 后端/ .

# 暴露 FastAPI 默认端口
EXPOSE 8000

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV STORAGE_MODE=CLOUD

# 启动 FastAPI 应用
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
