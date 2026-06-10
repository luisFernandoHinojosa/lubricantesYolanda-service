class CacheService {
    #client = null;

    setClient(redisClient) {
        this.#client = redisClient;
    }

    get isConnected() {
        return this.#client !== null;
    }

    async get(key) {
        if (!this.#client) return null;
        try {
            const raw = await this.#client.get(key);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.warn('[Cache] Error en get:', err.message);
            return null;
        }
    }

    async set(key, value, ttlSeconds = 300) {
        if (!this.#client) return;
        try {
            await this.#client.set(key, JSON.stringify(value), { EX: ttlSeconds });
        } catch (err) {
            console.warn('[Cache] Error en set:', err.message);
        }
    }

    async del(key) {
        if (!this.#client) return;
        try {
            await this.#client.del(key);
        } catch (err) {
            console.warn('[Cache] Error en del:', err.message);
        }
    }

    async delPattern(pattern) {
        if (!this.#client) return;
        try {
            const keys = await this.#client.keys(pattern);
            if (keys.length > 0) await this.#client.del(...keys);
        } catch (err) {
            console.warn('[Cache] Error en delPattern:', err.message);
        }
    }
}

export const cache = new CacheService();