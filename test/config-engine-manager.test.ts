import { ConfigEngineManager } from '../src/config-engine-manager'
import { ConfigEngine } from '../src/config-engine'
import { TestConfiguration, engineNatsClient, managerNatsClient } from './setup/test-utils'
import { describe, it, beforeEach, expect } from '@jest/globals'
import { NatsConnection } from 'nats'
import { RecursivePartial } from '../src/types'

describe('ConfigEngineManager', () => {
  const namespace = 'test-manager'
  const fullConfig: TestConfiguration = {
    requiredString: 'test',
    requiredNumber: 42,
    requiredBoolean: true,
    optionalString: 'optional',
    optionalNumber: 123,
    optionalBoolean: false,
    nested: {
      nestedString: 'nested',
      nestedOptionalNumber: 42,
      nestedOptionalBoolean: true,
      doubleNested: {
        nestedOptionalString: 'double nested',
        nestedNumber: 42,
        nestedBoolean: true
      }
    }
  }

  const minimalConfig: TestConfiguration = {
    requiredString: 'min-test',
    requiredNumber: 24,
    requiredBoolean: false,
    nested: {
      nestedString: 'nested',
      doubleNested: {
        nestedNumber: 42,
        nestedBoolean: true
      }
    }
  }

  let client: NatsConnection
  beforeEach(async () => {
    client = await managerNatsClient()
    try {
      const kv = await client.jetstream().views.kv(namespace)
      await kv.destroy()
    } catch (error) {
      // Ignore errors if namespace doesn't exist
    }
  })

  afterEach(async () => {
    await client.close()
  })

  describe('create', () => {
    it('should create a new namespace with default configuration values', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      
      expect(engine.get('requiredString')).toBe(fullConfig.requiredString)
      expect(engine.get('requiredNumber')).toBe(fullConfig.requiredNumber)
      expect(engine.get('requiredBoolean')).toBe(fullConfig.requiredBoolean)
      expect(engine.get('optionalString')).toBe(fullConfig.optionalString)
      expect(engine.get('optionalNumber')).toBe(fullConfig.optionalNumber)
      expect(engine.get('optionalBoolean')).toBe(fullConfig.optionalBoolean)
      expect(engine.get('nested.nestedString')).toBe(fullConfig.nested.nestedString)  
      expect(engine.get('nested.nestedOptionalNumber')).toBe(fullConfig.nested.nestedOptionalNumber)
      expect(engine.get('nested.nestedOptionalBoolean')).toBe(fullConfig.nested.nestedOptionalBoolean)
      expect(engine.get('nested.doubleNested.nestedOptionalString')).toBe(fullConfig.nested.doubleNested.nestedOptionalString)
      expect(engine.get('nested.doubleNested.nestedNumber')).toBe(fullConfig.nested.doubleNested.nestedNumber)
      expect(engine.get('nested.doubleNested.nestedBoolean')).toBe(fullConfig.nested.doubleNested.nestedBoolean)
    })

    it('should create a new namespace with only required configuration values', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: minimalConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      expect(engine.get('requiredString')).toBe(minimalConfig.requiredString)
      expect(engine.get('requiredNumber')).toBe(minimalConfig.requiredNumber)
      expect(engine.get('requiredBoolean')).toBe(minimalConfig.requiredBoolean)
      expect(engine.get('nested.nestedString')).toBe(minimalConfig.nested.nestedString)  
      expect(engine.get('nested.doubleNested.nestedNumber')).toBe(minimalConfig.nested.doubleNested.nestedNumber)
      expect(engine.get('nested.doubleNested.nestedBoolean')).toBe(minimalConfig.nested.doubleNested.nestedBoolean)
      expect(engine.get('optionalString')).toBe(undefined)
      expect(engine.get('optionalNumber')).toBe(undefined)
      expect(engine.get('optionalBoolean')).toBe(undefined)
      expect(engine.get('nested.nestedOptionalNumber')).toBe(undefined)
      expect(engine.get('nested.nestedOptionalBoolean')).toBe(undefined)
      expect(engine.get('nested.doubleNested.nestedOptionalString')).toBe(undefined)
    })

    it('should overwrite existing namespace with new default configuration values', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: minimalConfig
      })

      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      expect(engine.get('requiredString')).toBe(fullConfig.requiredString)
      expect(engine.get('requiredNumber')).toBe(fullConfig.requiredNumber)
      expect(engine.get('requiredBoolean')).toBe(fullConfig.requiredBoolean)
      expect(engine.get('optionalString')).toBe(fullConfig.optionalString)
      expect(engine.get('optionalNumber')).toBe(fullConfig.optionalNumber)
      expect(engine.get('optionalBoolean')).toBe(fullConfig.optionalBoolean)
      expect(engine.get('nested.nestedString')).toBe(fullConfig.nested.nestedString)  
      expect(engine.get('nested.nestedOptionalNumber')).toBe(fullConfig.nested.nestedOptionalNumber)
      expect(engine.get('nested.nestedOptionalBoolean')).toBe(fullConfig.nested.nestedOptionalBoolean)
      expect(engine.get('nested.doubleNested.nestedOptionalString')).toBe(fullConfig.nested.doubleNested.nestedOptionalString)
      expect(engine.get('nested.doubleNested.nestedNumber')).toBe(fullConfig.nested.doubleNested.nestedNumber)
      expect(engine.get('nested.doubleNested.nestedBoolean')).toBe(fullConfig.nested.doubleNested.nestedBoolean)
    })

    it('should error when trying to create from readonly nats connection', async () => {
      const readonlyClient = await engineNatsClient()

      await expect(ConfigEngineManager.create(readonlyClient, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      }))
        .rejects.toThrow()

      await readonlyClient.close()
    })
  })

  describe('patch', () => {
    it('should patch an existing namespace with new values', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: minimalConfig
      })

      const patch: RecursivePartial<TestConfiguration> = {
        optionalString: 'patched',
        optionalNumber: 456,
        nested: {
          nestedString: 'updated',
          doubleNested: {
            nestedBoolean: false
          }
        }
      }
      await ConfigEngineManager.patch(client, namespace, patch)

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      expect(engine.get('requiredString')).toBe(minimalConfig.requiredString)
      expect(engine.get('requiredNumber')).toBe(minimalConfig.requiredNumber)
      expect(engine.get('requiredBoolean')).toBe(minimalConfig.requiredBoolean)
      expect(engine.get('nested.doubleNested.nestedNumber')).toBe(minimalConfig.nested.doubleNested!.nestedNumber)
      expect(engine.get('optionalBoolean')).toBe(undefined)
      expect(engine.get('optionalString')).toBe(patch.optionalString)
      expect(engine.get('optionalNumber')).toBe(patch.optionalNumber)
      expect(engine.get('nested.nestedString')).toBe(patch.nested!.nestedString)
      expect(engine.get('nested.doubleNested.nestedBoolean')).toBe(patch.nested!.doubleNested!.nestedBoolean)

      await client.close()
    })

    it('should remove keys when explicitly undefined in patch', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      })

      const patch: RecursivePartial<TestConfiguration> = {
        optionalString: undefined,
        optionalNumber: undefined,
        nested: {
          nestedOptionalNumber: undefined,
        }
      }
      await ConfigEngineManager.patch(client, namespace, patch)

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      expect(engine.get('requiredString')).toBe(fullConfig.requiredString)
      expect(engine.get('requiredNumber')).toBe(fullConfig.requiredNumber)
      expect(engine.get('requiredBoolean')).toBe(fullConfig.requiredBoolean)
      expect(engine.get('optionalBoolean')).toBe(fullConfig.optionalBoolean)
      expect(engine.get('nested.nestedOptionalBoolean')).toBe(fullConfig.nested.nestedOptionalBoolean)
      expect(engine.get('nested.doubleNested.nestedOptionalString')).toBe(fullConfig.nested.doubleNested.nestedOptionalString)
      expect(engine.get('nested.doubleNested.nestedNumber')).toBe(fullConfig.nested.doubleNested.nestedNumber)
      expect(engine.get('nested.doubleNested.nestedBoolean')).toBe(fullConfig.nested.doubleNested.nestedBoolean)
      expect(engine.get('optionalString')).toBe(undefined)
      expect(engine.get('optionalNumber')).toBe(undefined)
      expect(engine.get('nested.nestedOptionalNumber')).toBe(undefined)

      await client.close()
    })

    it('should throw error when patching non-existent namespace', async () => {
      await expect(ConfigEngineManager.patch(client, 'non-existent', {}))
        .rejects.toThrow()
    })

    it('should error when trying to patch from readonly nats connection', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      })

      const readonlyClient = await engineNatsClient()

      await expect(ConfigEngineManager.patch(readonlyClient, namespace, {
        requiredString: 'test'
      }))    
        .rejects.toThrow()

      await readonlyClient.close()
    })
  })

  describe('connect', () => {
    it('should allow setting values in an existing namespace', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      
      expect(engine.get('optionalString')).toEqual(fullConfig.optionalString)
      expect(engine.get('optionalNumber')).toEqual(fullConfig.optionalNumber)
      
      const manager = await ConfigEngineManager.connect<TestConfiguration>(client, namespace)
      
      const newStringVal = 'new string value'
      const newNumberVal = 789
      await manager.set('optionalString', newStringVal)
      await manager.set('optionalNumber', newNumberVal)

      expect(engine.get('optionalString')).toEqual(newStringVal)
      expect(engine.get('optionalNumber')).toEqual(newNumberVal)
    })

    it('should track history including deletes and undefined values', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 5
        },
        defaults: fullConfig
      })

      const manager = await ConfigEngineManager.connect<TestConfiguration>(client, namespace)
      
      await manager.set('optionalString', 'first')
      await manager.set('optionalString', 'second')
      await manager.set('optionalString', undefined)
      await manager.set('optionalString', 'final')

      expect(await manager.history('optionalString')).toEqual([
        fullConfig.optionalString,
        'first',
        'second',
        undefined,
        'final'
      ])
    })

    it('should error when trying to create from readonly nats connection', async () => {
      const readonlyClient = await engineNatsClient()

      await expect(ConfigEngineManager.create(readonlyClient, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      }))
        .rejects.toThrow()

      await readonlyClient.close()
    })

    it('should destroy configuration namespace', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 5
        },
        defaults: fullConfig
      })

      const manager = await ConfigEngineManager.connect<TestConfiguration>(client, namespace)
      
      await manager.destroy()

      await expect(ConfigEngineManager.connect<TestConfiguration>(client, namespace))
        .rejects.toThrow()
    })

    it('should throw error when connecting to non-existent namespace', async () => {
      await expect(ConfigEngineManager.connect<TestConfiguration>(client, 'non-existent'))
        .rejects.toThrow()
    })

    it('should error when trying to set from readonly nats connection', async () => {
      await ConfigEngineManager.create(client, {
        namespace,
        kvOptions: {
          replicas: 1,
          history: 2
        },
        defaults: fullConfig
      })

      const readonlyClient = await engineNatsClient()

      const manager = await ConfigEngineManager.connect<TestConfiguration>(readonlyClient, namespace)
      
      await expect(manager.set('optionalString', 'test'))    
        .rejects.toThrow()

      await readonlyClient.close()
    })
  })
})
