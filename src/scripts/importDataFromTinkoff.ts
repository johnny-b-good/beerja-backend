import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import OpenAPI, {
    Operation as TinkoffOperation,
    MarketInstrument,
    Candle as TinkoffCandle,
    CandleResolution,
} from '@tinkoff/invest-openapi-js-sdk';

import { Candle, Operation } from '../types';
import { sleep } from '../utils';

dotenv.config();
const { DB_HOST, DB_PORT, DB_NAME, TINKOFF_TOKEN } = process.env;

const mongoUri = `mongodb://${DB_HOST}:${DB_PORT}`;
const client = new MongoClient(mongoUri);

const apiURL = 'https://api-invest.tinkoff.ru/openapi';
const socketURL = 'wss://api-invest.tinkoff.ru/openapi/md/v1/md-openapi/ws';
const secretToken = TINKOFF_TOKEN;
const api = new OpenAPI({ apiURL, secretToken, socketURL });

const STARTING_YEAR = 2012;
const TARGET_INTERVALS: Array<CandleResolution> = ['day', 'week', 'month'];
const API_REQUEST_DELAY = 1000;

async function main() {
    // Connect to to MongoDB
    await client.connect();

    const db = client.db(DB_NAME);

    const operationsCollection = db.collection<Operation>('operations');
    await operationsCollection.createIndex({
        id: 1,
        operationType: 1,
        status: 1,
        figi: 1,
        instrumentType: 1,
        date: 1,
    });
    const operations = await getOperations();
    await operationsCollection.insertMany(operations);

    const instrumentsCollection =
        db.collection<MarketInstrument>('instruments');
    await instrumentsCollection.createIndex({
        type: 1,
        figi: 1,
        ticker: 1,
        name: 1,
    });
    const instruments = await getInstruments(operations);
    const { insertedIds: instrumentIds } =
        await instrumentsCollection.insertMany(instruments);

    const candlesCollection = db.collection<Candle>('candles');
    await candlesCollection.createIndex({
        figi: 1,
        interval: 1,
        time: 1,
    });
    const candles = await getCandles(instruments);
    await candlesCollection.insertMany(candles);

    let instrumentIndex = 0;
    for (const instrument of instruments) {
        const { figi } = instrument;
        const instrumentId: ObjectId = instrumentIds[instrumentIndex];
        await candlesCollection.updateMany(
            { figi },
            { $set: { instrument: instrumentId } }
        );
        await operationsCollection.updateMany(
            { figi },
            { $set: { instrument: instrumentId } }
        );
        instrumentIndex++;
    }

    return 'Done!';
}

async function getOperations(): Promise<Array<Operation>> {
    const { operations }: { operations: Array<TinkoffOperation> } =
        await api.operations({
            from: `${STARTING_YEAR}-01-01T00:00:00Z`,
            to: new Date().toISOString(),
        });

    return operations.map((op) => ({
        ...op,
        date: new Date(Date.parse(op.date)),
    }));
}

async function getInstruments(
    operations: Array<Operation>
): Promise<Array<MarketInstrument>> {
    const instrumentsTable: { [figi: string]: MarketInstrument } = {};

    for (const operation of operations) {
        const { figi } = operation;

        if (figi) {
            if (!(figi in instrumentsTable)) {
                const instrument: MarketInstrument = await api.searchOne({
                    figi,
                });

                if (instrument) {
                    instrumentsTable[figi] = instrument;
                } else {
                    throw new Error(`Unknown instrument with FIGI ${figi}`);
                }

                console.log('Instrument', instrument.ticker, instrument.name);

                await sleep(API_REQUEST_DELAY);
            }
        }
    }

    const instruments: Array<MarketInstrument> =
        Object.values(instrumentsTable);

    return instruments;
}

async function getCandles(
    instruments: Array<MarketInstrument>
): Promise<Array<Candle>> {
    let allCandles: Array<Candle> = [];

    const targetDates: Array<{ from: string; to: string }> = [];
    const currentYear = new Date().getFullYear();
    for (let year = STARTING_YEAR; year < currentYear; year++) {
        targetDates.push({
            from: `${year}-01-01T00:00:00Z`,
            to: `${year}-12-31T23:59:59Z`,
        });
    }

    for (const instrument of instruments) {
        const { figi } = instrument;
        for (const interval of TARGET_INTERVALS) {
            for (const { from, to } of targetDates) {
                const { candles }: { candles: Array<TinkoffCandle> } =
                    await api.candlesGet({
                        from,
                        to,
                        figi,
                        interval,
                    });

                if (Array.isArray(candles)) {
                    allCandles = allCandles.concat(
                        candles.map((c) => ({
                            ...c,
                            time: new Date(Date.parse(c.time)),
                            instrument: null,
                        }))
                    );
                }

                await sleep(API_REQUEST_DELAY);
            }
        }
        console.log('Candles', instrument.ticker, instrument.name);
    }

    return allCandles;
}

main().then(
    (result) => {
        console.log(result);
        process.exit(0);
    },
    (err) => {
        console.error(err);
        process.exit(1);
    }
);
