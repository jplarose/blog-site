import { proxyApiRequest } from "@/lib/api-proxy";

export async function GET(request: Request) {
  return proxyApiRequest(request, "/api/layouttemplates");
}

export async function POST(request: Request) {
  return proxyApiRequest(request, "/api/layouttemplates");
}
