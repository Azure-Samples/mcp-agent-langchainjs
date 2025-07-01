import path from "node:path";
import dotenv from "dotenv";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Env file is located in the root of the repository
dotenv.config({ path: path.join(__dirname, "../../../.env") });

export const pizzaApiUrl = process.env.PIZZA_API_URL || "http://localhost:7071";
