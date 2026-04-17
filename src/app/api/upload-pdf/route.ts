import { NextResponse } from 'next/server';
import { convert } from '@opendataloader/pdf';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const sessionId = uuidv4();
    const tempDir = path.join(process.cwd(), 'tmp', sessionId);
    await fs.mkdir(tempDir, { recursive: true });

    const inputPath = path.join(tempDir, file.name);
    const outputDir = path.join(tempDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(inputPath, buffer);

    // Convert PDF to Markdown using opendataloader-pdf
    await convert([inputPath], {
      outputDir: outputDir,
      format: 'markdown'
    });

    const files = await fs.readdir(outputDir);
    const mdFile = files.find(f => f.endsWith('.md'));
    let markdown = '';
    
    if (mdFile) {
      markdown = await fs.readFile(path.join(outputDir, mdFile), 'utf-8');
    } else {
      throw new Error('Could not find extracted markdown file');
    }

    // Persist Document in DuckDB
    const documentId = uuidv4();
    await db.run(
      'INSERT INTO documents (id, fileName, content) VALUES (?, ?, ?)',
      [documentId, file.name, markdown]
    );

    // Cleanup temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({ 
      success: true, 
      markdown: markdown,
      fileName: file.name,
      documentId: documentId
    });

  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ 
      error: `Failed to extract PDF: ${error.message}. Assicurati che Java sia installato e nel PATH.` 
    }, { status: 500 });
  }
}
