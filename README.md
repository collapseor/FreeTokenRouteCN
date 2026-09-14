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
- **无会话管理**：每次请求都是无状态的，长对话 token 浪费严重，切换模型丢失上下文

本项目专注解决这些问题：**资料库 + 代理 + 会话管理 + 智能压缩**，开箱即用，自带注册指引，聚焦国内免费可用模型。

## 核心功能

- **资料库**：结构化 JSON + Markdown 文档，维护各厂商注册路径、免费额度、模型列表、调用方式
- **代理转发**：Node.js + Express 服务，对外暴露 `/v1/chat/completions` 等 OpenAI 兼容接口
- **统一接口**：使用 OpenAI SDK 直接调用，无需关心底层是哪个厂商
- **注册指引**：每个厂商附带详细的注册步骤文档
- **会话管理**：服务端维护对话历史，客户端只需传 `conversation_id` 即可续接上下文
- **智能压缩**：长对话自动摘要 + 保留最近 N 轮，token 节省 70-90%
- **模型平滑迁移**：切换模型时历史上下文自动复用，无上下文丢失
- **轻量依赖**：仅 express + axios + js-yaml + gpt-tokenizer

## 架构设计

```
┌──────────────────────────────────────────────────────────┐
│  客户端 (OpenAI SDK / curl / 任意 HTTP 客户端)            │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTP (OpenAI 兼容协议)
                            ▼
┌──────────────────────────────────────────────────────────┐
│  FreeTokenRouteCN 服务 (Express)                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 路由层 /v1/* (OpenAI 兼容端点)                      │  │
│  └──────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │ SessionManager 会话管理 (内存)                     │  │
│  │  · 按 conversation_id 维护消息历史                 │  │
│  │  · 流式响应自动累积并存储                          │  │
│  └──────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │ TokenEstimator token 估算 (gpt-tokenizer)          │  │
│  │  · 估算当前消息总 token 数                         │  │
│  │  · 对比阈值 (context_length - max_tokens - 1024)  │  │
│  └──────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │ Compression 智能压缩 (超阈值时触发)                │  │
│  │  · 调用模型对旧消息生成摘要                       │  │
│  │  · 保留最近 8 轮完整对话                           │  │
│  │  · 摘要作为 system 消息注入                       │  │
│  └──────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │ Router 模型路由器 (model 名 → provider)             │  │
│  └──────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │ Provider 适配层 (各家请求/响应格式转换)             │  │
│  │  deepseek (Web Token + PoW) | agnesai | sensenova | alibaba | ... │  │
│  └──────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │ 配置 & 资料库 config.yaml + models.json            │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────┘
                            │ 各厂商原生 API
                            ▼
              DeepSeek / 阿里云 / 智谱 / Kimi ...
```

## 请求流程

```
1. 客户端发送请求 (model + messages + conversation_id?)
2. SessionManager: 获取/创建会话，追加用户消息到历史
3. TokenEstimator: 估算 token，对比阈值
4. [若超限] Compression: 摘要旧消息 + 保留最近 8 轮
5. Router: 按 model 名找到对应 provider
6. Provider: 格式转换 + 转发到上游 API
7. 响应返回，assistant 回复自动追加到会话
8. 返回 X-Conversation-Id 头供客户端复用
```

## 智能压缩机制

当对话 token 超过阈值时自动触发压缩：

```
原始消息 (40 条, 7282 tokens)
        ↓
┌─────────────────────────────────────────┐
│ 前 36 条 → 调用模型生成摘要 (758 tokens)  │
│ 后 4 条  → 完整保留 (最近 2 轮)          │
└─────────────────────────────────────────┘
        ↓
压缩后消息 (5 条, 758 tokens) ← 节省 89%

最终发送给模型的消息：
  { role: "system",  content: "[对话摘要] ..." }
  { role: "user",    content: "最近第 1 轮用户消息" }
  { role: "assistant", content: "最近第 1 轮助手回复" }
  { role: "user",    content: "最近第 2 轮用户消息" }
  { role: "assistant", content: "最近第 2 轮助手回复" }
```

**关键设计**：
- 摘要使用当前模型自身生成（无需额外部署小模型）
- 增量摘要：只压缩"上次摘要之后、最近 N 轮之前"的部分，避免重复压缩
- `reasoning_content` 不发给模型，进一步节省 token
- 压缩失败时降级为原始消息继续请求，不中断服务

## 模型平滑迁移

会话历史与模型完全解耦，切换模型时上下文自动复用：

```
用户: 用 deepseek-chat 对话 20 轮 → 切换到 deepseek-reasoner
        ↓
SessionManager 取出 20 轮历史
        ↓
TokenEstimator: 估算 = 45K tokens > 阈值 32K
        ↓
Compression: 前 12 轮 → 摘要(3K) + 最近 8 轮完整(12K) = 15K
        ↓
Router: deepseek-reasoner provider
        ↓
新模型收到: [system: 摘要] + [8 轮完整对话]
        ↓
平滑切换，无上下文丢失
```

## 支持模型（持续更新）

| 厂商            | 模型                        | 免费方式       | 认证方式     | 注册指引                              |
| --------------- | --------------------------- | -------------- | ------------ | ------------------------------------- |
| DeepSeek        | DeepSeek V3 / R1            | 网页版免费     | Web Token    | [注册指引](docs/models/deepseek.md)       |
| Agnes AI        | Agnes 2.5 / 3.0 Flash      | Token 全免费   | API Key      | [注册指引](docs/models/agnesai.md)        |
| 商汤 SenseNova   | 6.8 Flash-Lite / DSV4 / GLM-5.2 | 公测免费   | API Key      | [注册指引](docs/models/sensenova.md)     |
| 阿里云           | Qwen / 通义千问               | 免费额度       | API Key      | [注册指引](docs/models/alibaba.md)        |
| 百度            | 文心一言 ERNIE                | 免费额度       | API Key      | [注册指引](docs/models/baidu.md)          |
| 智谱 AI         | GLM-4 / GLM-4V            | 免费额度       | API Key      | [注册指引](docs/models/zhipu.md)          |
| 月之暗面          | Kimi                      | 免费额度       | API Key      | [注册指引](docs/models/moonshot.md)       |
| 讯飞            | 星火认知                      | 免费额度       | API Key      | [注册指引](docs/models/xunfei.md)         |
| 智谱            | CodeGeeX                  | 开源免费       | 本地部署      | [注册指引](docs/models/codegeex.md)       |
| DeepSeek        | DeepSeek-Coder            | 开源免费       | 本地部署      | [注册指引](docs/models/deepseek-coder.md) |
| 魔搭 ModelScope | Qwen / DeepSeek / GLM 等   | 开源免费       | 本地/API     | [注册指引](docs/models/modelscope.md)     |
| OpenCode      | OpenCode 代码模型             | 开源免费       | 本地部署      | [注册指引](docs/models/opencode.md)       |

### DeepSeek Web Token 方式（已实现）

DeepSeek 的官方 API Key 是付费的，本项目通过逆向网页版 API 实现免费调用：

- 从 `chat.deepseek.com` 获取 `userToken`（LocalStorage）
- 自动求解 PoW（工作量证明）挑战
- 会话创建 + SSE 流式响应转 OpenAI 格式
- `deepseek-reasoner` 自动启用思维链，推理过程放在 `reasoning_content` 字段

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
# 编辑 config.yaml，填入各厂商的认证信息
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
  deepseek:
    # 从 chat.deepseek.com 获取:
    # 1. 登录后按 F12 打开开发者工具
    # 2. Application → Local Storage → https://chat.deepseek.com
    # 3. 找到 userToken，复制 value 值填入下方
    token: "your-deepseek-web-token"
  agnesai:
    # platform.agnes-ai.cn → 设置 → API 密钥 → 创建
    api_key: "your-agnes-api-key"
    # 可选：默认国内节点 .cn，需用国际站时改为 https://apihub.agnes-ai.com/v1
  sensenova:
    # platform.sensenova.cn → 控制台 → API Keys → 创建
    api_key: "your-sensenova-api-key"
  # 后续添加其他厂商:
  # alibaba:
  #   api_key: "sk-xxxx"
  # zhipu:
  #   api_key: "xxxx.xxxx"

logging:
  level: info                   # debug | info | warn | error
```

> 也支持通过环境变量覆盖，命名规则 `FTRCN_<PROVIDER>_TOKEN` 或 `FTRCN_<PROVIDER>_API_KEY`，例如 `FTRCN_AGNESAI_API_KEY`、`FTRCN_SENSENOVA_API_KEY`。

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
    api_key="any"  # 本地服务可不填或填任意值
)

# 第一次请求（不传 conversation_id，服务端自动生成）
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好，请记住我的名字叫张三"}]
)
conv_id = response.conversation_id  # 从响应中获取会话 ID

# 后续请求（复用会话上下文）
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "我叫什么名字？"}],
    extra_body={"conversation_id": conv_id}  # 传入会话 ID
)
print(response.choices[0].message.content)

# 切换模型（上下文自动迁移）
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=[{"role": "user", "content": "分析一下我们的对话"}],
    extra_body={"conversation_id": conv_id}  # 同一会话，不同模型
)
```

```bash
# 或使用 curl
# 第一次请求
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "你好"}]}'
# 响应头包含 X-Conversation-Id: conv_xxx

# 后续请求（复用会话）
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-chat", "conversation_id": "conv_xxx", "messages": [{"role": "user", "content": "继续"}]}'
```

## 项目结构

```
├── docs/
│   └── models/                # 各厂商详细文档
│       ├── alibaba.md
│       ├── deepseek.md
│       └── ...
├── src/
│   ├── index.js               # Express 服务入口
│   ├── routes/
│   │   ├── v1.js              # OpenAI 兼容路由（含会话 + 压缩）
│   │   └── health.js         # 健康检查
│   ├── providers/             # 各厂商适配器
│   │   ├── base.js            # 抽象基类
│   │   ├── deepseek.js        # DeepSeek Web Token + PoW
│   │   ├── deepseek-pow.js    # PoW WASM 求解器
│   │   ├── wasm/              # PoW 计算用的 WASM 模块
│   │   └── index.js          # Provider 注册表
│   ├── session/               # 会话管理
│   │   ├── manager.js         # 会话状态 + 消息历史
│   │   └── compression.js     # 智能压缩（摘要 + 保留最近 N 轮）
│   ├── utils/
│   │   ├── logger.js          # 日志工具
│   │   ├── errors.js          # 错误处理
│   │   └── token.js           # token 估算 (gpt-tokenizer)
│   ├── config.js              # 配置管理（YAML + 环境变量）
│   ├── models.js              # 资料库加载
│   └── router.js              # 模型路由
├── test/
│   └── compression.test.js    # 压缩模块单元测试
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
      "id": "deepseek-chat",
      "provider": "deepseek",
      "name": "DeepSeek V3 (Web)",
      "type": "free",
      "context_length": 64000,
      "endpoints": {
        "chat": "https://chat.deepseek.com/api/v0/chat/completion",
        "auth": "web-token"
      },
      "registration": {
        "url": "https://chat.deepseek.com/",
        "steps": ["访问 chat.deepseek.com", "登录", "F12 → Local Storage → userToken"]
      },
      "docs_url": "https://chat.deepseek.com/"
    }
  ]
}
```

## API 端点

| 端点                          | 说明                              |
| --------------------------- | ------------------------------- |
| `GET /v1/models`            | 获取可用模型列表                        |
| `POST /v1/chat/completions` | 聊天补全（OpenAI 兼容，支持会话管理 + 智能压缩）   |
| `GET /health`               | 健康检查                            |

### 请求参数

除标准 OpenAI 参数外，额外支持：

| 参数                 | 类型     | 说明                            |
| ------------------ | -------- | ------------------------------- |
| `conversation_id`  | string   | 会话 ID，不传则自动创建。用于多轮对话和模型切换 |

### 响应头

| Header               | 说明                          |
| -------------------- | ----------------------------- |
| `X-Conversation-Id`  | 会话 ID，客户端应保存以便后续请求复用 |

## 添加新模型

1. 在 `docs/models/` 下添加厂商文档
2. 在 `models.json` 中添加模型条目（含 `context_length` 用于压缩阈值计算）
3. 在 `src/providers/` 下添加对应适配器（继承 `base.js`）
4. 在 `src/providers/index.js` 中注册
5. 提交 PR

## 测试

```bash
# 压缩模块单元测试
node test/compression.test.js

# 启动服务后测试
curl http://localhost:3000/health
curl http://localhost:3000/v1/models
```

## 安全说明

> 本项目当前处于 MVP 阶段，认证信息以明文形式存储在 `config.yaml` 中。生产环境使用请注意：

- **务必将** **`config.yaml`** **加入** **`.gitignore`**（已默认加入）
- 不要将包含真实 Token/Key 的配置提交到仓库
- 建议通过环境变量注入，而非写死在配置文件
- 本地调试建议仅监听 `127.0.0.1`，不要暴露到公网

## 后续优化路线图（Roadmap）

以下为计划中的优化项，标记 `TODO` 表示尚未实现。

### P0 - 安全加固

- [ ] **\[TODO] Token/Key 加密存储**：支持 AES 加密存储，启动时通过主密码解密
- [ ] **\[TODO] 接入系统密钥库**：支持从 macOS Keychain / Windows Credential Manager / Linux Secret Service 读取
- [ ] **\[TODO] .env 文件支持**：提供 `.env` 优先级最高，便于容器化部署
- [ ] **\[TODO] 调用方鉴权**：实现 Bearer Token 校验中间件，支持多 token 白名单

### P1 - 功能增强

- [x] **会话管理**：服务端维护对话历史，支持多轮对话
- [x] **智能压缩**：长对话自动摘要 + 保留最近 N 轮，token 节省 70-90%
- [x] **模型平滑迁移**：切换模型时历史上下文自动复用
- [x] **DeepSeek Web Token**：通过网页版 token 免费调用，含 PoW 求解
- [ ] **\[TODO] 流式响应优化**：完善 SSE 透传，支持中途取消
- [ ] **\[TODO] 多 Key 轮询**：同一厂商配置多个 Key，自动负载均衡与失败切换
- [ ] **\[TODO] 额度统计**：记录各 Key 每日调用次数，接近额度上限自动切换
- [ ] **\[TODO] 请求重试**：上游超时/限流时自动重试其他 Key 或模型
- [ ] **\[TODO] 模型别名**：支持自定义别名映射，例如 `gpt-4` → `deepseek-chat`
- [ ] **\[TODO] Redis 持久化**：会话存储从内存迁移到 Redis，重启不丢失

### P2 - 可观测性

- [ ] **\[TODO] 请求日志**：记录每次调用的模型、耗时、token 数、状态码、压缩率
- [ ] **\[TODO] 简单面板**：内置 Web 面板查看模型列表、Key 状态、调用统计、会话管理
- [ ] **\[TODO] Prometheus 指标**：暴露 `/metrics` 端点
- [ ] **\[TODO] 健康自检**：定时探测各厂商可用性，`/v1/models` 只返回可用模型

### P3 - 生态扩展

- [ ] **\[TODO] Docker 镜像**：提供官方镜像，一键 `docker run`
- [ ] **\[TODO] 一键脚本**：`curl ... | sh` 自动安装并启动
- [ ] **\[TODO] 插件机制**：第三方 Provider 以插件形式接入
- [ ] **\[TODO] 模型自动更新**：定时拉取各厂商最新模型清单
- [ ] **\[TODO] 更多厂商接入**：阿里云、百度、智谱、Kimi、讯飞等（已接入 DeepSeek / Agnes AI / 商汤 SenseNova）

## FAQ

**Q: 免费额度真的够用吗？**
A: DeepSeek 网页版免费使用，其他厂商有免费额度。多家叠加通常能满足个人开发与测试需求。

**Q: 为什么不直接用 one-api / new-api？**
A: 那些工具功能更全但配置复杂、无注册指引、无会话管理和智能压缩。本项目面向"只想快速用上国内免费模型"的用户，资料库 + 代理 + 会话管理一体，更轻量。

**Q: 支持 OpenAI 官方 SDK 吗？**
A: 支持。任何兼容 OpenAI Chat Completions 协议的 SDK/工具都可以直接对接。

**Q: 会话历史会丢失吗？**
A: 当前使用内存存储，服务重启会丢失。后续计划支持 Redis 持久化（见 Roadmap）。

**Q: 切换模型时上下文会丢失吗？**
A: 不会。会话历史与模型解耦，切换模型时压缩后的摘要 + 最近 N 轮会自动喂给新模型。

**Q: 压缩会影响对话质量吗？**
A: 保留最近 8 轮完整对话保证细节不丢，旧消息通过摘要保留关键信息。实测压缩 89% 后模型仍能正确理解上下文。

## 注意事项

- 免费额度可能随时变动，以各厂商官方公告为准
- DeepSeek Web Token 可能会过期，需定期更新
- 请遵守各厂商的使用条款，不要滥用免费额度
- 本项目仅供学习交流使用

## 贡献

欢迎通过 PR 补充新的模型厂商或完善文档。提交前请：

1. 确认 `config.yaml` 未被提交
2. 新增模型时同步更新 `models.json` 和 `docs/models/`
3. 新增 Provider 时继承 `src/providers/base.js` 并在 `index.js` 注册
4. 遵循现有文档格式

## License

MIT
