# Config Engine

A strongly-typed configuration management library built on Nats JetStream K/V that provides dynamic, live-updating configuration management with type-enforcement and change watching.

## Features

- Strongly-typed configuration schema enforcement (including recursion and array support)
- Live configuration watching
- Configuration value history 
- Locally-persisted, up-to-date syncing of configuration state

### Strongly-Typed Configuration Schema Enforcement

Configuration schemas support properties of the following types (optional or required):

- Primitive types (string, number, boolean)
- Arrays of primitive types (string[], number[], boolean[])
- Nested objects that recursively meet the above requirements

Typescript type magic enforces strong typing of both the keys and the corresponding value types across all configuration engine operations.

### Live configuration watching

Callbacks can be assigned to listen for configuration key changes to allow event-driven, realtime responsiveness to system configuration changes.

### Configuration History

Jetstream K/V supports configurable per-key configuration history.

### Realtime synchronization

Jetstream K/V operates as a stream consumer under the hood, meaning an entire configuration namespace can be subscribed to and persisted locally for immediate usage.

## ConfigEngine

The `ConfigEngine` is the primary access point for retrieving and watching configuration values in an existing namespace. Configuration changes are subscribed to via Jetstream, meaning accessing them is done locally and immediately - state is kept up to date automatically, and callbacks can be attached to the state changes. 

`ConfigEngine` requires a Nats client with only read (subscribe) access to the KV streams.

## ConfigEngineManager

The `ConfigEngineManager` is responsible for creating configuration namespaces, and setting/updating values. It also provides access to configuration history (if enabled via `kvOptions`). 

`ConfigEngineManager` requires a Nats client with write (publish) access to the KV streams in order to perform these tasks.

*NOTE: for safety, it's recommended to use separate Nats client auth for `ConfigEngine` and `ConfigEngineManager`* - see `nats-server.conf` in the test setup directory for an example of configuring this in Jetstream.

## Usage

```typescript
import { ConfigEngine, ConfigEngineManager } from '@jbagatta/config-engine';

// Define your configuration schema
interface AppConfig {
  blockedUsers?: string[]
  organization?: string
  database: {
    host: string,
    port: number,
    replication?: number,
    credentials: {
      username: string,
      password: string
    }
  },
  features: {
    enableCache: boolean,
    maxConnections: number
  }
}
const namespace = 'app-config';

//// ConfigEngineManager

// Create a configuration using the manager
const manager = ConfigEngineManager.create<AppConfig>(natsReadWriteClient, {
  namespace: namespace,
  kvOptions: { replicas: 1, history: 2 },
  defaults: {
    blockedUsers: ['user1', 'user2'],
    organization: 'random org',
    database: {
      host: 'localhost',
      port: 5432,
      credentials: {
        username: 'default',
        password: 'default'
      }
    },
    features: {
      enableCache: true,
      maxConnections: 100
    }
  }
});

// Update configuration (type-enforced)
await manager.set('features.enableCache', false);  // required boolean value
await manager.set('organization', undefined);      // optional string value

// COMPILER ERROR - key does not exist on schema
await manager.set('trialLength', 7); 

// COMPILER ERROR - incorrect value type
await manager.set('database.credentials', 101);        // string, not number
await manager.set('database.credentials', undefined);  // non-optional key 

// Retrieve configuration history, if enabled
await manager.history('features.enableCache');  // [true, false]

//// ConfigEngine

// Start the configuration engine
const engine = await ConfigEngine.connect<AppConfig>(natsReadonlyClient, namespace)

// Get configuration values (type-enforced)
const dbHost = engine.get('database.host');                    // returns a string
const maxConnections = engine.get('features.maxConnections');  // returns a number
const blockedUsers = engine.get('blockedUsers');               // returns a string[]
const dbHost = engine.get('database.replication');             // returns undefined - never set

// COMPILER ERROR - key does not exist on schema
const trialLength = engine.get('trialLength');  

// Assign callbacks to configuration changes
engine.addListener('database.credentials.username', (event: ConfigChangeEvent<string>) => {
  console.log('Database credentials updated:', event.key, event.oldValue, event.newValue, event.timestamp);
});

engine.close()

// delete the configuration permanently
await manager.destroy()

```

## Running Tests

Spin up a test environment with a nats server using docker compose:
```
docker compose -f test/setup/docker-compose.yml up -d
```

and then run the tests as usual:
```
npm test
```

## License

MIT 
