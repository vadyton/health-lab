import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load root .env (one level up), then local .env as override
config({ path: path.resolve(__dirname, "../.env") });
config({ path: path.resolve(__dirname, ".env"), override: false });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  datasource: { url: DB_URL },
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const { default: pg } = await import("pg");
      return new PrismaPg(new pg.Pool({ connectionString: DB_URL }));
    },
  },
});
