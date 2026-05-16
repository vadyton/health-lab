import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json } from "express";
import * as express from "express";
import * as path from "path";
import * as fs from "fs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "50mb" }));
  app.enableCors();

  const frontendDist = path.resolve(process.cwd(), "../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    // Serve static assets (JS, CSS, images, etc.)
    app.use(express.static(frontendDist));

    // SPA fallback: serve index.html for non-API routes
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
