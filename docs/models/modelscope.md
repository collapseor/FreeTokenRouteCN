# 魔搭 ModelScope

## 基本信息

- **厂商**：阿里巴巴 (Alibaba) / 魔搭社区
- **官网**：https://modelscope.cn/
- **注册地址**：https://modelscope.cn/
- **模型类型**：开源免费 / 部分免费

## 免费额度

- 开源模型平台，可免费下载和使用
- 部分模型提供免费在线 API 试用

## 模型列表

| 模型 ID | 名称 | 上下文长度 | 说明 |
|---------|------|-----------|------|
| qwen/Qwen-7B | Qwen-7B | 8K | 阿里通义千问 7B |
| qwen/Qwen-14B | Qwen-14B | 8K | 阿里通义千问 14B |
| Qwen/Qwen2.5-7B-Instruct | Qwen2.5-7B | 32K | 通义千问2.5指令版 |
| deepseek-ai/DeepSeek-V3 | DeepSeek-V3 | 128K | DeepSeek 最新模型 |
| THUDM/GLM-4-9B | GLM-4-9B | 8K | 智谱 GLM-4 9B |
| InternLM2-Chat-7B | InternLM2-7B | 32K | 书生·浦语 7B |

## API 接入方式

### 方式一：本地部署

```bash
# 使用 modelscope 库本地部署
pip install modelscope
from modelscope import snapshot_download
model_dir = snapshot_download('qwen/Qwen-7B-Chat')
```

### 方式二：在线 API（ModelScope API）

```bash
# 需要注册并获取 API Key
# API Base: https://dashscope.aliyuncs.com/compatible-mode/v1
# 或 ModelScope 自有 API
```

### 方式三：通过阿里云 DashScope

```bash
# 使用阿里云 DashScope 调用 ModelScope 上的模型
# API Base: https://dashscope.aliyuncs.com/compatible-mode/v1
```

## 注册步骤

1. 访问 https://modelscope.cn/
2. 注册账号
3. 即可免费浏览和下载开源模型
4. 部分模型可在线试用

## 限制说明

- 开源模型可免费下载，但需要本地硬件资源
- 在线 API 服务可能有免费额度限制

## 参考资料

- [官方文档](https://modelscope.cn/docs)
- [模型广场](https://modelscope.cn/models)
- [GitHub](https://github.com/modelscope/modelscope)
