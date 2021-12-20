import { FastifyPluginCallback } from 'fastify';
import { Document } from 'mongodb';

import { MarketInstrument as Instrument } from '@tinkoff/invest-openapi-js-sdk';

export const instruments: FastifyPluginCallback = async (fastify) => {
    const instrumentsCollection =
        fastify.mongo.db.collection<Instrument>('instruments');

    fastify.get('/instruments', async () => {
        const instruments = await instrumentsCollection.find().toArray();
        return { instruments };
    });

    fastify.get('/instruments/portfolio', async () => {
        // Sums of operation payments grouped by type
        const paymentsByType: Document = [
            {
                $group: {
                    _id: '$operationType',
                    totalPayment: { $sum: '$payment' },
                },
            },
            {
                $project: { _id: 0, k: '$_id', v: '$totalPayment' },
            },
        ];

        // Total traded quantities and payments
        const trades: Document = [
            {
                $match: {
                    $expr: {
                        $gt: ['$quantityExecuted', 0],
                    },
                },
            },
            {
                $addFields: {
                    signedQuantityExecuted: {
                        $cond: {
                            if: { $gt: ['$payment', 0] },
                            then: '$quantityExecuted',
                            else: { $multiply: ['$quantityExecuted', -1] },
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$figi',
                    totalQuantity: { $sum: '$signedQuantityExecuted' },
                    totalPayment: { $sum: '$payment' },
                },
            },
            { $project: { _id: 0 } },
        ];

        // trades of buying operations with average price
        const purchases: Document = [
            {
                $match: {
                    $expr: {
                        $in: ['$operationType', ['Buy', 'BuyCard']],
                    },
                },
            },
            {
                $group: {
                    _id: '$figi',
                    quantity: { $sum: '$quantityExecuted' },
                    payment: { $sum: '$payment' },
                },
            },
            {
                $addFields: {
                    avgPriceSimple: {
                        $abs: { $divide: ['$payment', '$quantity'] },
                    },
                },
            },
            { $project: { _id: 0 } },
        ];

        // Pass-through for facet stage
        const allOperations: Document = [{ $match: {} }];

        const instruments = await instrumentsCollection
            .aggregate([
                {
                    $lookup: {
                        from: 'operations',
                        as: 'operations',
                        let: {
                            id: '$_id',
                            figi: '$figi',
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ['$instrument', '$$id'],
                                            },
                                            {
                                                $eq: ['$status', 'Done'],
                                            },
                                        ],
                                    },
                                },
                            },
                            {
                                $facet: {
                                    paymentsByType,
                                    trades,
                                    purchases,
                                    allOperations,
                                },
                            },
                            { $unwind: '$trades' },
                            { $unwind: '$purchases' },
                            {
                                $project: {
                                    paymentsByType: {
                                        $arrayToObject: '$paymentsByType',
                                    },
                                    trades: 1,
                                    purchases: 1,
                                    allOperations: 1,
                                },
                            },
                        ],
                    },
                },
                { $unwind: '$operations' },
                {
                    $project: {
                        name: 1,
                        ticker: 1,
                        figi: 1,
                        currency: 1,
                        type: 1,
                        paymentsByType: '$operations.paymentsByType',
                        totalQuantity: '$operations.trades.totalQuantity',
                        totalPayment: '$operations.trades.totalPayment',
                        purchases: '$operations.purchases',
                        operations: '$operations.allOperations',
                    },
                },
                { $match: { $expr: { $ne: ['$totalQuantity', 0] } } },
                { $sort: { currency: 1, type: 1, ticker: 1 } },
            ])
            .toArray();
        return { instruments };
    });
};
