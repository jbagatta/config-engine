# Config Engine

A strongly-typed configuration engine library built on NATS JetStream KV that provides dynamic, live-updating configuration management with type-enforcement and local persistence.

## Features

- 🔄 Live configuration watching via NATS JetStream KV watch
- 💾 Local persistence of configuration state
- 🎯 Strongly-typed configuration definitions
- 🚀 Built on NATS JetStream for reliable and configurable message delivery

## Installation

```bash
npm install @jbagatta/config-engine
```

## Usage

```typescript
import { ConfigEngine, ConfigSchema } from '@jbagatta/config-engine';

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

// Create a configuration engine instance
const configEngine = new ConfigEngine<AppConfig>({
  natsUrl: 'nats://localhost:4222',
  bucketName: 'app-config',
  // Optional: Define default values
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
await configEngine.connect();

// Get configuration values
const dbHost = configEngine.get('database.host');
const maxConnections = configEngine.get('features.maxConnections');

// Subscribe to configuration changes
configEngine.onChange('database.credentials', (newValue) => {
  console.log('Database credentials updated:', newValue);
});

// Update configuration
await configEngine.set('features.enableCache', false);
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## License

MIT 