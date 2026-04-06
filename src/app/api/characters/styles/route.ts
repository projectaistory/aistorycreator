import { getCharacterStylesForApi } from "@/lib/characterStyles";

/** Public catalog — standalone-character-creator-porting-guide.md §3.1 */
export async function GET() {
  const styles = getCharacterStylesForApi();
  return Response.json({ styles });
}
