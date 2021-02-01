import Emitter from '@berish/emitter';
import { BaseDBAdapter, IBaseDBItem, Query, QueryData, QueryDataSchema } from '@berish/orm';
import tryCall from '@berish/try-call';

export interface IWebDBAdapterParams {
  sendData: <T>(path: string, args: any[]) => Promise<T>;
}

export class WebDBAdapter extends BaseDBAdapter<IWebDBAdapterParams> {
  private emitter: Emitter<any> = null;

  public async initialize(params: IWebDBAdapterParams) {
    this.params = params;
    this.deepFetch = true;
    this.emitter = new Emitter();
  }

  public emptyFieldLiteral() {
    return void 0;
  }

  public count(query: QueryData<QueryDataSchema>): Promise<number> {
    return this.params.sendData<number>('count', [query]);
  }

  public async get<T>(query: QueryData<QueryDataSchema>) {
    return this.params.sendData<T>('get', [query]);
  }

  public async create(tableName: string, items: IBaseDBItem[]) {
    return this.params.sendData<void>('create', [tableName, items]);
  }

  public async update(tableName: string, items: IBaseDBItem[]) {
    return this.params.sendData<void>('update', [tableName, items]);
  }

  public async delete(data: QueryData<QueryDataSchema>) {
    return this.params.sendData<void>('delete', [data]);
  }

  public async index(tableName: string, indexName: string, keys?: string[]) {
    return this.params.sendData<void>('index', [tableName, indexName, keys]);
  }

  public async find<T>(query: QueryData<QueryDataSchema>) {
    return this.params.sendData<T>('find', [query]);
  }

  public subscribe<T>(query: QueryData<QueryDataSchema>, cb: (oldVal: T, newVal: T) => any) {
    const hash = Query.getHash(query);
    const methodName = 'subscribe';
    const eventName = `${hash}_${methodName}`;
    const eventHash = this.emitter.cacheSubscribe<{ oldValue: T; newValue: T }>(
      eventName,
      async callback => {
        const unlistener = await this.params.sendData<() => Promise<void>>('subscribe', [
          query,
          (oldValue: T, newValue: T) => callback({ oldValue, newValue }),
        ]);
        return async () => {
          await tryCall(() => unlistener(), { maxAttempts: 5, timeout: 1000 });
        };
      },
      ({ oldValue, newValue }) => cb(oldValue, newValue),
    );
    return () => this.emitter.off(eventHash);
  }
}
