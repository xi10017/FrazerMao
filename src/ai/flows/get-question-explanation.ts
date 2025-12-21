'use server';
/**
 * @fileOverview Provides an AI-powered explanation for a given test question.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GetQuestionExplanationInputSchema = z.object({
  questionNumber: z
    .number()
    .describe('The number of the question the user needs help with.'),
  testName: z
    .string()
    .describe('The name of the test the question is from.'),
});

export type GetQuestionExplanationInput = z.infer<
  typeof GetQuestionExplanationInputSchema
>;

export const GetQuestionExplanationOutputSchema = z.object({
  explanation: z.string().describe('The AI-generated explanation.'),
});

export type GetQuestionExplanationOutput = z.infer<
  typeof GetQuestionExplanationOutputSchema
>;

const explanationPrompt = ai.definePrompt({
  name: 'explanationPrompt',
  input: { schema: GetQuestionExplanationInputSchema },
  output: { schema: GetQuestionExplanationOutputSchema },
  prompt: `You are an expert math tutor. A student is working on a math competition test and needs help with a question.

IMPORTANT: You do not have the text of the question. The application can only provide the test name and the question number.

Your task is to provide a helpful, generic response that acknowledges this limitation and guides the user.

- Acknowledge the user's request for help on the specific question number.
- State clearly that you cannot see the question's content.
- Provide a template of strategies the student can use to solve math problems, such as:
  1.  Read the question carefully to understand what is being asked.
  2.  Identify the key information and numbers given.
  3.  Look for patterns or relationships.
  4.  Try to eliminate incorrect answer choices.
  5.  Draw a diagram or picture if it helps visualize the problem.
- Wish them good luck.

Do not ask the user to provide the question text. Your response should be a single, helpful message.

Test Name: {{{testName}}}
Question Number: {{{questionNumber}}}
`,
});

const getQuestionExplanationFlow = ai.defineFlow(
  {
    name: 'getQuestionExplanationFlow',
    inputSchema: GetQuestionExplanationInputSchema,
    outputSchema: GetQuestionExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await explanationPrompt(input);
    return output!;
  }
);

export async function getQuestionExplanation(
  input: GetQuestionExplanationInput
): Promise<GetQuestionExplanationOutput> {
  return getQuestionExplanationFlow(input);
}
