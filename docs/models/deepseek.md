# DeepSeek

## 基本信息

- **厂商**：DeepSeek
- **官网**：https://www.deepseek.com/
- **网页版**：https://chat.deepseek.com/
- **模型类型**：免费（网页版 token）

## 免费方式

通过 chat.deepseek.com 网页版的 userToken 调用，无需付费 API Key。

## 模型列表

| 模型 ID | 名称 | 上下文长度 | 说明 |
|---------|------|-----------|------|
| deepseek-chat | DeepSeek V3 (Web) | 64K | 通用对话模型 |
| deepseek-reasoner | DeepSeek R1 (Web) | 64K | 推理增强模型（含思维链） |

## Token 获取方式

1. 访问 https://chat.deepseek.com 并登录
2. 按 F12 打开开发者工具
3. Application → Local Storage → https://chat.deepseek.com
4. 找到 `userToken`，复制其 value 值

## 本项目接入方式

在 `config.yaml` 中配置 token：

```yaml
providers:
  deepseek:
    token: "你的-userToken-值"
```

通过 OpenAI 兼容接口调用：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 技术实现

本项目通过逆向 DeepSeek 网页版 API 实现，主要流程：

1. 创建会话 → POST `/api/v0/chat_session/create`
2. 获取 PoW 挑战 → POST `/api/v0/chat/create_pow_challenge`
3. WASM 求解 PoW → 生成 `x-ds-pow-response` 头
4. 发送对话 → POST `/api/v0/chat/completion`（SSE 流式）
5. 转换为 OpenAI 兼容格式返回

`deepseek-reasoner` 自动启用思维链（`thinking_enabled`），推理过程放在 `reasoning_content` 字段。

## 限制说明

- 网页版有频率限制
- token 可能会过期，需定期更新
- PoW 挑战需使用 WASM 模块求解

## 参考资料

- [DeepSeek 网页版](https://chat.deepseek.com/)
- [DeepSeek 官方 API（付费）](https://platform.deepseek.com/)
- [官方文档](https://api-docs.deepseek.com/)
