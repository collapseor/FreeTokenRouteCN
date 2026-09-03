# DeepSeek-Coder

## 基本信息

- **厂商**：DeepSeek
- **官网**：https://www.deepseek.com/
- **注册地址**：https://platform.deepseek.com/
- **模型类型**：开源免费

## 免费额度

- 开源模型，可本地部署
- 提供在线 API 服务，有免费额度

## 模型列表

| 模型 ID | 名称 | 上下文长度 | 说明 |
|---------|------|-----------|------|
| deepseek-coder-6.7b | DeepSeek-Coder-6.7B | 16K | 基础版 |
| deepseek-coder-33b | DeepSeek-Coder-33B | 16K | 增强版 |
| deepseek-coder-7b | DeepSeek-Coder-7B | 4K | 轻量版 |

## API 接入方式

### 方式一：本地部署

```bash
# 使用 transformers 或 vLLM 本地部署
# 完全免费，需要 GPU
git clone https://github.com/deepseek-ai/DeepSeek-Coder
```

### 方式二：在线 API

```bash
# API Base: https://api.deepseek.com/v1
# 注册平台可获得免费额度
```

## 注册步骤

1. 访问 https://platform.deepseek.com/
2. 注册 DeepSeek 账号
3. 创建 API Key
4. 即可使用 DeepSeek-Coder API

## 限制说明

- 免费额度有限
- 本地部署需要一定硬件资源

## 参考资料

- [官方文档](https://www.deepseek.com/)
- [模型仓库](https://huggingface.co/deepseek-ai/deepseek-coder-6.7b-base)
- [GitHub](https://github.com/deepseek-ai/DeepSeek-Coder)
