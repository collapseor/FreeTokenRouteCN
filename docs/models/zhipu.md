# 智谱 AI - GLM

## 基本信息

- **厂商**：智谱 AI (Zhipu AI)
- **官网**：https://chatglm.cn/
- **注册地址**：https://open.bigmodel.cn/
- **模型类型**：免费

## 免费额度

- 新用户注册可获得免费 token 额度
- 支持免费试用 GLM 系列模型

## 模型列表

| 模型 ID | 名称 | 上下文长度 | 说明 |
|---------|------|-----------|------|
| glm-4 | GLM-4 | 8K | 基础模型 |
| glm-4-air | GLM-4 Air | 8K | 轻量版 |
| glm-4-flash | GLM-4 Flash | 8K | 极速版（免费） |
| glm-4v | GLM-4V | 8K | 多模态模型 |
| chatglm3-6b | ChatGLM3-6B | 8K | 开源版本 |

## API 接入方式

### 官方 API

```bash
# API Base: https://open.bigmodel.cn/api/paas/v4/
# 需要注册获取 API Key
```

```bash
curl https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "glm-4-flash",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 注册步骤

1. 访问 https://open.bigmodel.cn/
2. 注册账号
3. 创建应用获取 API Key
4. 选择免费模型开始使用

## 限制说明

- 免费额度有限
- 不同模型免费额度不同
- GLM-4 Flash 提供较多免费额度

## 参考资料

- [官方文档](https://open.bigmodel.cn/dev/howuse/introduction)
- [模型列表](https://open.bigmodel.cn/dev/howuse/introduction)
