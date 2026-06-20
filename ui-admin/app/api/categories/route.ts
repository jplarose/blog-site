import { proxyApiRequest } from "@/lib/api-proxy";

export async function GET(request: Request) {
  return proxyApiRequest(request, "/api/categories");
}

export async function POST(request: Request) {
  return proxyApiRequest(request, "/api/categories");
}
