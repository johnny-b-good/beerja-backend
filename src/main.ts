import dotenv from 'dotenv';
import Fastify from 'fastify';

import { instruments, operations, candles } from './views';
import { dbConnector } from './plugins';

dotenv.config();

const fastify = Fastify({
    logger: true,
});

fastify.register(dbConnector);
fastify.register(instruments);
fastify.register(operations);
fastify.register(candles);

fastify.listen(3000, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    } else {
        console.log(`Server is now listening on ${address}`);
    }
});
