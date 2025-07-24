import { app } from './server.mjs';
import logger from './logging.mjs';

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  logger.info(`Sharp API listening on http://localhost:${PORT}`);
});
