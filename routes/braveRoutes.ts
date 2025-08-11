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
  const { userId, args } = req.body as {
    userId: string;
    args?: Record<string, unknown>;
  };

  try {
    if (!userId) {
      return res.status(400).json({ error: "Missing required field: userId" });
    }

    console.log(`[Brave] Search request for userId: ${userId}, args:`, args);

    const result = await callBraveMCP(userId, "brave_web_search", args ?? {});
    console.log(`[Brave] Search completed successfully for userId: ${userId}`);
    res.json(result);
  } catch (err: any) {
    const errorMessage = err.message || "Unknown error occurred";
    const errorStack = err.stack || "";

    console.error(`[Brave] Search failed for userId: ${userId}`, {
      error: errorMessage,
      stack: errorStack,
      args,
    });

    res.status(500).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === "development" && { stack: errorStack }),
      userId,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
