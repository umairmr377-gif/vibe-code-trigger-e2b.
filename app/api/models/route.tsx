import { SUPPORTED_MODELS } from '@/ai/constants'
import { getAvailableModels } from '@/ai/gateway'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const allModels = await getAvailableModels()
    const filteredModels = allModels.filter((model) =>
      SUPPORTED_MODELS.includes(model.id)
    )
    
    // If no models found, return supported models as fallback
    if (filteredModels.length === 0) {
      return NextResponse.json({
        models: SUPPORTED_MODELS.map((id) => ({
          id,
          name: id.split('/').pop() || id,
        })),
      })
    }
    
    return NextResponse.json({
      models: filteredModels,
    })
  } catch (error) {
    console.error('Error fetching available models:', error)
    // Return supported models as fallback instead of error
    return NextResponse.json({
      models: SUPPORTED_MODELS.map((id) => ({
        id,
        name: id.split('/').pop() || id,
      })),
    })
  }
}
