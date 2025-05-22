import { ConfigEngineManager } from '../src/config-engine-manager'
import { ConfigEngine } from '../src/config-engine'
import { TestConfiguration, engineNatsClient, managerNatsClient } from './setup/test-utils'
import { describe, it, beforeEach, expect } from '@jest/globals'
import { NatsConnection } from 'nats'

describe('ConfigEngineManager', () => {
  const namespace = 'test-manager'
  const fullConfig: TestConfiguration = {
    requiredString: 'test',
    requiredNumber: 42,
    requiredBoolean: true,
    optionalString: 'optional',
    optionalNumber: 123,
    optionalBoolean: false
  }

  const minimalConfig: TestConfiguration = {
    requiredString: 'min-test',
    requiredNumber: 24,
    requiredBoolean: false
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
      expect(engine.get('requiredString')).toBe('test')
      expect(engine.get('requiredNumber')).toBe(42)
      expect(engine.get('requiredBoolean')).toBe(true)
      expect(engine.get('optionalString')).toBe('optional')
      expect(engine.get('optionalNumber')).toBe(123)
      expect(engine.get('optionalBoolean')).toBe(false)
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
      expect(engine.get('requiredString')).toBe('min-test')
      expect(engine.get('requiredNumber')).toBe(24)
      expect(engine.get('requiredBoolean')).toBe(false)
      expect(engine.get('optionalString')).toBe(undefined)
      expect(engine.get('optionalNumber')).toBe(undefined)
      expect(engine.get('optionalBoolean')).toBe(undefined)
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
      expect(engine.get('requiredString')).toBe('test')
      expect(engine.get('requiredNumber')).toBe(42)
      expect(engine.get('requiredBoolean')).toBe(true)
      expect(engine.get('optionalString')).toBe('optional')
      expect(engine.get('optionalNumber')).toBe(123)
      expect(engine.get('optionalBoolean')).toBe(false)
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

      const patch: Partial<TestConfiguration> = {
        optionalString: 'patched',
        optionalNumber: 456
      }
      await ConfigEngineManager.patch(client, namespace, patch)

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      expect(engine.get('requiredString')).toBe('min-test')
      expect(engine.get('requiredNumber')).toBe(24)
      expect(engine.get('requiredBoolean')).toBe(false)
      expect(engine.get('optionalBoolean')).toBe(undefined)

      expect(engine.get('optionalString')).toBe('patched')
      expect(engine.get('optionalNumber')).toBe(456)

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

      const patch: Partial<TestConfiguration> = {
        optionalString: undefined,
        optionalNumber: undefined
      }
      await ConfigEngineManager.patch(client, namespace, patch)

      const engine = await ConfigEngine.connect<TestConfiguration>(client, namespace)
      expect(engine.get('requiredString')).toBe('test')
      expect(engine.get('requiredNumber')).toBe(42)
      expect(engine.get('requiredBoolean')).toBe(true)
      expect(engine.get('optionalBoolean')).toBe(false)

      expect(engine.get('optionalString')).toBe(undefined)
      expect(engine.get('optionalNumber')).toBe(undefined)

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
      
      expect(engine.get('optionalString')).toEqual('optional')
      expect(engine.get('optionalNumber')).toEqual(123)
      
      const manager = await ConfigEngineManager.connect<TestConfiguration>(client, namespace)
      await manager.set('optionalString', 'connected')
      await manager.set('optionalNumber', 789)

      expect(engine.get('optionalString')).toEqual('connected')
      expect(engine.get('optionalNumber')).toEqual(789)
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
        'optional',
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
