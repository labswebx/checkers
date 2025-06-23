const { LRUCache } = require('lru-cache')

class Cache {
  constructor({ max = 100, ttl = 60 } = {}) {
    this.cache = new LRUCache({
      max,
      ttl: ttl * 1000, // TTL in milliseconds
      allowStale: false,
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value);
  }

  del(key) {
    this.cache.delete(key);
  }

  reset() {
    this.cache.clear();
  }
}

module.exports = Cache; 