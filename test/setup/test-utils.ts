import { NatsConnection, connect } from "nats"

export interface TestConfiguration {
  requiredString: string
  requiredNumber: number
  requiredBoolean: boolean
  optionalString?: string
  optionalNumber?: number
  optionalBoolean?: boolean
  nested: {
    nestedString: string
    nestedOptionalNumber?: number
    nestedOptionalBoolean?: boolean
    doubleNested: {
      nestedOptionalString?: string
      nestedNumber: number
      nestedBoolean: boolean
    }
  }
}

export const fullConfig: TestConfiguration = {
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

export const minimalConfig: TestConfiguration = {
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

export async function engineNatsClient(): Promise<NatsConnection> {
  return connect({ 
    servers: ['nats://localhost:4222'],
    user: 'user',
    pass: 'user'
  })
}

export async function managerNatsClient(): Promise<NatsConnection> {
  return connect({ 
    servers: ['nats://localhost:4222'],
    user: 'admin',
    pass: 'admin'
  })
}


export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
