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
  const cmdParams = await params
  const sandbox = await Sandbox.connect(cmdParams.sandboxId, {
    apiKey: process.env.E2B_API_KEY,
  })

  const pid = parseInt(cmdParams.cmdId, 10)
  if (isNaN(pid)) {
    return NextResponse.json(
      { error: 'Invalid command ID' },
      { status: 400 }
    )
  }

  try {
    const command = await sandbox.commands.connect(pid)
    const result = await command.wait().catch(() => null)

    return NextResponse.json({
      sandboxId: sandbox.sandboxId,
      cmdId: cmdParams.cmdId,
      startedAt: Date.now(),
      exitCode: result?.exitCode,
    })
  } catch (error) {
    // Command might not exist or sandbox stopped
    return NextResponse.json({
      sandboxId: sandbox.sandboxId,
      cmdId: cmdParams.cmdId,
      startedAt: Date.now(),
      exitCode: undefined,
    })
  }
}
