import { KvOptions } from 'nats'

type Primitive = string | number | boolean | undefined
export type ConfigValueType = Primitive | Primitive[]

type RecursiveConfigValueType<T> = {
  [K in keyof T]: T[K] extends ConfigValueType 
    ? T[K] 
    : T[K] extends object 
      ? RecursiveConfigValueType<T[K]>
      : never
}

/** A schema defining the configuration namespace. */
export type ConfigurationSchema<T> = RecursiveConfigValueType<T>

/**
 * A configuration key, mapping to a primitive value on a ConfigurationSchema.
 * May be nested ('a.b.c') or top-level ('a')
 */
export type ConfigKey<T> = T extends ConfigurationSchema<T> 
  ? T extends object
    ? {
      [K in keyof T]: K extends string 
        ? T[K] extends ConfigValueType 
          ? `${K}` 
          : T[K] extends object 
            ? `${K}.${ConfigKey<T[K]>}` 
            : never 
        : never
      }[keyof T]
    : never
  : never

/** Type-enforced primitive value for an assignable ConfigKey */
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
export interface ConfigChangeEvent<K extends ConfigValueType> {
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
export type ConfigChangeCallback<K extends ConfigValueType> = 
  (event: ConfigChangeEvent<K>) => Promise<void>

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
  addListener<K extends ConfigKey<T>>(
    path: K, 
    callback: ConfigChangeCallback<Extract<ConfigValue<T, K>, ConfigValueType>>
  ): Extract<ConfigValue<T, K>, ConfigValueType>

  /** 
   * Remove a previously added listener
   * @param path - The configuration key being watched
   * @param callback - Callback to remove
   */
  removeListener<K extends ConfigKey<T>>(
    path: K, 
    callback: ConfigChangeCallback<Extract<ConfigValue<T, K>, ConfigValueType>>
  ): void

  /** Close the configuration engine and cleans up resources */
  close(): void
}

export interface ConfigEngineManagerSettings<T extends ConfigurationSchema<T>> {
  /** Namespace for the configuration */
  namespace: string

  /** Configuration options for the underlying JetStream KV store */
  kvOptions: Partial<KvOptions>

  /** Initial values for configuration keys */
  defaults: T
}

export interface ConfigHistoryEntry<T> {
  /** Timestamp when the value was set (milliseconds since epoch) */
  timestamp: number

  /** The value that was set */
  value: ConfigValue<T, ConfigKey<T>>
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
   * @returns Array of ConfigHistoryEntries, sorted in chronological order
   */
  history<K extends ConfigKey<T>>(path: K): Promise<ConfigHistoryEntry<T>[]>

  /** PERMANENTLY delete the configuration namespace */
  destroy(): Promise<void>
}

export type RecursivePartial<T> = {
  [P in keyof T]?:
    T[P] extends (infer U)[] ? RecursivePartial<U>[] :
    T[P] extends object | undefined ? RecursivePartial<T[P]> :
    T[P]
}
