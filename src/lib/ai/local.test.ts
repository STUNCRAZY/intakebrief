import { describe, expect, it, vi } from 'vitest';
import { fallbackLocalEmailDraft, generateLocalEmailDraft } from './local';

const input = {
  inquiry: {
    message: 'My father has dementia and needs help managing his bills.',
  },
  fallbackTopic: 'guardianship',
};

describe('generateLocalEmailDraft', () => {
  it('uses the Ollama loopback endpoint and accepts only a complete structured draft', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              topic: 'guardianship for a parent',
              summary: 'your concern that your father needs help managing day-to-day decisions',
              preparation: ['A brief family overview', 'The county where he lives', 'Any existing powers of attorney'],
            }),
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const draft = await generateLocalEmailDraft(input, { AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen2.5:7b' }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(draft).toEqual(expect.objectContaining({ topic: 'guardianship for a parent', source: 'local-ai' }));
    expect(draft.preparation).toHaveLength(3);
  });

  it('falls back safely when the local model is unavailable or returns malformed data', async () => {
    const unavailable = await generateLocalEmailDraft(input, {}, vi.fn().mockRejectedValue(new Error('offline')));
    expect(unavailable).toEqual(fallbackLocalEmailDraft(input));

    const malformed = await generateLocalEmailDraft(
      input,
      {},
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: '{not json' } }), { status: 200 })),
    );
    expect(malformed.source).toBe('fallback');
  });

  it('does not call an external provider when configured for a different AI provider', async () => {
    const fetchImpl = vi.fn();
    const draft = await generateLocalEmailDraft(input, { AI_PROVIDER: 'disabled' }, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(draft.source).toBe('fallback');
  });

  it('removes a duplicated "further discuss" lead-in from otherwise valid model output', async () => {
    const draft = await generateLocalEmailDraft(
      input,
      {},
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: {
              content: JSON.stringify({
                topic: 'guardianship',
                summary: 'further discuss managing bills for a parent with dementia',
                preparation: ['A family overview', 'The county of residence'],
              }),
            },
          }),
          { status: 200 },
        ),
      ),
    );
    expect(draft.summary).toBe('managing bills for a parent with dementia');
  });
});
