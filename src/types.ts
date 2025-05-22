import { KvOptions } from 'nats'

/** Valid primitive value types */
export type PrimitiveValue = string | number | boolean | undefined

/** Valid configuration primitive value types */
export type ConfigValue = string | number | boolean | undefined

/** Event emitted when a configuration value changes */
export interface ConfigChangeEvent<K extends ConfigValue> {
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
export type ConfigChangeCallback<K extends ConfigValue> = (event: ConfigChangeEvent<K>) => Promise<void>

/** 
 * Configuration engine for reading configuration values 
 * and listening for configuration changes 
 */
export interface IConfigEngine<T extends { [K in keyof T]: ConfigValue }> {
  /** 
   * Get the current value for a configuration key
   * @param path - The configuration key to retrieve
   * @returns The current value for the key
   */
  get<K extends keyof T>(path: K): T[K]

  /** 
   * Adds a listener for changes to a specific configuration key
   * @param path - The configuration key to watch
   * @param callback - Callback for when the value changes
   * @returns The current value for the configuration key
   */
  addListener<K extends keyof T>(path: K, callback: ConfigChangeCallback<T[K]>): T[K]

  /** 
   * Remove a previously added listener
   * @param path - The configuration key being watched
   * @param callback - Callback to remove
   */
  removeListener<K extends keyof T>(path: K, callback: ConfigChangeCallback<T[K]>): void

  /** Close the configuration engine and cleans up resources */
  close(): void
}

export interface ConfigEngineManagerSettings<T extends { [K in keyof T]: ConfigValue }> {
  /** Namespace for the configuration */
  namespace: string

  /** Configuration options for the underlying JetStream KV store */
  kvOptions: Partial<KvOptions>

  /** Initial values for configuration keys */
  defaults: T
}

/**
 * Configuration engine manager for creating configuration namespaces 
 * and writing configuration values
 */
export interface IConfigEngineManager<T extends { [K in keyof T]: ConfigValue }> {
  /** 
   * Set/Update a configuration value
   * @param path - The configuration key
   * @param value - The new value (undefined to delete the key)
   */
  set<K extends keyof T>(path: K, value: T[K]): Promise<void>

  /** 
   * Get the configuration value history for a key
   * @param path - The configuration key
   * @returns Array of historical values, sorted in chronological order
   */
  history<K extends keyof T>(path: K): Promise<T[K][]>

  /** Delete the configuration namespace */
  destroy(): Promise<void>
}