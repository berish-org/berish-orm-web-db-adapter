import { EventEmitter } from '@berish/emitter';
import LINQ from '@berish/linq';
import { BaseDBAdapter, IBaseDBItem, Query, QueryData, QueryDataSchema } from '@berish/orm';

import type { WebDBMethodParameters, WebDBMethodReturn } from './webDBReceiver';

export interface IWebDBAdapterParams {
  get: (...args: WebDBMethodParameters<'get'>) => WebDBMethodReturn<'get'>;
  create: (...args: WebDBMethodParameters<'create'>) => WebDBMethodReturn<'create'>;
  update: (...args: WebDBMethodParameters<'update'>) => WebDBMethodReturn<'update'>;
  delete: (...args: WebDBMethodParameters<'delete'>) => WebDBMethodReturn<'delete'>;
  count: (...args: WebDBMethodParameters<'count'>) => WebDBMethodReturn<'count'>;
  find: (...args: WebDBMethodParameters<'find'>) => WebDBMethodReturn<'find'>;
  index: (...args: WebDBMethodParameters<'index'>) => WebDBMethodReturn<'index'>;
  subscribe: (...args: WebDBMethodParameters<'subscribe'>) => WebDBMethodReturn<'subscribe'>;
}

export interface IWebDBAdapterConstructorParams {
  isConnected: () => boolean;
}

export class WebDBAdapter extends BaseDBAdapter<IWebDBAdapterParams> {
  private _emitter: EventEmitter<any> = new EventEmitter();
  private _constructorParams: IWebDBAdapterConstructorParams = null;

  // Здесь хранятся кникальные запросы к списку callback (по queryHash)
  private _uniqueQueries: QueryData<QueryDataSchema>[] = [];

  constructor(constructorParams: IWebDBAdapterConstructorParams) {
    super();

    if (!constructorParams) throw new TypeError('webDBAdapter constructorParams is null');
    this._constructorParams = constructorParams;
    this._uniqueQueries = [];
  }

  public initialize = async (params: IWebDBAdapterParams) => {
    this.params = params;
  };

  public close = async () => {
    this.params = null;
    this._emitter.offAll();
  };

  public count(query: QueryData<QueryDataSchema>): Promise<number> {
    if (!this.params.count) throw new TypeError('webDBAdapter params.count is null');
    return this.params.count(query);
  }

  public get = (query: QueryData<QueryDataSchema>) => {
    if (!this.params.get) throw new TypeError('webDBAdapter params.get is null');

    return this.params.get(query);
  };

  public create = (tableName: string, items: IBaseDBItem[]) => {
    if (!this.params.create) throw new TypeError('webDBAdapter params.create is null');

    return this.params.create(tableName, items);
  };

  public update = (tableName: string, items: IBaseDBItem[]) => {
    if (!this.params.update) throw new TypeError('webDBAdapter params.update is null');

    return this.params.update(tableName, items);
  };

  public delete = (query: QueryData<QueryDataSchema>) => {
    if (!this.params.delete) throw new TypeError('webDBAdapter params.delete is null');

    return this.params.delete(query);
  };

  public index = (tableName: string, indexName: string, keys?: string[]) => {
    if (!this.params.index) throw new TypeError('webDBAdapter params.index is null');

    return this.params.index(tableName, indexName, keys);
  };

  public find = (query: QueryData<QueryDataSchema>) => {
    if (!this.params.find) throw new TypeError('webDBAdapter params.find is null');

    return this.params.find(query);
  };

  public subscribe = async (
    data: QueryData<QueryDataSchema>,
    callback: (oldValue: IBaseDBItem, newValue: IBaseDBItem) => any,
  ) => {
    if (!this.params.subscribe) throw new TypeError('webDBAdapter params.subscribe is null');

    const queryHash: string = Query.getHash(data);

    if (!this._emitter.hasEvent(queryHash)) {
      await this._realSubscribe(data);
    }

    const eventHash = this._emitter.on(queryHash, ({ oldValue, newValue }) => callback(oldValue, newValue));
    return () => {
      this._emitter.off(eventHash);
    };
  };

  public connectSubscriptions = () => {
    // Здесь мы подключаем все реальные callback к текущим
    const eventNames = LINQ.from(this._emitter['_events'])
      .map((m) => m.eventName)
      .distinct((m) => m);

    for (const queryHash of eventNames) {
      const queryData = this._uniqueQueries.filter((m) => Query.getHash(m) === queryHash)[0];
      if (queryData) this._realSubscribe(queryData);
    }
  };

  private _realSubscribe = async (data: QueryData<QueryDataSchema>) => {
    const queryHash: string = Query.getHash(data);

    // Добавляем Query к списку уникальных
    if (this._uniqueQueries.filter((m) => Query.getHash(m) === queryHash).length <= 0) this._uniqueQueries.push(data);

    const unsubcribe = await this.params.subscribe(data, (oldValue, newValue) =>
      this._emitter.emitSync(queryHash, { oldValue, newValue }),
    );

    const triggerOffEventHash = this._emitter.triggerOffEvent(queryHash, () => {
      // Удаляем Query из списка уникальных
      this._uniqueQueries.filter((m) => Query.getHash(m) !== queryHash);

      if (this._constructorParams.isConnected()) unsubcribe();

      this._emitter.offTriggerOff(triggerOffEventHash);
    });
  };
}
