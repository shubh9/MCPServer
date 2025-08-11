import express from "express";
import dotenv from "dotenv";
import gmailRoutes from "./routes/gmailRoutes";
import braveRoutes from "./routes/braveRoutes";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/gmail", gmailRoutes);
app.use("/brave", braveRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
