import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getRichError } from './get-rich-error'
import { tool } from 'ai'
import description from './run-command.md'
import z from 'zod/v3'
import type { runUserCode } from '@/trigger'
import { tasks, runs } from '@trigger.dev/sdk'

interface RunUserCodeResult {
  sandboxId: string
  commandId: string | null
  logs: string[]
  exitCode: number | null
  error: string | null
}

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

export const runCommand = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: z
        .string()
        .describe('The ID of the Vercel Sandbox to run the command in'),
      command: z
        .string()
        .describe(
          "The base command to run (e.g., 'npm', 'node', 'python', 'ls', 'cat'). Do NOT include arguments here. IMPORTANT: Each command runs independently in a fresh shell session - there is no persistent state between commands. You cannot use 'cd' to change directories for subsequent commands."
        ),
      args: z
        .array(z.string())
        .optional()
        .describe(
          "Array of arguments for the command. Each argument should be a separate string (e.g., ['install', '--verbose'] for npm install --verbose, or ['src/index.js'] to run a file, or ['-la', './src'] to list files). IMPORTANT: Use relative paths (e.g., 'src/file.js') or absolute paths instead of trying to change directories with 'cd' first, since each command runs in a fresh shell session."
        ),
      sudo: z
        .boolean()
        .optional()
        .describe('Whether to run the command with sudo'),
      wait: z
        .boolean()
        .describe(
          'Whether to wait for the command to finish before returning. If true, the command will block until it completes, and you will receive its output.'
        ),
    }),
    execute: async (
      { sandboxId, command, sudo, wait, args = [] },
      { toolCallId }
    ) => {
      writer.write({
        id: toolCallId,
        type: 'data-run-command',
        data: { sandboxId, command, args, status: 'executing' },
      })

      try {
        const cmdStr = sudo
          ? `sudo ${command} ${args.join(' ')}`
          : args.length > 0
            ? `${command} ${args.join(' ')}`
            : command

        // Call Trigger.dev task
        const handle = await tasks.trigger<typeof runUserCode>('run-user-code', {
          sandboxId,
          command: cmdStr,
          wait,
        })

        if (wait) {
          // FOREGROUND MODE: Wait for the task to complete and get the result
          const run = await runs.retrieve(handle.id)

          if (run.status === 'FAILED' || run.status === 'CRASHED') {
            const errorMessage = typeof run.error === 'string' ? run.error : run.error?.message || 'Task failed'
            throw new Error(errorMessage)
          }

          if (run.status !== 'COMPLETED') {
            throw new Error(`Task did not complete: ${run.status}`)
          }

          const result = run.output as RunUserCodeResult
          if (!result) {
            throw new Error('Task returned no output')
          }

          const exitCode = result.exitCode
          const commandId = result.commandId || null
          // Ensure sandboxId is always a string (task may return null, but tool requires string)
          const resultSandboxId = (result.sandboxId || sandboxId) as string

          // Stream logs from task result (logs are already strings with [stdout]/[stderr] prefixes)
          for (const log of result.logs) {
            writer.write({
              id: toolCallId,
              type: 'data-run-command',
              data: {
                sandboxId: resultSandboxId,
                command,
                args,
                log: log,
                status: 'stream',
              },
          })
          }

          // Send final "done" event with exitCode
          writer.write({
            id: toolCallId,
            type: 'data-run-command',
            data: {
              sandboxId: resultSandboxId,
              commandId: commandId || undefined,
              command,
              args,
              exitCode: exitCode ?? undefined,
              status: 'done',
            },
          })

          return (
            `The command \`${command} ${args.join(
              ' '
            )}\` has finished with exit code ${exitCode ?? 0}.`
          )
        } else {
          // BACKGROUND MODE: Don't wait, just get initial run info
          // Poll briefly to get the initial result with commandId
          let run = await runs.retrieve(handle.id)
          let attempts = 0
          const maxAttempts = 10

          // Poll until we get output or timeout
          while ((!run.output || (run.output as RunUserCodeResult).commandId === null) && attempts < maxAttempts && run.status !== 'COMPLETED' && run.status !== 'FAILED') {
            await new Promise((resolve) => setTimeout(resolve, 100))
            run = await runs.retrieve(handle.id)
            attempts++
          }

          const result = run.output as RunUserCodeResult | undefined
          const commandId = result?.commandId || handle.id.split('_')[1] || '0'
          const resultSandboxId = result?.sandboxId || sandboxId

          writer.write({
            id: toolCallId,
            type: 'data-run-command',
            data: {
              sandboxId: resultSandboxId,
              commandId: commandId,
              command,
              args,
              status: 'running',
            },
          })

          return `The command \`${command} ${args.join(
            ' '
          )}\` has been started in the background in the sandbox with ID \`${resultSandboxId}\` with the commandId ${commandId}.`
        }
      } catch (error) {
        const richError = getRichError({
          action: 'run command',
          args: { sandboxId, command, args },
          error,
        })

        writer.write({
          id: toolCallId,
          type: 'data-run-command',
          data: {
            sandboxId,
            command,
            args,
            error: richError.error,
            status: 'error',
          },
        })

        return richError.message
      }
    },
  })
