import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  // Your project ref from the Trigger.dev dashboard
  // You can find this on the Project settings page in the dashboard
  project: 'proj_bivhprasqtzqwxabyhco', // Update this with your actual project ref if different

  // Directories containing your trigger tasks
  dirs: ['./trigger'],

  // Retry configuration
  retries: {
    // Enable retries in development mode (when using the CLI)
    enabledInDev: false,
    // Default retry settings (used if not specified on a task)
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },

  // Maximum duration of a task in seconds (1 hour)
  maxDuration: 3600,
})

