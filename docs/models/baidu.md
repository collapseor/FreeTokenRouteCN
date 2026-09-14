# 百度 - 文心一言

## 基本信息

- **厂商**：百度 (Baidu)

- **官网**：<https://yiyan.baidu.com/>

- **注册地址**：<https://cloud.baidu.com/product/wenxinworkshop>

- **模型类型**：免费

## 免费额度

- 新用户注册可获得免费 token 额度

- 支持免费试用 ERNIE 系列模型

## 模型列表

| 模型 ID       | 名称       | 上下文长度 | 说明      |
| ----------- | -------- | ----- | ------- |
| ernie-4.0   | 文心一言 4.0 | 8K    | 旗舰版     |
| ernie-3.5   | 文心一言 3.5 | 8K    | 标准版     |
| ernie-speed | 文心 Speed | -     | 极速版     |
| ernie-lite  | 文心 Lite  | -     | 轻量版（免费） |

## API 接入方式

### 官方 API

```bash
# API Base: https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/
# 需要注册获取 API Key 和 Secret Key
```

```bash
curl "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-4.0?access_token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 注册步骤

1. 访问 <https://cloud.baidu.com/product/wenxinworkshop>
2. 注册百度智能云账号
3. 开通文心一言服务
4. 创建应用获取 API Key 和 Secret Key
5. 获取 Access Token

## 限制说明

- 免费额度有限

- 不同模型免费额度不同

- ERNIE Speed 和 ERNIE Lite 有较多免费额度

## 参考资料

- [官方文档](https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html)

- [快速开始](https://cloud.baidu.com/doc/WENXINWORKSHOP/s/7l27qhmxf)

