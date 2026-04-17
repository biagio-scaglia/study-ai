import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Fetch all chats
    const chats = await db.all('SELECT * FROM chats ORDER BY createdAt DESC');
    
    // For each chat, fetch its messages
    const chatsWithMessages = await Promise.all(chats.map(async (chat: any) => {
      const messages = await db.all('SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC', [chat.id]);
      return {
        ...chat,
        messages
      };
    }));

    return NextResponse.json(chatsWithMessages);
  } catch (error: any) {
    console.error('Error fetching chats from DuckDB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
