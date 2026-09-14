const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

class Logger {
  constructor(level = 'info') {
    this.level = LEVELS[level] ?? LEVELS.info;
  }

  _log(level, msg) {
    if (LEVELS[level] < this.level) return;
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase()}] ${msg}`;
    if (level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  debug(msg) { this._log('debug', msg); }
  info(msg) { this._log('info', msg); }
  warn(msg) { this._log('warn', msg); }
  error(msg) { this._log('error', msg); }
}

module.exports = Logger;
