import { z } from 'genkit';

export const ChatHistorySchema = z.array(
  z.object({
    role: z.enum(['user', 'model']),
    content: z.array(z.object({ text: z.string() })),
  })
);
export type ChatHistory = z.infer<typeof ChatHistorySchema>;

export const ChatRequestSchema = z.object({
  history: ChatHistorySchema,
  prompt: z.string(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
