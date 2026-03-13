interface CacheItem<T> {
    data: T;
    timestamp: number;
    expiresIn: number; // minutos
}

class CacheService {
    private cache: Map<string, CacheItem<any>> = new Map();

    set<T>(key: string, data: T, expiresIn: number = 5): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn: expiresIn * 60 * 1000 // converter para milissegundos
        });
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        const agora = Date.now();
        if (agora - item.timestamp > item.expiresIn) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    clear(): void {
        this.cache.clear();
    }

    remove(key: string): void {
        this.cache.delete(key);
    }
}

export const cacheService = new CacheService();