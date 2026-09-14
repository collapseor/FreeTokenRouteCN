# Agnes AI

## 基本信息

- **厂商**：Agnes AI（新加坡 Sapiens AI）

- **控制台（国内节点）**：<https://platform.agnes-ai.cn/>

- **国际站**：<https://platform.agnes-ai.com/>

- **文档**：<https://wiki.agnes-ai.com/zh-Hans/docs/pricing>

- **模型类型**：免费（输入 / 输出 Token 当前均免费，仅 RPM 限制）

## 免费额度

- `agnes-2.5-flash` 与 `agnes-3.0-flash` 的输入缓存命中、输入 Token、输出 Token 当前均免费，无限期

- 免费用户受 RPM（每分钟请求数）限制

- 2026 年 7 月 29 日启用国内节点 `.cn`，旧 `.com` 跨境链路连通性下降，**Key 无需更换**，仅需切换域名

## 模型列表

| 模型 ID          | 名称            | 上下文长度 | 说明                        |
| --------------- | --------------- | ---------- | --------------------------- |
| agnes-2.5-flash | Agnes 2.5 Flash | 128K       | 对话 / 代码 / 识图 / Agent    |
| agnes-3.0-flash | Agnes 3.0 Flash | 128K       | 新一代文本模型，当前免费      |

> 上下文长度以官方文档为准，本项目按保守值估算以触发压缩。

## API 接入方式

### OpenAI 兼容

```bash
# Base URL（国内节点，推荐）: https://apihub.agnes-ai.cn/v1
# 国际站: https://apihub.agnes-ai.com/v1
curl https://apihub.agnes-ai.cn/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.5-flash",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 注册步骤

1. 访问 <https://platform.agnes-ai.cn/> 注册（支持邮箱、Google、GitHub 登录）
2. 进入 **设置 → API 密钥**
3. 点击 **创建新密钥**，自定义名称
4. 复制 `sk-` 开头的 API Key（仅展示一次）

## 限制说明

- 免费额度仅限 RPM 限制，无 Token 总量上限
- `.com` 与 `.cn` 的 API Key 通用
- Token Plan（Starter/Plus/Pro）为付费订阅，与免费 Key 限制池独立

## 参考资料

- [模型定价](https://wiki.agnes-ai.com/zh-Hans/docs/pricing)
- [常见问题](https://wiki.agnes-ai.com/zh-Hans/docs/faqs)
