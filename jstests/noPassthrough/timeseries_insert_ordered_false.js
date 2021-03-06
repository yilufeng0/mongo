/**
 * Tests that time-series inserts respect {ordered: false}.
 */
(function() {
'use strict';

load('jstests/core/timeseries/libs/timeseries.js');
load('jstests/libs/fail_point_util.js');

const conn = MongoRunner.runMongod();

if (!TimeseriesTest.timeseriesCollectionsEnabled(conn)) {
    jsTestLog('Skipping test because the time-series collection feature flag is disabled');
    MongoRunner.stopMongod(conn);
    return;
}

const testDB = conn.getDB(jsTestName());

const coll = testDB.getCollection('t');
const bucketsColl = testDB.getCollection('system.buckets.' + coll.getName());

const timeFieldName = 'time';
const metaFieldName = 'meta';

const resetColl = function() {
    coll.drop();
    assert.commandWorked(testDB.createCollection(
        coll.getName(), {timeseries: {timeField: timeFieldName, metaField: metaFieldName}}));
    assert.contains(bucketsColl.getName(), testDB.getCollectionNames());
};
resetColl();

configureFailPoint(conn, 'failTimeseriesInsert', {metadata: 'fail'});

// Temporarily use null meta instead of missing meta to accomodate the new $_internalUnpackBucket
// behavior which is null meta in a bucket is materialized as "null" meta.
// TODO SERVER-55213: Remove 'meta: null'.
const docs = [
    {_id: 0, meta: null, [timeFieldName]: ISODate()},
    {_id: 1, meta: null, [timeFieldName]: ISODate()},
    {_id: 2, meta: null, [timeFieldName]: ISODate()},
];

let res = assert.commandWorked(coll.insert(docs, {ordered: false}));
assert.eq(res.nInserted, 3, 'Invalid insert result: ' + tojson(res));
assert.docEq(coll.find().sort({_id: 1}).toArray(), docs);
resetColl();

docs[1][metaFieldName] = 'fail';
res = assert.commandFailed(coll.insert(docs, {ordered: false}));
jsTestLog('Checking insert result: ' + tojson(res));
assert.eq(res.nInserted, 2);
assert.eq(res.getWriteErrors().length, 1);
assert.eq(res.getWriteErrors()[0].index, 1);
assert.docEq(res.getWriteErrors()[0].getOperation(), docs[1]);
assert.docEq(coll.find().sort({_id: 1}).toArray(), [docs[0], docs[2]]);

MongoRunner.stopMongod(conn);
})();