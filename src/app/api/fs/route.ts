import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define workspace root assuming project root
// Alternatively we can use process.cwd() or just a 'Workspace' folder
const WORKSPACE_DIR = process.cwd();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, filePath, content } = body;

    if (!filePath) {
      return NextResponse.json({ success: false, error: 'filePath is required' }, { status: 400 });
    }

    // Ensure path is within workspace to prevent directory traversal
    const absolutePath = path.resolve(WORKSPACE_DIR, filePath);
    if (!absolutePath.startsWith(WORKSPACE_DIR)) {
      return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 403 });
    }

    if (action === 'save') {
      if (content === undefined) {
        return NextResponse.json({ success: false, error: 'content is required for save' }, { status: 400 });
      }

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf8');
      
      return NextResponse.json({ success: true, message: 'File saved successfully' });
      
    } else if (action === 'read') {
      try {
        const fileContent = await fs.readFile(absolutePath, 'utf8');
        return NextResponse.json({ success: true, content: fileContent });
      } catch (err: any) {
        if (err.code === 'ENOENT') {
           return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
        }
        throw err;
      }
    } else {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
