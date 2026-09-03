class ProviderError extends Error {
  constructor(message, statusCode = 500, upstreamError = null) {
    super(message);
    this.name = 'ProviderError';
    this.statusCode = statusCode;
    this.upstreamError = upstreamError;
  }
}

module.exports = { ProviderError };
