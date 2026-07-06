import { NextResponse } from 'next/server';
import { getTutorResponse } from '@/lib/services/tutor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { speakerId, message, context } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
    }

    // 현재는 General 튜터만 API로 지원한다(페르소나 탭은 후속). 그 외는 400.
    if (speakerId !== 'General') {
      return NextResponse.json({ error: 'Invalid speakerId' }, { status: 400 });
    }

    if (
      context !== undefined &&
      (typeof context !== 'object' ||
        context === null ||
        Array.isArray(context))
    ) {
      return NextResponse.json(
        { error: 'Invalid context format' },
        { status: 400 },
      );
    }

    const stream = await getTutorResponse(speakerId, message, context);

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
