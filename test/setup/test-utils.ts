import { NatsConnection, connect } from "nats"

export interface TestConfiguration {
  requiredString: string
  requiredNumber: number
  requiredBoolean: boolean
  optionalString?: string
  optionalNumber?: number
  optionalBoolean?: boolean
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
