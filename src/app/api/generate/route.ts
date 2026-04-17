import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, context, chatId, topic } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid messages array' }, { status: 400 });
    }

    let systemContent = 'Sei un assistente allo studio esperto, chiaro e conciso. Il tuo obiettivo è generare appunti strutturati e rispondere a domande di chiarimento dell\'utente sempre mantenendo un focus didattico. Usa la sintassi Markdown. Rispondi SEMPRE ed ESCLUSIVAMENTE in lingua Italiana.';

    if (context) {
      systemContent += `\n\nCONTESTO AGGIUNTIVO (Basato su documenti importati):\n${context}\n\nUsa le informazioni sopra riportate per arricchire le tue risposte e gli appunti. Se l'utente fa domande relative a questo contesto, rispondi con precisione basandoti SOLO su quanto fornito se possibile.`;
    }

    const systemPrompt = {
      role: 'system',
      content: systemContent
    };

    // Try llama.cpp first (port 8080) then fallback to Ollama (11434)
    let baseUrl = 'http://localhost:8080/v1/chat/completions';
    let payload: any = {
      model: 'gpt-3.5-turbo', // llama.cpp ignores this mostly
      messages: [systemPrompt, ...messages],
      stream: true,
    };

    let response;
    let isLlamaCpp = true;

    try {
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
    } catch (e) {
      // Fallback to Ollama
      isLlamaCpp = false;
      baseUrl = 'http://localhost:11434/api/chat';
      payload = {
        model: 'llama3',
        messages: [systemPrompt, ...messages],
        stream: true,
      };
      
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      throw new Error(`LLM Error: ${response.statusText}`);
    }

    // Capture user message in DB if chatId exists
    if (chatId) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        await prisma.message.create({
          data: {
            role: 'user',
            content: lastUserMessage.content,
            chatId: chatId,
          }
        });
      }
    } else if (topic) {
        // Create new chat if topic provided
        const newChat = await prisma.chat.create({
            data: {
                title: topic,
                contextText: context,
                messages: {
                    create: messages.map(m => ({ role: m.role, content: m.content }))
                }
            }
        });
        // We might want to return the new chatId too, but for simplicity in streaming, we just continue
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });

  } catch (error: any) {
    console.error('Error generating notes:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
