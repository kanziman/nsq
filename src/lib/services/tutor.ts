import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const GENERAL_PERSONA = "You are a friendly, encouraging English tutor helping a student learn through a podcast. Answer questions clearly and concisely in Korean.";

export async function getTutorResponse(
  speakerId: string, 
  message: string,
  context?: { text: string; translation?: string; }
): Promise<ReadableStream> {
  let systemPrompt = speakerId === 'General' 
    ? GENERAL_PERSONA 
    : `You are ${speakerId}, a host of this podcast. You are talking to a student learning English through your podcast. Answer their questions helpfully and concisely in Korean, maintaining your unique persona and perspective.`;
  
  if (context && context.text) {
    systemPrompt += `\n\nCurrent sentence context:\nText: ${context.text}`;
    if (context.translation) {
      systemPrompt += `\nTranslation: ${context.translation}`;
    }
  }

  const result = await streamText({
    model: openrouter(process.env.TUTOR_MODEL || 'anthropic/claude-haiku-4-5'),
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  });

  return result.textStream;
}
