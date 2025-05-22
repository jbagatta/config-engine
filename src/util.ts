export function namespacedKey(namespace: string, path: string): string {
  return `${namespace}.${path}`
}

export function namespaceWatchFilter(namespace: string): string {
  return `${namespace}.*`
}