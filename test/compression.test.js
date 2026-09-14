// 压缩模块单元测试 - 验证长会话压缩逻辑
const SessionManager = require('../src/session/manager');
const Compression = require('../src/session/compression');
const Logger = require('../src/utils/logger');

const logger = new Logger('info');

// Mock provider: 返回固定摘要
class MockProvider {
  async chat(body) {
    return {
      choices: [{
        message: {
          content: `[摘要] 用户讨论了${body.messages.length - 1}条消息的内容，涉及技术方案讨论。`,
        },
      }],
    };
  }
}

const sessionManager = new SessionManager();
const compression = new Compression({
  sessionManager,
  getProvider: () => new MockProvider(),
  logger,
  recentRounds: 2, // 测试用小值，只保留最近 2 轮
});

// 创建一个超长会话（20 条消息）
const sessionId = 'test_conv_1';
for (let i = 0; i < 20; i++) {
  sessionManager.appendUserMessage(sessionId, `这是第 ${i + 1} 条用户消息，内容是关于项目讨论的一些细节。`.repeat(10));
  sessionManager.appendAssistantMessage(sessionId, `这是对第 ${i + 1} 条消息的回复，包含了一些分析和建议。`.repeat(10));
}

const fullSession = sessionManager.getOrCreate(sessionId);
console.log(`原始消息数: ${fullSession.messages.length}`);

// 用小的 contextLength 触发压缩
const contextLength = 2000; // 故意设小
const before = sessionManager.getMessagesForModel(sessionId, contextLength);
console.log(`压缩前 token: ${before.tokenCount}, 阈值: ${before.threshold}, 超限: ${before.exceeded}`);

compression.compressIfNeeded(sessionId, 'deepseek-chat', contextLength).then((compressed) => {
  console.log(`压缩执行: ${compressed}`);

  const after = sessionManager.getMessagesForModel(sessionId, contextLength);
  console.log(`压缩后 token: ${after.tokenCount}, 超限: ${after.exceeded}`);
  console.log(`压缩后消息数: ${after.messages.length}`);
  console.log(`摘要存在: ${!!fullSession.summary}`);
  console.log(`摘要覆盖到索引: ${fullSession.summaryUpToIndex}`);

  // 验证摘要作为 system 消息注入
  const firstMsg = after.messages[0];
  console.log(`第一条消息角色: ${firstMsg.role}`);
  console.log(`第一条消息内容前 80 字: ${firstMsg.content.substring(0, 80)}...`);

  if (compressed && after.tokenCount < before.tokenCount) {
    console.log('\n✓ 压缩测试通过: token 从', before.tokenCount, '降到', after.tokenCount);
  } else {
    console.log('\n✗ 压缩测试失败');
    process.exit(1);
  }
});
