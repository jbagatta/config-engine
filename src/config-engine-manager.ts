import { KV, JSONCodec, NatsConnection } from 'nats'
import {
  ConfigValue,
  IConfigEngineManager,
  ConfigEngineManagerSettings,
  ConfigurationSchema,
  PrimitiveValue,
  ConfigKey,
  RecursivePartial,
} from './types'
import { getConfigKeysAndValues, namespacedKey } from './util'

const jsonCodec = JSONCodec()

export class ConfigEngineManager<T extends ConfigurationSchema<T>> implements IConfigEngineManager<T> {
  private constructor(private readonly kv: KV, private readonly namespace: string) { }
 
  /**
   * Create a new ConfigEngineManager instance with initial settings and default values.
   * If the configuration namespace already exists, it will be overwritten.
   * @param natsClient - Nats connection, requires publish permissions for "$KV.>"
   * @param settings - Configuration settings
   * @returns Initialized ConfigEngineManager instance
   */
  public static async create<T extends ConfigurationSchema<T>>(
    natsClient: NatsConnection,
    settings: ConfigEngineManagerSettings<T>
  ): Promise<IConfigEngineManager<T>> {
    await natsClient.jetstream().views.kv(settings.namespace, settings.kvOptions)

    return ConfigEngineManager.patch(natsClient, settings.namespace, settings.defaults)
  }

  /**
   * Connect a new ConfigEngineManager instance to an existing configuration namespace, 
   * and patch provided configuration values. 
   * @param natsClient - Nats connection, requires publish permissions for "$KV.>"
   * @param namespace - Namespace for the existing configuration
   * @param patch - Partial configuration to patch
   * @returns Initialized ConfigEngineManager instance
   */
  public static async patch<T extends ConfigurationSchema<T>>(
    natsClient: NatsConnection,
    namespace: string,
    patch: RecursivePartial<T>
  ): Promise<IConfigEngineManager<T>> {
    const manager = await ConfigEngineManager.connect<T>(natsClient, namespace)

    for (const {key, value} of getConfigKeysAndValues(patch)) {
      await manager.set(key, value)
    }

    return manager
  }

  /**
   * Connect a new ConfigEngineManager instance to an existing configuration namespace.
   * @param natsClient - Nats connection, requires publish permissions for "$KV.>"
   * @param namespace - Namespace for the existing configuration
   * @returns Initialized ConfigEngineManager instance
   */
  public static async connect<T extends ConfigurationSchema<T>>(
    natsClient: NatsConnection,
    namespace: string
  ): Promise<IConfigEngineManager<T>> {
    const kv = await natsClient.jetstream().views.kv(namespace, { bindOnly: true })
    console.log('ConfigEngineManager connected to KV: ' + JSON.stringify(await kv.status()))

    return new ConfigEngineManager<T>(kv, namespace)
  }

  public async set<K extends ConfigKey<T>>(path: K, value: ConfigValue<T, K>): Promise<void> {
    const key = this.keyFor(path)

    if (value === undefined) {
      await this.kv.delete(key)
    } else {
      await this.kv.put(key, jsonCodec.encode(value))
    }
  }

  public async destroy(): Promise<void> {
    await this.kv.destroy()
  }

  public async history<K extends ConfigKey<T>>(path: K): Promise<ConfigValue<T, K>[]> {
    const history = await this.kv.history({ key: this.keyFor(path) })

    const values: { val: ConfigValue<T, K>, revision: number }[] = []
    for await (const entry of history) {
      const value = entry.operation === 'PUT'
        ? jsonCodec.decode(entry.value) as PrimitiveValue
        : undefined

      values.push({ val: value as ConfigValue<T, K>, revision: entry.revision })
    }
    values.sort((a, b) => a.revision - b.revision)

    return values.map(v => v.val)
  }

  private keyFor<K extends ConfigKey<T>>(path: K): string {
    return namespacedKey(this.namespace, path as string)
  }
} 