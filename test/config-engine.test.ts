import { ConfigEngine } from '../src/config-engine'
import { ConfigEngineManager } from '../src/config-engine-manager'
import { TestConfiguration, managerNatsClient, engineNatsClient, sleep, fullConfig, minimalConfig } from './setup/test-utils'
import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals'
import { NatsConnection } from 'nats'

describe('ConfigEngine', () => {
  const namespace = 'test-engine'

  let managerClient: NatsConnection
  let engineClient: NatsConnection

  beforeEach(async () => {
    managerClient = await managerNatsClient()
    engineClient = await engineNatsClient()

    try {
      const kv = await managerClient.jetstream().views.kv(namespace)
      await kv.destroy()
    } catch (error) {
      // Ignore errors if namespace doesn't exist
    }
  })

  afterEach(async () => {
    await managerClient.close()
    await engineClient.close()
  })

  describe('get', () => {
    it('should get all configuration values', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)

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

      engine.close()
    })

    it('should return undefined for unset optional values', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: minimalConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)

      const kv = await engineClient.jetstream().views.kv(namespace, { bindOnly: true })
      const keys = await kv.keys()
      for await (const key of keys) {
        console.error(key)
      }

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
      
      engine.close()
    })
  })

  describe('addListener', () => {
    it('should call listener when value changes', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)
      const manager = await ConfigEngineManager.connect<TestConfiguration>(managerClient, namespace)

      const callback = jest.fn(async () => {}) 
      engine.addListener('optionalString', callback)

      await manager.set('optionalString', 'new value')
      await sleep(250)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        key: namespace + '.optionalString',
        oldValue: fullConfig.optionalString,
        newValue: 'new value'
      }))

      engine.close()
    })

    it('should add listeners idempotently', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: fullConfig
      })
  
      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)
      const manager = await ConfigEngineManager.connect<TestConfiguration>(managerClient, namespace)
  
      const callback = jest.fn(async () => {}) 
      engine.addListener('optionalString', callback)
      engine.addListener('optionalString', callback)
      await manager.set('optionalString', 'new value')
      await sleep(250)
  
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ 
        key: namespace + '.optionalString',
        oldValue: fullConfig.optionalString,
        newValue: 'new value'
      }))
  
      engine.close()
    })

    it('should suppress callback errors', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)
      const manager = await ConfigEngineManager.connect<TestConfiguration>(managerClient, namespace)

      const errorCallback = jest.fn(async () => { throw new Error('Callback error') }) 
      engine.addListener('optionalString', errorCallback)

      // This should not throw
      await manager.set('optionalString', 'new value')
      await sleep(250)

      expect(errorCallback).toHaveBeenCalledTimes(1)

      engine.close()
    })

    it('should allow removing listeners', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)
      const manager = await ConfigEngineManager.connect<TestConfiguration>(managerClient, namespace)

      const callback = jest.fn(async () => {}) 
      engine.addListener('optionalString', callback)

      await manager.set('optionalString', 'first change')
      await sleep(250)

      expect(callback).toHaveBeenCalledTimes(1)
      callback.mockClear()

      engine.removeListener('optionalString', callback)

      // Second change should not trigger callback
      await manager.set('optionalString', 'second change')
      await sleep(250)
      expect(callback).not.toHaveBeenCalled()

      engine.close()
    })
  })

  describe('connect', () => {
    it('should throw error when connecting to non-existent namespace', async () => {
      await expect(ConfigEngine.connect<TestConfiguration>(engineClient, 'non-existent'))
        .rejects.toThrow()
    })

    it('should throw error after close', async () => {
      await ConfigEngineManager.create(managerClient, {
        namespace,
        kvOptions: { replicas: 1, history: 2 },
        defaults: fullConfig
      })

      const engine = await ConfigEngine.connect<TestConfiguration>(engineClient, namespace)
      engine.close()

      expect(() => engine.get('requiredString')).toThrow('ConfigEngine closed')
      const callback = jest.fn(async () => {}) 
      expect(() => engine.addListener('requiredString', callback)).toThrow('ConfigEngine closed')
    })
  })
})