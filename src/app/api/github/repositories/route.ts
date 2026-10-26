import { currentUser } from "@/lib/server/auth";
import { repositories } from "@/lib/github/access";
import { failure, json } from "@/lib/server/http";
export async function GET() {
  try {
    return json(await repositories((await currentUser()).id));
  } catch (e) {
    return failure(e);
  }
}
