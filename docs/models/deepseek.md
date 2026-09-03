# DeepSeek

## 基本信息

- **厂商**：DeepSeek
- **官网**：https://www.deepseek.com/
- **注册地址**：https://platform.deepseek.com/
- **模型类型**：免费

## 免费额度

- 新用户注册可获得免费 token 额度
- 定期有促销活动赠送额度

## 模型列表

| 模型 ID | 名称 | 上下文长度 | 说明 |
|---------|------|-----------|------|
| deepseek-chat | DeepSeek Chat | 64K | 通用对话模型 |
| deepseek-reasoner | DeepSeek Reasoner | 64K | 推理增强模型 |
| deepseek-coder | DeepSeek Coder | 16K | 代码模型 |

## API 接入方式

### 官方 API

```bash
# API Base: https://api.deepseek.com/v1
# 需要注册获取 API Key
```

```bash
curl https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 注册步骤

1. 访问 https://platform.deepseek.com/
2. 注册账号
3. 创建 API Key
4. 获取免费额度

## 限制说明

- 免费额度有数量限制
- 超出后需购买 token

## 参考资料

- [官方文档](https://api-docs.deepseek.com/)
- [模型列表](https://platform.deepseek.com/models)
