import { NextResponse, type NextRequest } from 'next/server'
import { Sandbox } from 'e2b'

interface Params {
  sandboxId: string
  cmdId: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const logParams = await params
  const encoder = new TextEncoder()
  const sandbox = await Sandbox.connect(logParams.sandboxId, {
    apiKey: process.env.E2B_API_KEY,
  })

  const pid = parseInt(logParams.cmdId, 10)
  if (isNaN(pid)) {
    return NextResponse.json(
      { error: 'Invalid command ID' },
      { status: 400 }
    )
  }

  try {
    // Create async iterator for command logs using e2b callbacks
    async function* streamCommandLogs() {
      const logQueue: Array<{
        data: string
        stream: 'stdout' | 'stderr'
        timestamp: number
      }> = []
      let resolveNext: ((value: void) => void) | null = null
      let isFinished = false
    let currentStdout = ''
    let currentStderr = ''

      const commandHandle = await sandbox.commands.connect(pid, {
              onStdout: (chunk: string) => {
                currentStdout += chunk
          // Split multi-line chunks properly
                const lines = currentStdout.split('\n')
                currentStdout = lines.pop() || ''
                for (const line of lines) {
            if (line) {
              logQueue.push({
                        data: `[stdout] ${line}`,
                        stream: 'stdout',
                        timestamp: Date.now(),
              })
              if (resolveNext) {
                resolveNext()
                resolveNext = null
              }
            }
                }
              },
              onStderr: (chunk: string) => {
                currentStderr += chunk
          // Split multi-line chunks properly
                const lines = currentStderr.split('\n')
                currentStderr = lines.pop() || ''
                for (const line of lines) {
            if (line) {
              logQueue.push({
                        data: `[stderr] ${line}`,
                        stream: 'stderr',
                        timestamp: Date.now(),
              })
              if (resolveNext) {
                resolveNext()
                resolveNext = null
              }
            }
                }
              },
            })

            // Send any existing output that was already accumulated
            const existingStdout = commandHandle.stdout || ''
            const existingStderr = commandHandle.stderr || ''

            if (existingStdout) {
              const stdoutLines = existingStdout.split('\n').filter((l) => l)
              for (const line of stdoutLines) {
          yield {
                      data: `[stdout] ${line}`,
            stream: 'stdout' as const,
                      timestamp: Date.now(),
          }
              }
            }

            if (existingStderr) {
              const stderrLines = existingStderr.split('\n').filter((l) => l)
              for (const line of stderrLines) {
          yield {
                      data: `[stderr] ${line}`,
            stream: 'stderr' as const,
                      timestamp: Date.now(),
          }
              }
            }

      // Wait for command to finish in background
      commandHandle.wait().catch(() => null).then(() => {
            // Send any remaining buffered output
            if (currentStdout) {
          logQueue.push({
                    data: `[stdout] ${currentStdout}`,
                    stream: 'stdout',
                    timestamp: Date.now(),
          })
            }
            if (currentStderr) {
          logQueue.push({
                    data: `[stderr] ${currentStderr}`,
                    stream: 'stderr',
                    timestamp: Date.now(),
          })
        }
        isFinished = true
        if (resolveNext) {
          resolveNext()
          resolveNext = null
        }
      })

      // Yield logs from queue as they arrive
      while (!isFinished || logQueue.length > 0) {
        if (logQueue.length > 0) {
          yield logQueue.shift()!
        } else {
          // Wait for next log or finish
          await new Promise<void>((resolve) => {
            resolveNext = resolve
          })
        }
      }
    }

    return new NextResponse(
      new ReadableStream({
        async start(controller) {
          try {
            // Use e2b async iterator to stream events
            for await (const log of streamCommandLogs()) {
              // Emit lines using the exact same SSE structure as old code
              controller.enqueue(
                encoder.encode(JSON.stringify(log) + '\n')
              )
            }

            // Close the SSE stream cleanly at the end
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      }),
      { headers: { 'Content-Type': 'application/x-ndjson' } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Command not found' },
      { status: 404 }
    )
  }
}
