import { NextResponse, type NextRequest } from 'next/server'
import { Sandbox } from 'e2b'
import z from 'zod/v3'

const FileParamsSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params
  const fileParams = FileParamsSchema.safeParse({
    path: request.nextUrl.searchParams.get('path'),
    sandboxId,
  })

  if (fileParams.success === false) {
    return NextResponse.json(
      { error: 'Invalid parameters. You must pass a `path` as query' },
      { status: 400 }
    )
  }

  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    })
    const stream = await sandbox.files.read(fileParams.data.path, {
      format: 'stream',
    })

    return new NextResponse(
      new ReadableStream({
        async pull(controller) {
          const reader = stream.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }
            controller.close()
          } catch (error) {
            controller.error(error)
          } finally {
            reader.releaseLock()
          }
        },
      })
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'File not found in the Sandbox' },
      { status: 404 }
    )
  }
}
