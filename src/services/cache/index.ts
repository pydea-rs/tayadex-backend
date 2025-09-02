interface CacheEntry {
    value: string;
    expiresAt: number;
}

export class CacheService {
    private cache = new Map<string, CacheEntry>();
    private static singleInstance: CacheService;

    static getStore() {
        if (CacheService.singleInstance) {
            return CacheService.singleInstance;
        }
        return new CacheService();
    }

    private constructor() {
        if (CacheService.singleInstance) {
            return CacheService.singleInstance;
        }
        CacheService.singleInstance = this;
    }

    get(key: string): string | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    put(key: string, value: string, options?: { expirationTtl?: number }) {
        const expiresAt = Date.now() + (options?.expirationTtl || 300) * 1000;
        const entry = { value, expiresAt };
        console.log({ key, entry });
        this.cache.set(key, entry);

        return { ...entry };
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    cleanup() {
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}
