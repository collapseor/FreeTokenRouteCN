const fs = require('fs');
const path = require('path');

function loadModels() {
  const modelsPath = path.join(process.cwd(), 'models.json');
  const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
  const map = new Map();
  for (const model of data.models) {
    map.set(model.id, model);
  }
  return { data, map };
}

module.exports = { loadModels };
