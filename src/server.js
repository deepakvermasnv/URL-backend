import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

if (env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        port: env.PORT,
        environment: env.NODE_ENV,
      }),
    );
  });
}

export default app;
