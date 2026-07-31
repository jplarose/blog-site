import { proxyApiRequest } from "@/lib/api-proxy";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyApiRequest(request, `/api/posts/${id}/archive`);
}
