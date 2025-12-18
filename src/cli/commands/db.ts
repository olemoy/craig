import { getClient } from "../../db/client.js";

export async function dbCommand(args: string[]) {
  const action = args[0];
  if (!action) {
    console.error("Usage: bun cli db status|vacuum|export|import");
    return;
  }
  const client = await getClient();
  if (action === "status") {
    console.log("DB connected. (stub)");
    await client.close?.();
    return;
  }
  console.log("DB action", action, "is a stub");
  await client.close?.();
}
