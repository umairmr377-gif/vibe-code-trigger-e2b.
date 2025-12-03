import { createGatewayProvider } from '@ai-sdk/gateway'
import { Models, SUPPORTED_MODELS } from './constants'
import type { JSONValue } from 'ai'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import type { LanguageModelV2 } from '@ai-sdk/provider'

export async function getAvailableModels() {
  try {
    const gateway = gatewayInstance()
    // Check if getAvailableModels method exists
    if (typeof gateway.getAvailableModels === 'function') {
      const response = await gateway.getAvailableModels()
      return response.models.map((model) => ({ id: model.id, name: model.name }))
    }
    // Fallback: return supported models from constants
    // The gateway provider might not have this method
    return SUPPORTED_MODELS.map((id) => ({
      id,
      name: id.split('/').pop() || id, // Use the model ID as name
    }))
  } catch (error) {
    console.error('Error in getAvailableModels:', error)
    // Fallback: return supported models from constants
    return SUPPORTED_MODELS.map((id) => ({
      id,
      name: id.split('/').pop() || id,
    }))
  }
}

export interface ModelOptions {
  model: LanguageModelV2
  providerOptions?: Record<string, Record<string, JSONValue>>
  headers?: Record<string, string>
}

export function getModelOptions(
  modelId: string,
  options?: { reasoningEffort?: 'minimal' | 'low' | 'medium' }
): ModelOptions {
  const gateway = gatewayInstance()
  if (modelId === Models.OpenAIGPT5) {
    return {
      model: gateway(modelId),
      providerOptions: {
        openai: {
          include: ['reasoning.encrypted_content'],
          reasoningEffort: options?.reasoningEffort ?? 'low',
          reasoningSummary: 'auto',
          serviceTier: 'priority',
        } satisfies OpenAIResponsesProviderOptions,
      },
    }
  }

  if (
    modelId === Models.AnthropicClaude4Sonnet ||
    modelId === Models.AnthropicClaude45Sonnet
  ) {
    return {
      model: gateway(modelId),
      headers: { 'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14' },
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
    }
  }

  return {
    model: gateway(modelId),
  }
}

function gatewayInstance() {
  return createGatewayProvider({
    baseURL: process.env.AI_GATEWAY_BASE_URL,
  })
}
