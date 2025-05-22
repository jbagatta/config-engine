import { KV, JSONCodec, QueuedIterator, KvEntry, NatsConnection } from 'nats'
import {
  IConfigEngine,
  ConfigValue,
  ConfigChangeEvent,
  ConfigChangeCallback,
} from './types'
import { namespacedKey, namespaceWatchFilter } from './util'

const jsonCodec = JSONCodec()
 
interface ConfigurationEntry {
  value: ConfigValue
  revision: number
}

export class ConfigEngine<T extends { [K in keyof T]: ConfigValue }> implements IConfigEngine<T> {
  private config = new Map<string, ConfigurationEntry>()
  private watchers = new Map<string, Set<ConfigChangeCallback<ConfigValue>>>()
  private watch: QueuedIterator<KvEntry> | undefined
  private active = false
  private initialized = false
  private constructor(private readonly kv: KV, private readonly namespace: string) { }

  /**
   * Connect a new ConfigEngine instance to an existing configuration namespace.
   * @param natsClient - NATS connection, requires subscribe permissions for "$KV.>"
   * @param namespace - Namespace for the existing configuration
   * @returns Initialized ConfigEngine instance
   */
  public static async connect<T extends { [K in keyof T]: ConfigValue }>(
    natsClient: NatsConnection,
    namespace: string
  ): Promise<IConfigEngine<T>> {
    const kv = await natsClient.jetstream().views.kv(namespace, { bindOnly: true })
    console.log('ConfigEngine connected to KV: ' + JSON.stringify(await kv.status()))

    const engine = new ConfigEngine<T>(kv, namespace)
    await new Promise<void>(engine.initialize.bind(engine))
    
    return engine
  }
  
  private async initialize(
    resolve: () => void,
    reject: (reason?: unknown) => void
  ): Promise<void> {
    try {
      const watch = await this.kv.watch({
        key: namespaceWatchFilter(this.namespace),
        initializedFn: () => {
          this.active = true
          this.initialized = true
          resolve()
        }
      })
      this.watch = watch

      ;(async () => {
        for await (const entry of watch) {
          if (this.initialized && !this.active) {
            throw new Error('ConfigEngine closed')
          }
          this.processEntry(entry)
        }
      }).bind(this)().catch(reject)
    } catch (error) {
      reject(error)
    }
  }

  public close(): void {
    this.watch?.stop()
    this.active = false

    this.watchers.clear()
  }

  public get<K extends keyof T>(path: K): T[K] {
    this.checkActive()

    const entry = this.config.get(this.keyFor(path)) 
    return entry?.value as T[K]
  }

  public addListener<K extends keyof T>(
    path: K,
    callback: ConfigChangeCallback<T[K]>
  ): T[K] {
    this.checkActive()
    const key = this.keyFor(path)

    const callbacks = this.watchers.get(key) ?? new Set()
    callbacks.add(callback as ConfigChangeCallback<ConfigValue>)

    this.watchers.set(key, callbacks)

    return this.get(path)
  }

  public removeListener<K extends keyof T>(
    path: K,
    callback: ConfigChangeCallback<T[K]>
  ): boolean {
    const key = this.keyFor(path)
    const watchers = this.watchers.get(key)

    if (watchers) {
      return watchers.delete(callback as ConfigChangeCallback<ConfigValue>)
    }
    return false
  }

  private processEntry(entry: KvEntry): void {
    const key = entry.key
    const operation = entry.operation

    try {
      const value = operation === 'PUT'
        ? jsonCodec.decode(entry.value) as ConfigValue
        : undefined

      const configEntry: ConfigurationEntry = {
        value: value,
        revision: entry.revision
      }
      this.handleConfigChange(key, configEntry)
    } catch (error) {
      console.error(`Could not process entry ${key}, revision: ${entry.revision}, error: ${error}`)
    }
  }

  private handleConfigChange(key: string, configEntry: ConfigurationEntry): void {
    const oldValue = this.config.get(key)
    if (oldValue && oldValue.revision >= configEntry.revision) {
      return
    }

    this.config.set(key, configEntry)

    const watchers = this.watchers.get(key)
    if (watchers) {
      const event: ConfigChangeEvent<ConfigValue> = {
        key,
        oldValue: oldValue?.value,
        newValue: configEntry.value,
        timestamp: Date.now()
      }

      Array.from(watchers).map(callback => callback(event).catch(console.error))
    }
  }

  private checkActive(): void {
    if (!this.active) {
      throw new Error('ConfigEngine closed')
    }
  }

  private keyFor<K extends keyof T>(path: K): string {
    return namespacedKey(this.namespace, path as string)
  }
} 