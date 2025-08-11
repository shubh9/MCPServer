import fetch from "node-fetch";

async function main() {
  const baseUrl = "https://mcp-server-eosin.vercel.app";
  console.log("baseUrl: ", baseUrl);
  const url = `${baseUrl}/brave/search`;

  const userId = process.env.TEST_USER_ID || "local-user";

  const body = {
    userId,
    args: {
      query: "weather San Francisco August 10 2025",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Request failed: ${response.status} ${response.statusText}`);
    console.error(text);
    process.exit(1);
  }

  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
