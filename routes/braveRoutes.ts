import { Router, Request, Response } from "express";
import { getUserTokens } from "../utils/supabaseClient";
import { callMCPTool } from "../utils/mcpClient";

const router = Router();

// Brave Search requirements
const braveRequirements = {
  required: ["api_key"],
  envMap: {
    api_key: "BRAVE_API_KEY",
  },
} as const;

async function callBraveMCP(
  userId: string,
  toolName: string,
  args: Record<string, unknown>
) {
  const { env } = await getUserTokens(userId, "brave", braveRequirements);

  return callMCPTool(
    "@modelcontextprotocol/server-brave-search",
    toolName,
    args ?? {},
    { env }
  );
}

// POST /brave/search
router.post("/search", async (req: Request, res: Response) => {
  try {
    const { userId, args } = req.body as {
      userId: string;
      args?: Record<string, unknown>;
    };

    if (!userId) {
      return res.status(400).json({ error: "Missing required field: userId" });
    }

    const result = await callBraveMCP(userId, "brave_web_search", args ?? {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
