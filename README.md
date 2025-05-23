# Config Engine

A strongly-typed configuration engine library built on NATS JetStream KV that provides dynamic, live-updating configuration management with type-enforcement and change watching.

## Features

- 🎯 Strongly-typed configuration definitions (including recursive schema support)
- 🔄 Live configuration watching via NATS JetStream KV watch
- 📜 Configuration value history tracking and retrieval
- 💾 Local, up-to-date syncing of configuration state
- 🚀 Built on NATS JetStream for reliable and configurable message delivery

Configuration schemas can contain properties of any optional/required primitive type (string, number, boolean), as well as objects that recursively meet that requirement. Typescript type magic enforces strong typing of both the keys and the corresponding value types across all configuration operations.

## Usage

```typescript
import { ConfigEngine, ConfigEngineManager } from '@jbagatta/config-engine';

// Define your configuration schema
interface AppConfig {
  database: {
    host: string,
    port: number,
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

// COMPILER ERROR - key does not exist on schema
await manager.set('trialLength', 7); 

// COMPILER ERROR - incorrect value type
await manager.set('database.credentials', 101); 

// Retrieve configuration history, if enabled
await manager.history('features.enableCache');  // [true, false]

//// ConfigEngine

// Start the configuration engine
const engine = await ConfigEngine.connect<AppConfig>(natsClient, namespace)

// Get configuration values (type-enforced)
const dbHost = engine.get('database.host');                    // returns a string
const maxConnections = engine.get('features.maxConnections');  // returns a number

// COMPILER ERROR - key does not exist on schema
const trialLength = engine.get('trialLength');  

// Subscribe to configuration changes
configEngine.addListener('database.credentials.username', (newValue: string) => {
  console.log('Database credentials updated:', newValue);
});

```

## License

MIT 