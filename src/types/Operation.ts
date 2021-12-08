import { Operation as TinkoffOperation } from '@tinkoff/invest-openapi-js-sdk';
import { ObjectId } from 'mongodb';

export type Operation = Omit<TinkoffOperation, 'date'> & {
    date: Date;
    instrument?: ObjectId;
};
