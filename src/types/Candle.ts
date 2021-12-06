import { Candle as TinkoffCandle } from '@tinkoff/invest-openapi-js-sdk';

export type Candle = Omit<TinkoffCandle, 'time'> & {
    time: Date;
};
