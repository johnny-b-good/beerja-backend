import { Candle as TinkoffCandle } from '@tinkoff/invest-openapi-js-sdk';
import { ObjectId } from 'mongodb';

export type Candle = Omit<TinkoffCandle, 'time'> & {
    time: Date;
    instrument: ObjectId;
};
