import { FastifyPluginCallback } from 'fastify';

import { Operation } from '../types';

export const operations: FastifyPluginCallback = async (fastify) => {
    const operationsCollection =
        fastify.mongo.db.collection<Operation>('operations');

    fastify.get('/operations', async () => {
        const operations = await operationsCollection.find().toArray();
        return { operations };
    });
};
