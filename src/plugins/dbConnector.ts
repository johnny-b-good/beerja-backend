import { FastifyPluginCallback } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyMongo from 'fastify-mongodb';

const dbConnector: FastifyPluginCallback = async (fastify) => {
    const { DB_HOST, DB_PORT, DB_NAME } = process.env;

    fastify.register(fastifyMongo, {
        url: `mongodb://${DB_HOST}:${DB_PORT}/${DB_NAME}`,
    });
};

export default fastifyPlugin(dbConnector);
