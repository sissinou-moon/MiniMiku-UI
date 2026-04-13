import { NextResponse } from 'next/server';
import { open_app, browser_action, app_action, channel_youtube_videos } from '@/tools';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tool, args, current_step, previous_step_result } = body;

    console.log(args)

    let result;
    if (tool === 'open_app') {
      result = await open_app(args);
    } else if (tool === 'browser_action') {
      result = await browser_action(args, previous_step_result);
    } else if (tool === 'app_action') {
      result = await app_action(args);
    } else if (tool === 'channel_youtube_videos') {
      result = await channel_youtube_videos(args);
    } else {
      // Return success: false so execution halts on unknown tool
      throw new Error(`Execution stopped: Unknown tool '${tool}'.`);
    }

    if (!result.success) {
      throw new Error(result.result);
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      next_step: current_step + 1
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
