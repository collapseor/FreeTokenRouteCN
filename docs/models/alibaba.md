# 阿里云 - 通义千问

## 基本信息

- **厂商**：阿里云 (Alibaba Cloud)
- **官网**：https://qianwen.aliyun.com/
- **注册地址**：https://dashscope.aliyun.com/
- **模型类型**：免费

## 免费额度

- 新用户注册可获得免费 token 额度
- 支持免费试用 Qwen 系列模型

## 模型列表

| 模型 ID | 名称 | 上下文长度 | 说明 |
|---------|------|-----------|------|
| qwen-turbo | 通义千问 Turbo | 8K | 快速响应 |
| qwen-plus | 通义千问 Plus | 32K | 增强版 |
| qwen-max | 通义千问 Max | 8K | 旗舰版 |
| qwen-long | 通义千问 Long | 1000K | 超长上下文 |
| qwen-vl-max | 通义千问 VL | 8K | 多模态 |

## API 接入方式

### 官方 API（OpenAI 兼容）

```bash
# API Base: https://dashscope.aliyuncs.com/compatible-mode/v1
# 需要注册获取 API Key
```

```bash
curl https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "qwen-turbo",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 注册步骤

1. 访问 https://dashscope.aliyun.com/
2. 登录阿里云账号（可使用淘宝/支付宝账号）
3. 开通 DashScope 服务
4. 创建 API Key
5. 获取免费额度

## 限制说明

- 免费额度有限
- 不同模型免费额度不同
- qwen-turbo 和 qwen-plus 有较多免费额度

## 参考资料

- [官方文档](https://help.aliyun.com/zh/model-studio/getting-started/models)
- [API 文档](https://help.aliyun.com/zh/model-studio/developer-reference/api-details)
