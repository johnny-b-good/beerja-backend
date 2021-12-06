import { FastifyPluginCallback } from 'fastify';

import { MarketInstrument as Instrument } from '@tinkoff/invest-openapi-js-sdk';

export const instruments: FastifyPluginCallback = async (fastify) => {
    const instrumentsCollection =
        fastify.mongo.db.collection<Instrument>('instruments');

    fastify.get('/instruments', async () => {
        const instruments = await instrumentsCollection.find().toArray();
        return { instruments };
    });
};
