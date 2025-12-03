import { Sandbox } from 'e2b'
import { task } from '@trigger.dev/sdk'

interface RunUserCodePayload {
  code?: string
  command?: string
  files?: Array<{ path: string; data: string }>
  sandboxId?: string
  timeout?: number
  ports?: number[]
  wait?: boolean
}

interface RunUserCodeResult {
  sandboxId: string
  commandId: string | null
  logs: string[]
  exitCode: number | null
  error: string | null
}

export const runUserCode = task({
  id: 'run-user-code',
  run: async (payload: RunUserCodePayload): Promise<RunUserCodeResult> => {
    const { code, command, files, sandboxId: existingSandboxId, timeout, ports, wait = true } = payload

    let sandboxId: string | null = null
    let commandId: string | null = null
    const logs: string[] = []
    let exitCode: number | null = null
    let error: string | null = null
    let sandbox: Sandbox | null = null
    let wasNewSandbox = false

    try {
      // Connect to existing sandbox or create new one
      if (existingSandboxId) {
        sandbox = await Sandbox.connect(existingSandboxId, {
          apiKey: process.env.E2B_API_KEY,
        })
        sandboxId = sandbox.sandboxId
      } else {
        sandbox = await Sandbox.create({
          apiKey: process.env.E2B_API_KEY,
          timeoutMs: timeout ?? 600000,
          ports,
        } as any)
        sandboxId = sandbox.sandboxId
        wasNewSandbox = true
      }

      // Write files if provided
      if (files && files.length > 0) {
        await sandbox.files.write(
          files.map((file) => ({
            path: file.path,
            data: file.data,
          }))
        )
      }

      // If code is provided without command, write to /tmp/user-code.js and set command
      let finalCommand = command
      if (code && !command) {
        await sandbox.files.write([
          { path: '/tmp/user-code.js', data: code },
        ])
        finalCommand = 'node /tmp/user-code.js'
      } else if (code && command) {
        // If both provided, write code to /tmp/user-code.js but use provided command
        await sandbox.files.write([
          { path: '/tmp/user-code.js', data: code },
        ])
      }

      if (!finalCommand) {
        throw new Error('Either command or code must be provided')
      }

      if (wait) {
        // FOREGROUND MODE: use streaming with async iterator pattern
        const logsArray: Array<{ type: 'stdout' | 'stderr'; line: string }> = []
        let currentStdout = ''
        let currentStderr = ''

        // Run command with streaming
        const result = await sandbox.commands.run(finalCommand, {
          background: false,
          onStdout: (chunk: string) => {
            currentStdout += chunk
            const lines = currentStdout.split('\n')
            currentStdout = lines.pop() || ''
            for (const line of lines) {
              if (line) {
                logsArray.push({ type: 'stdout', line })
              }
            }
          },
          onStderr: (chunk: string) => {
            currentStderr += chunk
            const lines = currentStderr.split('\n')
            currentStderr = lines.pop() || ''
            for (const line of lines) {
              if (line) {
                logsArray.push({ type: 'stderr', line })
              }
            }
          },
        })

        // Send any remaining buffered output
        if (currentStdout) {
          logsArray.push({ type: 'stdout', line: currentStdout })
        }
        if (currentStderr) {
          logsArray.push({ type: 'stderr', line: currentStderr })
        }

        // Format logs with EXACT prefixes: [stdout] message and [stderr] message
        for (const log of logsArray) {
          if (log.type === 'stdout') {
            logs.push(`[stdout] ${log.line}`)
          } else {
            logs.push(`[stderr] ${log.line}`)
          }
        }

        exitCode = result.exitCode ?? null
        commandId = null
        error = null
      } else {
        // BACKGROUND MODE: start command without waiting
        const proc = await sandbox.commands.run(finalCommand, {
          background: true,
        })

        commandId = String(proc.pid)
        logs.length = 0 // Empty logs array
        exitCode = null
        error = null
      }

      // Note: Sandbox will auto-close when timeout is reached or process ends
      // We don't manually close it to allow reuse when sandboxId was provided
    } catch (err) {
      // ERROR HANDLING: return error structure
      error = err instanceof Error ? err.message : String(err)
      exitCode = 1
      commandId = null
      logs.length = 0
    }

    // Return result structure
    // Ensure sandboxId is always a string (should always be set if we got here)
    if (!sandboxId) {
      throw new Error('Sandbox ID was not set')
    }

    return {
      sandboxId,
      commandId,
      logs,
      exitCode,
      error,
    }
  },
})
