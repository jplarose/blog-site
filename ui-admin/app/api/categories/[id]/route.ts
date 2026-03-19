import { proxyApiRequest } from "@/lib/api-proxy";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyApiRequest(request, `/api/categories/${id}`);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyApiRequest(request, `/api/categories/${id}`);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyApiRequest(request, `/api/categories/${id}`);
}
