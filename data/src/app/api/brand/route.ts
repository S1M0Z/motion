import { z } from 'zod';
import { analyzeBrand } from '@/lib/server/brand';
import { assertLocal, errorResponse, jsonBody } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { assertLocal(request); const { url } = z.object({ url: z.string().min(3).max(2048) }).parse(await jsonBody(request)); return Response.json(await analyzeBrand(url)); }
  catch (error) { return errorResponse(error); }
}
