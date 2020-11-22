const MongoClient = require('mongodb').MongoClient;
const chalk = require('chalk');
require('dotenv').config({ path: process.env.pro ? '.env' : '.env.dev' });

const log = require('Debug')('app');

const db_name = "solar_project_db";
const CACHE_LAYER = "cache_collection";
const CACHE_KEY = '_cachekey';

class MongoCache {
    constructor(conn, { mongo_collection_name=CACHE_LAYER, time_to_live = 30 }={}) { // time to live in seconds
        this.dbo = conn.db(db_name);
        this.collection_name = mongo_collection_name;
        this.time_to_live = time_to_live * 1000;
        this.cache_key = CACHE_KEY;
    }

    async init() {
        let collections = await this.dbo.listCollections().toArray();
        if (collections.map(col => col.name).includes(this.collection_name)) {
            return this;
        }
        console.log("Initializing MongoDB collections......");
        await this.dbo.createCollection(this.collection_name)
        await this.dbo.collection(this.collection_name).createIndex({
            [CACHE_KEY]: 1
        }, { unique: true });
        console.log("Done intializing");
    }

    async get(key, default_value_resolver = async () => null) {
        let value = await this.dbo.collection(this.collection_name).findOne({
            [this.cache_key] : key
        });
        if (!value || !value.timestamp || (Date.now() - value.timestamp) > this.time_to_live) {
            let defaultVal = await default_value_resolver();
            return await this.put(key, defaultVal);
        }
        return value;
    }

    async put(key, obj) {
        let newObj = {
            timestamp: Date.now(),
            [this.cache_key] : key,
            value: obj
        };
        await this.dbo.collection(this.collection_name).update({
            [this.cache_key] : key
        },newObj, {
            "upsert" : true  // insert a new document, if no existing document match the query 
        });
        return newObj;
    }

    async clear() {
        await this.dbo.collection(this.collection_name).remove({});
    }
}

module.exports = {
    db_name,
    CACHE_LAYER,
    MongoCache,
    conn: async () => await MongoClient.connect(process.env.MONGODB_URI)
}