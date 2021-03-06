/**
 *    Copyright (C) 2021-present MongoDB, Inc.
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the Server Side Public License, version 1,
 *    as published by MongoDB, Inc.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    Server Side Public License for more details.
 *
 *    You should have received a copy of the Server Side Public License
 *    along with this program. If not, see
 *    <http://www.mongodb.com/licensing/server-side-public-license>.
 *
 *    As a special exception, the copyright holders give permission to link the
 *    code of portions of this program with the OpenSSL library under certain
 *    conditions as described in each individual source file and distribute
 *    linked combinations including the program with the OpenSSL library. You
 *    must comply with the Server Side Public License in all respects for
 *    all of the code used other than as permitted herein. If you modify file(s)
 *    with this exception, you may extend this exception to your version of the
 *    file(s), but you are not obligated to do so. If you do not wish to do so,
 *    delete this exception statement from your version. If you delete this
 *    exception statement from all source files in the program, then also delete
 *    it in the license file.
 */

#pragma once

#include "mongo/bson/bsonobj.h"
#include "mongo/db/timeseries/timeseries_gen.h"

namespace mongo {

class OperationContext;

/**
 * Namespace for helper functions converting index spec schema between time-series collection and
 * underlying buckets collection.
 */
namespace timeseries {

/**
 * Returns a copy of the time-series options for namespace 'nss', if 'nss' refers to a time-series
 * collection. Otherwise returns boost::none.
 */
boost::optional<TimeseriesOptions> getTimeseriesOptions(OperationContext* opCtx,
                                                        const NamespaceString& nss);

/**
 * Maps the time-series collection index spec 'timeseriesIndexSpecBSON' to the index schema of the
 * underlying bucket collection using the information provided in 'timeseriesOptions'.
 *
 * Returns an error if the specified 'timeseriesKeyBSON' is invalid for the time-series collection.
 */
StatusWith<BSONObj> convertTimeseriesIndexSpecToBucketsIndexSpec(
    const TimeseriesOptions& timeseriesOptions, const BSONObj& timeseriesIndexSpecBSON);

/**
 * Maps the buckets collection index spec 'bucketsIndexSpecBSON' to the index schema of the
 * time-series collection using the information provided in 'timeseriesOptions'.
 *
 * If 'bucketsIndexSpecBSON' does not match a valid time-series index format, then an empty BSONObj
 * is returned.
 *
 * Conversion Example:
 * On a time-series collection with 'tm' time field and 'mm' metadata field,
 * we may see a compound index on the underlying bucket collection mapped from:
 * {
 *     'meta.tag1': 1,
 *     'control.min.tm': 1,
 *     'control.max.tm': 1
 * }
 * to an index on the time-series collection:
 * {
 *     'mm.tag1': 1,
 *     'tm': 1
 * }
 */
BSONObj convertBucketsIndexSpecToTimeseriesIndexSpec(const TimeseriesOptions& timeseriesOptions,
                                                     const BSONObj& bucketsIndexSpecBSON);

}  // namespace timeseries
}  // namespace mongo
