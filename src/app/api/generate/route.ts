import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
      model: 'gpt-3.5-turbo', 
      messages: [systemPrompt, ...messages],
      stream: true,
    };

    let response;
    let provider = 'llama.cpp (Port 8080)';

    try {
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
    } catch (e) {
      // Fallback to Ollama
      provider = 'Ollama (Llama3)';
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

    // Capture user message in DuckDB if chatId exists
    if (chatId) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        const msgId = uuidv4();
        await db.run(
          'INSERT INTO messages (id, role, content, chatId) VALUES (?, ?, ?, ?)',
          [msgId, 'user', lastUserMessage.content, chatId]
        );
      }
    } else if (topic) {
        // Create new chat in DuckDB
        const newChatId = uuidv4();
        await db.run(
          'INSERT INTO chats (id, title, contextText) VALUES (?, ?, ?)',
          [newChatId, topic, context || null]
        );
        
        // Insert initial messages
        for (const msg of messages) {
          const mId = uuidv4();
          await db.run(
            'INSERT INTO messages (id, role, content, chatId) VALUES (?, ?, ?, ?)',
            [mId, msg.role, msg.content, newChatId]
          );
        }
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'X-LLM-Provider': provider
      },
    });

  } catch (error: any) {
    console.error('Error generating notes with DuckDB:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
