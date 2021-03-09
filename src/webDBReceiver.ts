import { CacheEmitter } from '@berish/emitter';
import { IBaseDBItem, Manager, Query } from '@berish/orm';
import { IWebDBAdapterParams } from './webDBAdapter';

export type WebDBMethodParameters<N extends keyof Manager['db']> = Parameters<Manager['db'][N]>;
export type WebDBMethodReturn<N extends keyof Manager['db']> = ReturnType<Manager['db'][N]>;

interface SubscriptionEventMap {
  [queryHash: string]: { oldValue: any; newValue: any };
}

export class WebDBReceiver {
  private _manager: Manager = null;
  // private _subscriptionEmitter = new EventEmitter<SubscriptionEventMap>();
  private _cacheEmitter = new CacheEmitter();
  private _subscribeEventHashes: string[] = [];

  constructor(manager: Manager) {
    this._manager = manager;
  }

  get manager() {
    return this._manager;
  }

  public get API(): IWebDBAdapterParams {
    return {
      get: this.get,
      create: this.create,
      update: this.update,
      delete: this.delete,
      count: this.count,
      find: this.find,
      index: this.index,
      subscribe: this.subscribe,
    };
  }

  public count = (...[query]: WebDBMethodParameters<'count'>) => {
    return this.manager.db.count(query);
  };

  public get = (...[query]: WebDBMethodParameters<'get'>) => {
    return this.manager.db.get(query);
  };

  public create = (...[table, items]: WebDBMethodParameters<'create'>) => {
    return this.manager.db.create(table, items);
  };

  public update = (...[table, items]: WebDBMethodParameters<'update'>) => {
    return this.manager.db.update(table, items);
  };

  public delete = (...[queryData]: WebDBMethodParameters<'delete'>) => {
    return this.manager.db.delete(queryData);
  };

  public index = (...[table, indexName, keys]: WebDBMethodParameters<'index'>) => {
    return this.manager.db.index(table, indexName, keys);
  };

  public find = (...[queryData]: WebDBMethodParameters<'find'>) => {
    return this.manager.db.find(queryData);
  };

  // public subscribe = (...[queryData, callback]: WebDBMethodParameters<'subscribe'>) => {
  //   const queryHash = Query.getHash(queryData);

  //   if (!this._subscriptionEmitter.hasEvent(queryHash)) {
  //     console.log('REAL SUBSCRIBE');
  //     const unsubcribe = this.manager.db.subscribe(queryData, (oldValue, newValue) => {
  //       this._subscriptionEmitter.emitSync(queryHash, { oldValue, newValue });
  //     });

  //     const triggerOffEventHash = this._subscriptionEmitter.triggerOffEvent(queryHash, () => {
  //       console.log('REAL UNSUBSCRIBE');
  //       unsubcribe();

  //       this._subscriptionEmitter.offTriggerOff(triggerOffEventHash);
  //     });
  //   }

  //   console.log('EVENT SUBSCRIBE');
  //   const eventHash = this._subscriptionEmitter.on(queryHash, ({ oldValue, newValue }) => callback(oldValue, newValue));

  //   return () => this._subscriptionEmitter.off(eventHash);
  // };

  public subscribe = (...[queryData, callback]: WebDBMethodParameters<'subscribe'>) => {
    const queryHash = Query.getHash(queryData);

    const eventHash = this._cacheEmitter.subscribe<{ oldValue: IBaseDBItem; newValue: IBaseDBItem }>(
      `subscribe_${queryHash}`,
      (callback) => {
        const unsubscribe = this.manager.db.subscribe(queryData, (oldValue, newValue) =>
          callback({ oldValue, newValue }),
        );
        return () => {
          unsubscribe();
        };
      },
      ({ oldValue, newValue }) => callback(oldValue, newValue),
    );

    this._subscribeEventHashes.push(eventHash);

    return () => {
      this._subscribeEventHashes = this._subscribeEventHashes.filter((m) => m !== eventHash);
      this._cacheEmitter.unsubscribe(eventHash);
    };
  };

  public close = () => {
    // this._subscriptionEmitter.offAll();
    for (const hash of this._subscribeEventHashes) {
      this._cacheEmitter.unsubscribe(hash);
    }
    this._subscribeEventHashes = [];
  };
}
