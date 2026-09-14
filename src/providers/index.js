const DeepSeekProvider = require('./deepseek');
const AgnesProvider = require('./agnesai');
const SenseNovaProvider = require('./sensenova');

const providers = {
  deepseek: DeepSeekProvider,
  agnesai: AgnesProvider,
  sensenova: SenseNovaProvider,
};

module.exports = providers;
