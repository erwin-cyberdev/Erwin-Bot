// Cache simple avec TTL
class SimpleCache {
  constructor() {
    this.cache = new Map();
    // Nettoyage toutes les 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  set(key, value, ttl = 30000) {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  delete(key) {
    this.cache.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Export d'une instance unique
export const cache = new SimpleCache();
