import { ConfigurationSchema, ConfigKey, ConfigValue, RecursivePartial } from './types'

export function namespacedKey(namespace: string, path: string): string {
  return `${namespace}.${path}`
}

export function namespaceWatchFilter(namespace: string): string {
  return `${namespace}.>`
}

export function getConfigKeysAndValues<T extends ConfigurationSchema<T>>(config: RecursivePartial<T>): { key: ConfigKey<T>, value: ConfigValue<T, ConfigKey<T>> }[] {
  const entries: { key: ConfigKey<T>, value: ConfigValue<T, ConfigKey<T>> }[] = []

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null) {
      entries.push(...getConfigKeysAndValues(value as RecursivePartial<T>).map(({ key: k, value: v }) => ({ key: `${key}.${k}` as ConfigKey<T>, value: v as ConfigValue<T, ConfigKey<T>> })))
    } else {
      entries.push({ key: key as ConfigKey<T>, value: value as ConfigValue<T, ConfigKey<T>> })
    }
  }

  return entries
}