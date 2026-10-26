import { getAuth } from "@/lib/server/auth";
import { failure } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (e) {
    return failure(e);
  }
}
