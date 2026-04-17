import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        messages: true,
        document: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(chats);
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
