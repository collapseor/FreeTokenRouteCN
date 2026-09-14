# 商汤日日新 SenseNova

## 基本信息

- **厂商**：商汤科技（SenseTime）

- **控制台**：<https://platform.sensenova.cn/>

- **文档**：<https://platform.sensenova.cn/docs>

- **模型类型**：免费（Token Plan 公测期，每 5 小时 1500 次调用）

## 免费额度

- Token Plan 公测档 0 元/月，每 5 小时 1500 次调用（部分模型除外）

- 8 月 28 日后启用积分制：通用积分 6 万/5 小时，Flash-Lite 专用积分 6 万/5 小时，周滚动额度 60 万

- Flash-Lite 专属积分消耗后可按 1:1 兑换通用积分返还（有效 30 天）

## 模型列表

| 模型 ID                  | 名称                          | 上下文长度 | 说明                              |
| ----------------------- | ----------------------------- | ---------- | --------------------------------- |
| sensenova-6.8-flash-lite | SenseNova 6.8 Flash Lite     | 256K       | 原生多模态 Agent，数据分析 / 图文 |
| deepseek-v4-flash        | DeepSeek V4 Flash (SenseNova) | 256K       | 支持 reasoning_effort 思考模式      |
| glm-5.2                  | GLM-5.2 (SenseNova)          | 1M         | 代码任务能力强                    |

> 商汤 Token Plan 还提供 kimi-k3、sensenova-u1-fast 等模型，本项目按需接入以上 3 个聊天模型。

## API 接入方式

### OpenAI 兼容

```bash
# Base URL: https://token.sensenova.cn/v1
curl https://token.sensenova.cn/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sensenova-6.8-flash-lite",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

商汤同时提供 Anthropic Messages 兼容端点（`/v1/messages`），本项目使用 OpenAI 兼容协议。

## 注册步骤

1. 访问 <https://platform.sensenova.cn/> 手机号注册验证
2. 进入控制台 → **API Keys** → 点击创建
3. 复制 `sk-` 开头的 API Key（最多可创建 20 个）

## 限制说明

- 公测期速度不稳定，适合学习 / 测试 / 非紧急任务
- 不同模型积分消耗差异大（Flash-Lite 节省，Kimi K3 消耗大）
- 额度每 5 小时滚动重置，超限返回 429

## 参考资料

- [商汤官网常见问题](https://sensetime.com/cn/faq/)
- [SenseNova 6.7 Flash-Lite 发布](https://www.sensetime.com/hk/news/51170639)
