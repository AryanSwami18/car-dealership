import { app } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});
