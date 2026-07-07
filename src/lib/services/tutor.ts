import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageCode } from '@/lib/types';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 언어별 General 튜터 페르소나 (#129). en은 기존 문자열 그대로(회귀 없음).
const GENERAL_PERSONA_BY_LANGUAGE: Record<LanguageCode, string> = {
  en: 'You are a friendly, encouraging English tutor helping a student learn through a podcast. Answer questions clearly and concisely in Korean.',
  ja: 'You are a friendly, encouraging Japanese-language tutor (일본어 튜터) helping a student learn through audio content. Explain Japanese grammar points such as particles(조사) and conjugation(활용), vocabulary, and natural expressions. Answer clearly and concisely in Korean.',
};

// 언어별 화자 페르소나 프롬프트 (#129). en은 기존 문구 유지.
function speakerPersona(speakerId: string, language: LanguageCode): string {
  if (language === 'ja') {
    return `You are ${speakerId}, a speaker in this Japanese audio content. You are talking to a student learning Japanese through your content. Explain Japanese grammar(문법), particles(조사), and expressions when relevant, answering helpfully and concisely in Korean while maintaining your persona.`;
  }
  return `You are ${speakerId}, a host of this podcast. You are talking to a student learning English through your podcast. Answer their questions helpfully and concisely in Korean, maintaining your unique persona and perspective.`;
}

export async function getTutorResponse(
  speakerId: string,
  message: string,
  context?: { text: string; translation?: string },
  language: LanguageCode = 'en',
): Promise<ReadableStream> {
  let systemPrompt =
    speakerId === 'General'
      ? GENERAL_PERSONA_BY_LANGUAGE[language]
      : speakerPersona(speakerId, language);

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
