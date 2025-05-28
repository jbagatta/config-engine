# Config Engine

A strongly-typed configuration management library built on Nats JetStream K/V that provides dynamic, live-updating configuration management with type-enforcement and change watching.

## Features

- Strongly-typed configuration schema enforcement (including recursion and array support)
- Live configuration watching via JetStream K/V watch
- Configuration value history tracking and retrieval
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
const manager = ConfigEngineManager.create<AppConfig>(natsClient, {
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
await manager.set('features.enableCache', false);  // requires a boolean value
await manager.set('organization', undefined);      // requires a string | undefined value

// COMPILER ERROR - key does not exist on schema
await manager.set('trialLength', 7); 

// COMPILER ERROR - incorrect value type
await manager.set('database.credentials', 101); 
await manager.set('database.credentials', undefined);  // non-optional key 

// Retrieve configuration history, if enabled
await manager.history('features.enableCache');  // [true, false]

//// ConfigEngine

// Start the configuration engine
const engine = await ConfigEngine.connect<AppConfig>(natsClient, namespace)

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

Spin up a test environment using docker compose:
```
cd test/setup
docker compose up -d
```

and then run the tests as usual:
```
npm test
```

## License

MIT 