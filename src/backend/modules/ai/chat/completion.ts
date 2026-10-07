import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db/index.js';
import { conversations, messages } from '../../../db/schema/conversations.js';
import { providers } from '../../../db/schema/providers.js';
import { decrypt } from '../../../utils/crypto.js';
import { AiProviderError } from '../../../utils/errors.js';
import { createId } from '../../../utils/id.js';

const REQUEST_TIMEOUT_MS = 60_000;
const HISTORY_LIMIT = 40;

export interface CompletionResult {
  messageId: string;
  model: string;
  providerId: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { total_tokens?: number };
  model?: string;
}

export class NoProviderError extends Error {
  constructor() {
    super('No AI provider is configured. Add one in Settings → AI.');
    this.name = 'NoProviderError';
  }
}

async function resolveProvider() {
  const db = getDb();
  const provider =
    (await db.query.providers.findFirst({ where: eq(providers.isDefault, true) })) ??
    (await db.query.providers.findFirst());

  if (!provider) throw new NoProviderError();
  return provider;
}

/**
 * Asks the configured provider for a reply and stores it.
 *
 * Non-streaming on purpose: the existing chat API is plain REST, so a single
 * request keeps the client simple. The user's message is already persisted by
 * the time this runs, so a provider failure must surface as a thrown error the
 * caller can report without losing the message.
 */
export async function generateReply(
  conversationId: string,
  userMessageId: string
): Promise<CompletionResult> {
  const db = getDb();
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (!conversation) throw new AiProviderError('', 'Conversation not found', 404);

  const provider = await resolveProvider();
  if (!provider.chatModel) throw new AiProviderError(provider.id, 'Provider has no chat model set');

  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: asc(messages.createdAt),
    limit: HISTORY_LIMIT,
  });

  // Only user and assistant turns are replayed; tool and system rows in the
  // table are bookkeeping and would be rejected by the provider.
  const payload = history
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }));

  const apiKey = provider.apiKey ? decrypt(provider.apiKey) : undefined;

  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
        ...provider.customHeaders,
      },
      body: JSON.stringify({
        model: provider.chatModel,
        messages: [{ role: 'system', content: 'You are a helpful assistant.' }, ...payload],
        stream: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProviderError(
      provider.id,
      error instanceof Error ? error.message : 'Provider request failed',
      502
    );
  }

  if (!response.ok) {
    throw new AiProviderError(provider.id, `Provider returned HTTP ${response.status}`, 502);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AiProviderError(provider.id, 'Provider returned an empty reply', 502);

  const messageId = createId();
  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'assistant',
    content,
    model: data.model ?? provider.chatModel,
    providerId: provider.id,
    tokenCount: data.usage?.total_tokens ?? null,
  });

  // The caller's own insert already counted the user's message; this is the
  // second turn of the same exchange.
  await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + 1` })
    .where(eq(conversations.id, conversationId));

  return { messageId, model: provider.chatModel, providerId: provider.id };
}
