# Config Engine

A strongly-typed configuration engine library built on NATS JetStream KV that provides dynamic, live-updating configuration management with type-enforcement and local persistence.

Configuration schemas can be any primitive (string, number, boolean, undefined).

## Features

- 🔄 Live configuration watching via NATS JetStream KV watch
- 💾 Local persistence of configuration state
- 🎯 Strongly-typed configuration definitions (including recursion support)
- 🚀 Built on NATS JetStream for reliable and configurable message delivery

## Installation

```bash
npm install @jbagatta/config-engine
```

## Usage

```typescript
import { ConfigEngine, ConfigEngineManager } from '@jbagatta/config-engine';

// Define your configuration schema
interface AppConfig {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  features: {
    enableCache: boolean;
    maxConnections: number;
  };
}
const namespace = 'app-config'

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

// Start the configuration engine
const engine = await ConfigEngine.connect<AppConfig>(natsClient, namespace)

// Get configuration values (type-enforced)
const dbHost = engine.get('database.host');                    // returns a string
const maxConnections = engine.get('features.maxConnections');  // returns a number

// Subscribe to configuration changes
configEngine.addListener('database.credentials.username', (newValue) => {
  console.log('Database credentials updated:', newValue);
});

// Update configuration (type-enforced)
await manager.set('features.enableCache', false);  // requires a boolean value
```

## License

MIT 