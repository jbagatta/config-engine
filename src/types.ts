import { KvOptions } from 'nats'

export type RecursivePartial<T> = {
  [P in keyof T]?:
    T[P] extends (infer U)[] ? RecursivePartial<U>[] :
    T[P] extends object | undefined ? RecursivePartial<T[P]> :
    T[P]
}

/** Valid primitive value types */
export type PrimitiveValue = string | number | boolean | undefined

/** Recursive type that enforces all properties must be primitive values or objects matching this definition */
type RecursivePrimitive<T> = {
  [K in keyof T]: T[K] extends PrimitiveValue 
    ? T[K] 
    : T[K] extends object 
      ? RecursivePrimitive<T[K]>
      : never
}
export type ConfigurationSchema<T> = RecursivePrimitive<T>

export type ConfigKey<T> = T extends ConfigurationSchema<T> 
  ? T extends object
    ? {
        [K in keyof T]: K extends string ? T[K] extends PrimitiveValue ? `${K}` : T[K] extends object ? `${K}.${ConfigKey<T[K]>}` : never : never
      }[keyof T]
    : never
  : never

export type ConfigValue<T, P extends ConfigKey<T>> = T extends ConfigurationSchema<T> 
  ? P extends keyof T 
    ? T[P] 
    : P extends `${infer K}.${infer R}`
      ? K extends keyof T 
        ? T[K] extends object 
          ? R extends ConfigKey<T[K]>
            ? ConfigValue<T[K], R>
            : never
          : never
        : never
      : never
  : never

/** Event emitted when a configuration value changes */
export interface ConfigChangeEvent<K extends PrimitiveValue> {
  /** The modified key */
  key: string
  /** The previous value */
  oldValue: K
  /** The new value */
  newValue: K
  /** Timestamp when the change occurred (milliseconds since epoch) */
  timestamp: number
} 

/** Callback function for handling configuration change events */
export type ConfigChangeCallback<K extends PrimitiveValue> = (event: ConfigChangeEvent<K>) => Promise<void>

/** 
 * Configuration engine for reading configuration values 
 * and listening for configuration changes 
 */
export interface IConfigEngine<T extends ConfigurationSchema<T>> {
  /** 
   * Get the current value for a configuration key
   * @param path - The configuration key to retrieve
   * @returns The current value for the key
   */
  get<K extends ConfigKey<T>>(path: K): ConfigValue<T, K>

  /** 
   * Adds a listener for changes to a specific configuration key
   * @param path - The configuration key to watch
   * @param callback - Callback for when the value changes
   * @returns The current value for the configuration key
   */
  addListener<K extends ConfigKey<T>>(path: K, callback: ConfigChangeCallback<Extract<ConfigValue<T, K>, PrimitiveValue>>): Extract<ConfigValue<T, K>, PrimitiveValue>

  /** 
   * Remove a previously added listener
   * @param path - The configuration key being watched
   * @param callback - Callback to remove
   */
  removeListener<K extends ConfigKey<T>>(path: K, callback: ConfigChangeCallback<Extract<ConfigValue<T, K>, PrimitiveValue>>): void

  /** Close the configuration engine and cleans up resources */
  close(): void
}

export interface ConfigEngineManagerSettings<T extends ConfigurationSchema<T>> {
  /** Namespace for the configuration */
  namespace: string

  /** Configuration options for the underlying JetStream KV store */
  kvOptions: Partial<KvOptions>

  /** Initial values for configuration keys */
  defaults: RecursivePartial<T>
}

/**
 * Configuration engine manager for creating configuration namespaces 
 * and writing configuration values
 */
export interface IConfigEngineManager<T extends ConfigurationSchema<T>> {
  /** 
   * Set/Update a configuration value
   * @param path - The configuration key
   * @param value - The new value (undefined to delete the key)
   */
  set<K extends ConfigKey<T>>(path: K, value: ConfigValue<T, K>): Promise<void>

  /** 
   * Get the configuration value history for a key
   * @param path - The configuration key
   * @returns Array of historical values, sorted in chronological order
   */
  history<K extends ConfigKey<T>>(path: K): Promise<ConfigValue<T, K>[]>

  /** Delete the configuration namespace */
  destroy(): Promise<void>
}