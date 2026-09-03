# FreeTokenRouteCN

> 国内大模型免费访问资源整合与 OpenAI 兼容代理工具

将国内大模型的免费注册/访问方式汇集为结构化资料库，并对外暴露 OpenAI 兼容 API 接口，实现一次接入、统一调用。

## 为什么做这个

现有的代理工具存在以下痛点：

- **安装复杂**：依赖繁多，配置项眼花缭乱

- **配置复杂**：需要理解每家厂商的鉴权与请求格式

- **没有注册指引**：拿到工具也不知道去哪里申请 Key

- **国外模型为主**：没有梯子根本调不通

- **国内免费源更新慢**：新模型/新额度出来不能及时跟进

本项目专注解决这些问题：**资料库 + 代理一体**，开箱即用，自带注册指引，聚焦国内免费可用模型。

## 核心功能

- **资料库**：结构化 JSON 维护各厂商注册路径、免费额度、模型列表、调用方式

- **代理转发**：Node.js + Express 服务，对外暴露 `/v1/chat/completions` 等 OpenAI 兼容接口

- **统一接口**：使用 OpenAI SDK 直接调用，无需关心底层是哪个厂商

- **注册指引**：每个厂商附带详细的注册步骤文档

- **轻量依赖**：仅 express + axios + js-yaml，安装快、启动快

## 特性亮点

- OpenAI 协议 100% 兼容，现有 SDK/工具直接复用

- 按 model 名自动路由到对应厂商

- 支持流式（SSE）与非流式响应

- 配置文件 + 环境变量双重配置，本地/部署都方便

- 模型资料库与代码解耦，新增模型只需改 JSON + 加文档

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

配置文件示例（`config.example.yaml`）：

```yaml
server:
  port: 3000
  # 是否校验调用方 api_key（本地使用可关闭）
  auth: false
  # 可选：访问令牌，auth=true 时生效
  api_key: "your-local-access-token"

providers:
  alibaba:
    api_key: "sk-xxxx"          # 阿里云 DashScope Key
  deepseek:
    api_key: "sk-xxxx"
  zhipu:
    api_key: "xxxx.xxxx"
  baidu:
    api_key: "xxxx"
    secret_key: "xxxx"
  moonshot:
    api_key: "sk-xxxx"

logging:
  level: info                   # debug | info | warn | error
```

> 也支持通过环境变量覆盖，命名规则 `FTRCN_<PROVIDER>_API_KEY`，例如 `FTRCN_DEEPSEEK_API_KEY`。

### 启动服务

```bash
# 开发模式（热重载）
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
│   │   ├── v1.js              # OpenAI 兼容路由
│   │   └── health.js         # 健康检查
│   ├── providers/             # 各厂商适配器
│   │   ├── base.js            # 抽象基类
│   │   ├── alibaba.js
│   │   ├── baidu.js
│   │   ├── zhipu.js
│   │   └── ...
│   ├── utils/                 # 工具
│   │   ├── logger.js
│   │   └── errors.js
│   ├── config.js              # 配置管理
│   ├── models.js              # 资料库加载
│   └── router.js              # 模型路由
├── models.json                # 结构化模型资料库
├── config.example.yaml        # 配置模板
└── README.md
```

## 资料库说明

`models.json` 是核心数据结构，格式如下：

```json
{
  "version": "1.0",
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

## 安全说明

> 本项目当前处于 MVP 阶段，API Key 以明文形式存储在 `config.yaml` 中。生产环境使用请注意：

- **务必将** **`config.yaml`** **加入** **`.gitignore`**（已默认加入）

- 不要将包含真实 Key 的配置提交到仓库

- 建议通过环境变量注入 Key，而非写死在配置文件

- 本地调试建议仅监听 `127.0.0.1`，不要暴露到公网

## 后续优化路线图（Roadmap）

以下为计划中的优化项，标记 `TODO` 表示尚未实现。

### P0 - 安全加固

- [ ] **\[TODO] API Key 加密存储**：支持 AES 加密存储，启动时通过主密码解密

- [ ] **\[TODO] 接入系统密钥库**：支持从 macOS Keychain / Windows Credential Manager / Linux Secret Service 读取

- [ ] **\[TODO] .env 文件支持**：提供 `.env` 优先级最高，便于容器化部署

- [ ] **\[TODO] 调用方鉴权**：实现 Bearer Token 校验中间件，支持多 token 白名单

### P1 - 功能增强

- [ ] **\[TODO] 流式响应优化**：完善 SSE 透传，支持中途取消

- [ ] **\[TODO] 多 Key 轮询**：同一厂商配置多个 Key，自动负载均衡与失败切换

- [ ] **\[TODO] 额度统计**：记录各 Key 每日调用次数，接近额度上限自动切换

- [ ] **\[TODO] 请求重试**：上游超时/限流时自动重试其他 Key 或模型

- [ ] **\[TODO] 模型别名**：支持自定义别名映射，例如 `gpt-4` → `qwen-max`

### P2 - 可观测性

- [ ] **\[TODO] 请求日志**：记录每次调用的模型、耗时、token 数、状态码

- [ ] **\[TODO] 简单面板**：内置 Web 面板查看模型列表、Key 状态、调用统计

- [ ] **\[TODO] Prometheus 指标**：暴露 `/metrics` 端点

- [ ] **\[TODO] 健康自检**：定时探测各厂商可用性，`/v1/models` 只返回可用模型

### P3 - 生态扩展

- [ ] **\[TODO] Docker 镜像**：提供官方镜像，一键 `docker run`

- [ ] **\[TODO] 一键脚本**：`curl ... | sh` 自动安装并启动

- [ ] **\[TODO] 插件机制**：第三方 Provider 以插件形式接入

- [ ] **\[TODO] 模型自动更新**：定时拉取各厂商最新模型清单

## FAQ

**Q: 免费额度真的够用吗？**
A: 单家厂商的免费额度有限，但多家叠加通常能满足个人开发与测试需求。生产环境建议购买付费 Key。

**Q: 为什么不直接用 one-api / new-api？**
A: 那些工具功能更全但配置复杂、无注册指引、国外模型为主。本项目面向"只想快速用上国内免费模型"的用户，资料库 + 代理一体，更轻量。

**Q: 支持 OpenAI 官方 SDK 吗？**
A: 支持。任何兼容 OpenAI Chat Completions 协议的 SDK/工具都可以直接对接。

## 注意事项

- 免费额度可能随时变动，以各厂商官方公告为准

- 请遵守各厂商的使用条款，不要滥用免费额度

- 本项目仅供学习交流使用

## 贡献

欢迎通过 PR 补充新的模型厂商或完善文档。提交前请：

1. 确认 `config.yaml` 未被提交
2. 新增模型时同步更新 `models.json` 和 `docs/models/`
3. 遵循现有文档格式

## License

MIT
