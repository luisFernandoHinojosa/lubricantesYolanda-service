import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modulesPath = path.join(__dirname, '../modules');

const loadRoutes = async () => {
  try {
    const moduleDirs = await fs.readdir(modulesPath);

    for (const moduleDir of moduleDirs) {
      const modulePath = path.join(modulesPath, moduleDir);
      const stat = await fs.stat(modulePath);

      if (stat.isDirectory()) {
        const routesFile = path.join(modulePath, `${moduleDir}.routes.js`);
        try {
          await fs.access(routesFile);
          const moduleRoutes = await import(`./../modules/${moduleDir}/${moduleDir}.routes.js`);
          router.use(`/${moduleDir}`, moduleRoutes.default);
          console.log(`Loaded routes for module: ${moduleDir}`);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`Error loading routes for module ${moduleDir}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error reading modules directory:", error);
  }
};

await loadRoutes();

export default router;
