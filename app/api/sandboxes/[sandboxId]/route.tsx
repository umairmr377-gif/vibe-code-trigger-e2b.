import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from 'e2b'

/**
 * We must change the SDK to add data to the instance and then
 * use it to retrieve the status of the Sandbox.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params
  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    })
    const isRunning = await sandbox.isRunning()
    if (isRunning) {
      return NextResponse.json({ status: 'running' })
    } else {
      return NextResponse.json({ status: 'stopped' })
    }
  } catch {
    return NextResponse.json({ status: 'stopped' })
  }
}
