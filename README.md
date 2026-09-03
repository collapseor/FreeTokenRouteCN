# FreeTokenRouteCN

> 国内大模型免费访问资源整合与 OpenAI 兼容代理工具

将国内大模型的免费注册/访问方式汇集为结构化资料库，并对外暴露 OpenAI 兼容 API 接口，实现一次接入、统一调用。

## 核心功能

- **资料库**：结构化 JSON 维护各厂商注册路径、免费额度、模型列表、调用方式

- **代理转发**：Node.js + Express 服务，对外暴露 `/v1/chat/completions` 等 OpenAI 兼容接口

- **统一接口**：使用 OpenAI SDK 直接调用，无需关心底层是哪个厂商

## 支持模型（持续更新）

| 厂商            | 模型                        | 免费额度 | 注册方式                                  |
| ------------- | ------------------------- | ---- | ------------------------------------- |
| 阿里云           | Qwen / 通义千问               | 免费额度 | [注册指引](docs/models/alibaba.md)        |
| 百度            | 文心一言 ERNIE                | 免费额度 | [注册指引](docs/models/baidu.md)          |
| 智谱 AI         | GLM-4 / GLM-4V            | 免费额度 | [注册指引](docs/models/zhipu.md)          |
| DeepSeek      | DeepSeek-V3 / DeepSeek-R1 | 免费额度 | [注册指引](docs/models/deepseek.md)       |
| 月之暗面          | Kimi                      | 免费额度 | [注册指引](docs/models/moonshot.md)       |
| 讯飞            | 星火认知                      | 免费额度 | [注册指引](docs/models/xunfei.md)         |
| 智谱            | CodeGeeX                  | 开源免费 | [注册指引](docs/models/codegeex.md)       |
| DeepSeek      | DeepSeek-Coder            | 开源免费 | [注册指引](docs/models/deepseek-coder.md) |
| 魔搭 ModelScope | Qwen / DeepSeek / GLM 等   | 开源免费 | [注册指引](docs/models/modelscope.md)     |
| OpenCode      | OpenCode 代码模型             | 开源免费 | [注册指引](docs/models/opencode.md)       |

## 快速开始

### 环境要求

- Node.js >= 18

- npm 或 yarn

### 安装

```bash
git clone https://github.com/your-org/FreeTokenRouteCN.git
cd FreeTokenRouteCN
npm install
```

### 配置

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml，填入各厂商的 API Key
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务默认运行在 `http://localhost:3000`

### 使用 OpenAI SDK 调用

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="your-api-key"  # 本地服务可不填或填任意值
)

response = client.chat.completions.create(
    model="qwen-turbo",          # 使用上面资料库中的模型标识
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)
```

```bash
# 或使用 curl
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen-turbo", "messages": [{"role": "user", "content": "你好"}]}'
```

## 项目结构

```
├── docs/
│   ├── README.md              # 资料库总览
│   └── models/                # 各厂商详细文档
│       ├── alibaba.md
│       ├── baidu.md
│       ├── zhipu.md
│       ├── deepseek.md
│       └── ...
├── src/
│   ├── index.js               # Express 服务入口
│   ├── routes/                # API 路由
│   │   └── v1.js
│   ├── providers/             # 各厂商适配器
│   │   ├── alibaba.js
│   │   ├── baidu.js
│   │   ├── zhipu.js
│   │   └── ...
│   ├── config.js              # 配置管理
│   └── router.js              # 模型路由
├── models.json                # 结构化模型资料库
├── config.example.yaml        # 配置模板
└── README.md
```

## 资料库说明

`models.json` 是核心数据结构，格式如下：

```json
{
  "models": [
    {
      "id": "qwen-turbo",
      "provider": "alibaba",
      "name": "通义千问 Turbo",
      "type": "free",
      "context_length": 8000,
      "pricing": { "prompt": 0, "completion": 0 },
      "endpoints": {
        "chat": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "auth": "api-key"
      },
      "registration": {
        "url": "https://dashscope.aliyun.com/",
        "steps": ["访问链接", "登录阿里云账号", "开通 DashScope 服务"]
      },
      "limits": {
        "daily": 100,
        "unit": "requests"
      },
      "docs_url": "https://help.aliyun.com/zh/model-studio/getting-started/models"
    }
  ]
}
```

## API 端点

| 端点                          | 说明              |
| --------------------------- | --------------- |
| `GET /v1/models`            | 获取可用模型列表        |
| `POST /v1/chat/completions` | 聊天补全（OpenAI 兼容） |
| `GET /health`               | 健康检查            |

## 添加新模型

1. 在 `docs/models/` 下添加厂商文档
2. 在 `models.json` 中添加模型条目
3. 在 `src/providers/` 下添加对应适配器（如需要特殊处理请求格式）
4. 提交 PR

## 注意事项

- 免费额度可能随时变动，以各厂商官方公告为准

- 请遵守各厂商的使用条款，不要滥用免费额度

- 本项目仅供学习交流使用

## License

MIT
