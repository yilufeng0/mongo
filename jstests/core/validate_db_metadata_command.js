/**
 * Tests the validateDBMetaData commands with various input parameters.
 * @tags: [
 *   requires_fcv_49,
 * ]
 */
(function() {
"use strict";

load("jstests/libs/fixture_helpers.js");  // For FixtureHelpers.

const dbName = jsTestName();

const testDB = db.getSiblingDB(dbName);
assert.commandWorked(testDB.dropDatabase());
const coll1 = testDB.coll1;

// Drop all the unstable data that the other tests might have created. This will ensure that the
// validateDBMetadata command is validating only the data generated by this test.
(function dropAllUnstableData() {
    const listDBRes = assert.commandWorked(db.adminCommand({listDatabases: 1, nameOnly: true}));
    for (let listDBOutput of listDBRes.databases) {
        // Skip non-user databases.
        if (Array.contains(["admin", "config", "local", "$external"], listDBOutput.name)) {
            continue;
        }
        const currentDB = db.getSiblingDB(listDBOutput.name);
        for (let collInfo of currentDB.getCollectionInfos()) {
            if (collInfo.type == "collection" && !collInfo.name.startsWith("system")) {
                assert.commandWorked(currentDB[collInfo.name].dropIndexes());
            }
        }
    }
})();

// Verify that the 'apiParameters' field is required.
const res = assert.commandFailedWithCode(testDB.runCommand({validateDBMetadata: 1}), 40414);

function validate({dbName, coll, apiStrict, error}) {
    dbName = dbName ? dbName : null;
    coll = coll ? coll : null;
    const res = assert.commandWorked(testDB.runCommand({
        validateDBMetadata: 1,
        db: dbName,
        collection: coll,
        apiParameters: {version: "1", strict: apiStrict}
    }));

    assert(res.apiVersionErrors);
    const foundError = res.apiVersionErrors.length > 0;

    // Verify that 'apiVersionErrors' is not empty when 'error' is true, and vice versa.
    assert((!error && !foundError) || (error && foundError), res);

    if (error) {
        for (let apiError of res.apiVersionErrors) {
            assert(apiError.ns);
            if (error.code) {
                assert.eq(apiError.code, error.code);
            }

            if (FixtureHelpers.isMongos(testDB)) {
                // Check that every error has an additional 'shard' field on sharded clusters.
                assert(apiError.shard);
            }
        }
    }
}

//
// Tests for indexes.
//
assert.commandWorked(coll1.createIndex({p: "text"}));

validate({apiStrict: false});

// All dbs but different collection name.
validate({coll: "coll2", apiStrict: true});

// Different db, and collection which has unstable index should not error.
validate({dbName: "new", coll: "coll1", apiStrict: true});
validate({
    dbName: "new",
    apiStrict: true,
});

// Cases where the command returns an error.
validate({apiStrict: true, error: true});
validate({coll: "coll1", apiStrict: true, error: true});
validate({
    dbName: testDB.getName(),
    coll: "coll1",
    apiStrict: true,
    error: {code: ErrorCodes.APIStrictError}
});
validate({dbName: testDB.getName(), apiStrict: true, error: true});

//
// Tests for views.
//
assert.commandWorked(coll1.dropIndexes());
validate({apiStrict: true});

// Create a view which uses unstable expression and verify that validateDBMetadata commands throws
// an assertion.
const view =
    testDB.createView("view1", "coll2", [{$project: {v: {$_testApiVersion: {unstable: true}}}}]);

validate({apiStrict: true, error: true});
validate({dbName: dbName, apiStrict: true, error: true});

validate({dbName: "otherDB", apiStrict: true});
validate({dbName: dbName, coll: "coll", apiStrict: true});

// With view name in the input.
validate({coll: "view1", apiStrict: true, error: {code: ErrorCodes.APIStrictError}});
validate(
    {dbName: dbName, coll: "view1", apiStrict: true, error: {code: ErrorCodes.APIStrictError}});

validate({dbName: "new", coll: "view1", apiStrict: true});

// Collection named same as the view name in another db.
const testDB2 = db.getSiblingDB("testDB2");
const collWithViewName = testDB2.view1;
validate({coll: "view1", apiStrict: true, error: {code: ErrorCodes.APIStrictError}});
}());