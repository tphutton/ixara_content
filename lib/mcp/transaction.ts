import { AsyncLocalStorage } from 'node:async_hooks';

// Scoped only to the new MCP routes. Ordinary webapp calls use the original client.
const storage = new AsyncLocalStorage<any>();
export function withMcpTransaction<T>(tx: any, work: () => Promise<T>): Promise<T> {
  return storage.run(tx, work);
}
export function scopedPrisma<T extends object>(base: T): T {
  return new Proxy(base, {
    get(target: any, property: string | symbol) {
      const tx = storage.getStore();
      if (tx && property === '$transaction') return (work: any) =>
        typeof work === 'function' ? work(tx) : Promise.all(work);
      if (tx && ['$connect', '$disconnect', '$extends'].includes(String(property)))
        throw Error('Client lifecycle changes are unavailable inside an MCP transaction.');
      const active = tx || target;
      const value = Reflect.get(active, property, active);
      return typeof value === 'function' ? value.bind(active) : value;
    },
  });
}
