import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { chatId } = await req.json();
    if (!chatId) return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });

    // Delete chat and its messages (DuckDB cascading manual delete since we don't have constraints set up)
    await db.run('DELETE FROM messages WHERE chatId = ?', [chatId]);
    await db.run('DELETE FROM chats WHERE id = ?', [chatId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting chat from DuckDB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
