import { FastifyPluginCallback } from 'fastify';

import { Candle } from '../types';

export const candles: FastifyPluginCallback = async (fastify) => {
    const candlesCollection = fastify.mongo.db.collection<Candle>('candles');

    fastify.get('/candles', async () => {
        const candles = await candlesCollection.find().toArray();
        return { candles };
    });
};
