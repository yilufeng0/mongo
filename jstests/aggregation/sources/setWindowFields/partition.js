/*
 * Test partitioning inside $setWindowFields.
 *
 * @tags: [
 *   # We assume the pipeline is not split into a shardsPart and mergerPart.
 *   assumes_unsharded_collection,
 *   # We're testing the explain plan, not the query results, so the facet passthrough would fail.
 *   do_not_wrap_aggregations_in_facets,
 * ]
 */
(function() {
"use strict";

const getParam = db.adminCommand({getParameter: 1, featureFlagWindowFunctions: 1});
jsTestLog(getParam);
const featureEnabled = assert.commandWorked(getParam).featureFlagWindowFunctions.value;
if (!featureEnabled) {
    jsTestLog("Skipping test because the window function feature flag is disabled");
    return;
}

const coll = db[jsTestName()];
coll.drop();
assert.commandWorked(coll.insert({int_field: 0, arr: [1, 2]}));

// Test for runtime error when 'partitionBy' expression evaluates to an array
assert.commandFailedWithCode(coll.runCommand({
    aggregate: coll.getName(),
    pipeline: [{
        $setWindowFields: {
            partitionBy: "$arr",
            sortBy: {_id: 1},
            output: {a: {$sum: "$int_field", window: {documents: ["unbounded", "current"]}}}
        }
    }],
    cursor: {}
}),
                             ErrorCodes.TypeMismatch);

// Test that a constant expression for 'partitionBy' is equivalent to no partitioning.
const constantPartitionExprs = [null, "constant", {$add: [1, 2]}];
constantPartitionExprs.forEach(function(partitionExpr) {
    const result = coll.explain().aggregate([
        // prevent stages from being absorbed into the .find() layer
        {$_internalInhibitOptimization: {}},
        {$setWindowFields: {partitionBy: partitionExpr, output: {}}},
    ]);
    assert.commandWorked(result);
    assert(Array.isArray(result.stages), result);
    assert(result.stages[0].$cursor, result);
    assert(result.stages[1].$_internalInhibitOptimization, result);
    assert.eq({$_internalSetWindowFields: {output: {}}}, result.stages[2]);
});
})();