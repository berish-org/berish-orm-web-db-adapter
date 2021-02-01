import { baseDBMethods, Entity, QueryData, QueryDataSchema, Manager, Query } from '@berish/orm';

interface IDbReceiverParams {
  by?: <T extends Entity>(query: Query<T>) => Query<T> | Promise<Query<T>>;
}
type dbMethodType<N extends keyof Manager['db']> = Parameters<Manager['db'][N]>;

export class WebDBReceiver {
  private _manager: Manager = null;
  private _params: IDbReceiverParams = null;

  constructor(manager: Manager, params?: IDbReceiverParams) {
    this._manager = manager;
    this._params = params;
  }

  get manager() {
    return this._manager;
  }

  get params() {
    return this._params || {};
  }

  public async call<T extends keyof Manager['db']>(name: T, ...args: any[]) {
    if (baseDBMethods.indexOf(name) === -1) throw new Error('orm db method not found');
    if (name === 'count') {
      const [query] = args as dbMethodType<'count'>;
      const queryWithBy = await this.withBy(query);
      return this.manager.db.count(queryWithBy);
    }
    if (name === 'get') {
      const [query] = args as dbMethodType<'get'>;
      const queryWithBy = await this.withBy(query);
      return this.manager.db.get(queryWithBy);
    }
    if (name === 'create') {
      const [table, items] = args as dbMethodType<'create'>;
      return this.manager.db.create(table, items);
    }
    if (name === 'update') {
      const [table, items] = args as dbMethodType<'update'>;
      return this.manager.db.update(table, items);
    }
    if (name === 'delete') {
      const [queryData] = args as dbMethodType<'delete'>;
      const queryWithBy = await this.withBy(queryData);
      return this.manager.db.delete(queryWithBy);
    }
    if (name === 'index') {
      const [table, indexName, keys] = args as dbMethodType<'index'>;
      return this.manager.db.index(table, indexName, keys);
    }
    if (name === 'find') {
      const [queryData] = args as dbMethodType<'find'>;
      const queryWithBy = await this.withBy(queryData);
      return this.manager.db.find(queryWithBy);
    }
    if (name === 'subscribe') {
      const [queryData, cb] = args as dbMethodType<'subscribe'>;
      const queryWithBy = await this.withBy(queryData);
      return this.manager.db.subscribe(queryWithBy, cb);
    }
  }

  private async withBy(queryData: QueryData<QueryDataSchema>) {
    if (!queryData) throw new Error('FP-ORM: queryData is undefined');
    const query = Query.fromJSON(queryData);
    const withByQuery = (await (this.params.by && this.params.by(query))) || query;
    return withByQuery.json;
  }
}
