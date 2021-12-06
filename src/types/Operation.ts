import { Operation as TinkoffOperation } from '@tinkoff/invest-openapi-js-sdk';

export type Operation = Omit<TinkoffOperation, 'date'> & {
    date: Date;
};
