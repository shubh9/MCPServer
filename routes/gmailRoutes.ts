import { Router, Request, Response } from "express";
import { getUserTokens } from "../utils/supabaseClient";
import { callMCPTool } from "../utils/mcpClient";

const router = Router();

// Gmail/Google requirements defined at the router level
const gmailRequirements = {
  // Minimal requirement: allow direct ACCESS_TOKEN usage if present
  required: ["refresh_token", "client_id", "client_secret"],
  // Map token fields to env names expected by the MCP
  envMap: {
    refresh_token: "GOOGLE_REFRESH_TOKEN",
    client_id: "GOOGLE_CLIENT_ID",
    client_secret: "GOOGLE_CLIENT_SECRET",
  },
} as const;

// Helper: resolve user token and call the Gmail MCP with shared client
async function callGmailMCP(
  userId: string,
  toolName: string,
  args: Record<string, any>
) {
  const { tokens, env } = await getUserTokens(
    userId,
    "gmail",
    gmailRequirements
  );

  return callMCPTool(
    "@gongrzhe/server-gmail-autoauth-mcp",
    toolName,
    args ?? {},
    { accessToken: String(tokens["access_token"] || ""), env }
  );
}

// POST /gmail/read
router.post("/read", async (req: Request, res: Response) => {
  try {
    const { userId, args } = req.body as {
      userId: string;
      args?: Record<string, any>;
    };
    const result = await callGmailMCP(userId, "readEmails", args ?? {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /gmail/send
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { userId, args } = req.body as {
      userId: string;
      args?: Record<string, any>;
    };
    const result = await callGmailMCP(userId, "sendEmail", args ?? {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
