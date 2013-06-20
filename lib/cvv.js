
var _ = require('lodash');

// returns true if the vsn is newer than the value for the existing ID
// in knowledge or id is unrecognized by knowledge
function isVsnNew(id, vsn, kMap) {
    var kVsn;
    if (!kMap) {
        return id !== undefined && typeof vsn === 'number';
    }
    if (typeof vsn !== 'number') {
        throw new Error('Invalid argument type, vsn: ' + (typeof vsn));
    }
    kVsn = kMap[id];
    return kVsn === undefined || kVsn < vsn;
}

// last-write-wins resolver of conflicts. Highest version number wins (should be
// the highest timestamp bc vsn are based on timestamps in this implementation)
// To tie-break identical timestamps compare the ids. If the ids are equal (and
// the timestamp should be equal otherwise ids wouldn't be compared) then throw
// an error if the values aren't equal. This should only be used with keys that
// that are in conflict and therefore have identical keys.
function lwwResolver(itemA, itemB) {

    // check the version time-stamp
    if (itemA[3] > itemB[3]) {
        return itemA;
    } else if (itemA[3] < itemB[3]) {
        return itemB;
    }
    // check the lexical ordering of IDs (as a tie-breaker)
    if (itemA[2] < itemB[2]) {
        return itemA;
    } else if (itemA[2] > itemB[2]) {
        return itemB;
    }
    // if they have the same value, its arbitrary
    if (itemA[1] === itemB[1]) {
        return itemA;
    } else {
        throw new Error('conflicting items have same version and id and not equal values');
    }
}


function ContextualVV(id) {
    this.data = {};
    this.id = id;
    this.vsnMs = 0;
    // knowledge data structures
    this.kMap = {};
    this.kLen = 0;
}

ContextualVV.prototype = {

    getId: function() {
        return this.id;
    },

    latestVersion: function() {
        return this.vsnMs;
    },

    get: function(key) {
        var item = this.data[key];
        return item ? item[1] : undefined;
    },

    getVsn: function(key) {
        var item = this.data[key];
        return item ? [item[2], item[3]] : undefined;
    },

    // applies an internal update to data, the id:version assotiated with the
    // update is the local id and the local time (in ms)
    put: function(key, value) {

        var item = this.data[key],
            oldVsnMs = this.vsnMs;

        if (!item) {
            // items have the format: [key, value, id, vsnMs]
            item = [key];
            this.data[key] = item;
        }
        item[1] = value;
        this.vsnMs = +new Date();
        // ensure the new vsn is larger, even if same event loop (same date)
        while (this.vsnMs <= oldVsnMs) {
            this.vsnMs += 0.001;
        }
        item[2] = this.id;
        item[3] = this.vsnMs;
        this.updateKnowledge(this.id, this.vsnMs);
    },

    // applies an internal update to data, the id:version assotiated with the
    // update is the local id and the local time (in ms)
    update: function(key, value, id, vsn) {

        var item;

        if (typeof id !== 'string') {
            throw new Error('Invalid id: ' + id);
        } else if (typeof vsn !== 'number') {
            throw new Error('Invalid version: ' + vsn);
        }
        item = this.data[key];
        if (!isVsnNew(id, vsn, this.kMap)) {
            return false;
        }
        if (!item) {
            item = this.data[key] = [];
        }
        item[0] = key;
        item[1] = value;
        item[2] = id;
        item[3] = vsn;
        this.updateKnowledge(id, vsnMs);
        return true;
    },

    // returns the current knowledge for a given id
    getKnowledge: function(id) {
        if (id) {
            return this.kMap[id];
        } else {
            if (!this.kLen) {
                return undefined;
            }
            return {
                len: this.kLen,
                map: _.clone(this.kMap)
            };
        }
    },

    // returns true if vsn is newer than what's stored
    updateKnowledge: function(id, vsn) {

        if (this.kMap[id] !== undefined) {
            if (this.kMap[id] < vsn) {
                this.kMap[id] = vsn;
                return true;
            }
            return false;
        }
        // create a new entry
        this.kMap[id] = vsn;
        this.kLen++;
        return true;
    },

    // TODO(jf): Merge _hasOlderThan and _hasNewerThan so only do one loop iteration
    // instead of two

    // returns true if `knowledge` parameter has unknown keys or newer version(s)
    // of known keys, IE, if the local data needs an update
    hasOlderThan: function(knowledge) {

        var id,
            map;

        if (!knowledge || !knowledge.len) {
            return false;
        } else if (!this.kLen) {
            return true;
        }

        // if it's longer it has new stuff
        if (knowledge.len > this.kLen) {
            return true;
        }
        map = knowledge.map;
        for (id in map) {
            // if knowledge has an id that's not present locally then it has
            // some new information
            if (typeof this.kMap[id] === 'undefined') {
                return true;
            } else if (this.kMap[id] < map[id]) {
                // if the local version is older
                return true;
            }
        }
        return false;
    },

    // returns true if `knowledge` parameter is missing one or more keys or has
    // old version(s) of known keys, IE if should send an update
    hasNewerThan: function(knowledge) {

        var map,
            id;

        // if there's no local knowledge then definitely nothing newer
        if (!this.kLen) {
            return false;
        } else if (!knowledge) {
            // if knowledge is undefined then local is newer
            return true;
        }

        // if there are more ids, locally, then there is new knowledge
        if (this.kLen > knowledge.len) {
            return true;
        }
        // compare ids in `knowledge` with the local knowledge
        map = knowledge.map;
        for (id in this.kMap) {
            if (typeof map[id] === 'undefined') {
                return true;
            } else if (this.kMap[id] > map[id]) {
                return true;
            }
        }
        return false;
    },

    getNewerValues: function(knowledge) {

        var vals,
            key,
            id,
            vsn,
            item,
            map;

        if (!this.kLen) {
            return;
        }
        vals = [];
        // return all values if knowledge is undefined
        if (knowledge === undefined) {
            for (key in this.data) {
                vals.push(this.data[key].slice());
            }
            return vals;
        }
        // return only the values whose id:version is either not present or is
        // newer than what is stored in `knowledge`
        map = knowledge.map;
        for (key in this.data) {
            item = this.data[key];
            id = item[2];
            vsn = item[3];
            if (map[id] === undefined || map[id] < vsn) {
                vals.push(item.slice());
            }
        }
        return vals.length ? vals : undefined;
    },

    // `merge()` merges `knowledge` and `values` into the local knowledge and
    // local data.
    // 
    // `knowledge` is expected to be an `Object` of `id: version` pairs where
    // the property is the `id` and the value is the `version` for that `id`.
    //
    // `values` is expected to be an array of `[key, value id, version]` elements.
    // 
    // `resolver` is used to resolve conflicts.
    //
    // The `values` are compared with the local knowledge. If, for some `key`,
    // the corresponding element from `values` dominates the local knowledge,
    // the corresponding element from `values` is integrated into the local
    // data. For the same `key`, if the local element also dominates the
    // `knowledge` parameter, the version from `values` is in conflict with
    // the local version. This results from concurrent updates. To resolve this,
    // the values and their corresponding versions are passed into `resolver`,
    // which should elect a value. The `resolver` function must be deterministic.
    // IE, if the same situation occurs on a remote node, it should resolve the
    // conflict with the same result as the local resolution determined by the
    // `resolver` function. `resolver` defaults to a `lww` resolver - last
    // write wins. IE., the value with the higest corresponding version number
    // will win. The logic being that version numbers are time stamps and the
    // higher time-stamp is the more recent write.
    //
    // It is assumed that `knowledge` is the complete knowledge for the
    // originating CVV and `values` is a comprehensive list of data that should
    // be integrated locally. Therefore, the `knowledge` parameter will be
    // merged with the local knowledge, and the local knowledge will integrate
    // all versions from the `knowledge` parameter that are either missing or
    // greater than their counter parts. This will happen even if `values` is
    // an empty `array`. As a result, a subsequent `this.hasOlderThan(knowledge)`
    // call should return `false`. 
    //
    // It is recommended that after invoking `merge()`,
    // `this.hasNewerThan(knowledge)` is used to detemrine if the `knowledge`
    // parameter's corresponding `CVV` requires an update.
    merge: function(knowledge, values, resolver) {

        var map = knowledge.map,
            item,
            localItem,
            key,
            max,
            i,
            vsn;

        resolver = resolver || lwwResolver;

        // if there are values to integrate
        if (values && values.length) {

            for (i = 0, max = values.length; i < max; i++) {

                item = values[i];
                key = item[0];
                localItem = this.data[key];

                // there is no local value with that key, so integrate item
                if (!localItem) {
                    this.data[key] = item;
                    continue;
                }
                // if the vsn associated with item is newer than the local knowledge
                if (isVsnNew(item[2], item[3], this.kMap)) {
                    // if the local item for that key is newer than the remote knowledge
                    if (isVsnNew(localItem[2], localItem[3], map)) {
                        // settle the conflict via resolver
                        this.data[key] = resolver(item, localItem);
                    } else {
                        // the remote value is newer so keep it
                        this.data[key] = item;
                    }
                }
            }
        }

        // for each version in knowledge, update the local knowledge if it is older,
        // keep unrecognized items
        for (key in map) {
            vsn = this.kMap[key];
            if (vsn === undefined) {
                // integrate new versions
                this.kMap[key] = map[key];
                this.kLen++;
            } else if (vsn < map[key]) {
                // integrate newer versions
                this.kMap[key] = map[key];
            }
        }
    },

    // Compares `knowledge` with the local knowledge to determine if either the
    // local knowledge needs to be updated or the `knowledge`'s owning CVV needs
    // to be updated.
    //
    // For the purposes of this documentation, the CVV that generated `knowledge`
    // will be referred to as the remote-CVV.
    //
    // If `knowledge` and the local knowledge are equal, then no action is
    // required and `undefined` is returned.
    //
    // If `knowledge` is not equal to the local knowledge, the result object
    // will be of the format:
    //
    //      {
    //          requiresUpdate: <boolean>
    //          containsUpdate: <boolean>,
    //          values: <Array>
    //          k: <local knowledge>,
    //      }
    //
    // `requiresUpdate` indicates the remote-CVV contains information that needs
    // to be integrated, locally; an update should be requested.
    //
    // `containsUpdate` indicates the local knowledge contains information that
    // has not been integrated into the remote-CVV; an update should be sent to
    // that CVV.
    //
    // `values` is an `Array` of the format `[key, value, id, version]` and is
    // the set of values the remote-CVV needs in order to be up to date.
    // `values` and `k` from the result object should be sent to that CVV. It
    // is possible that an update should be sent to the remote-CVV even if
    // `values` is not present on the result object or is set to an empty
    // `Array`. In this case, the local knowledge is newer, but the remote-CVV
    // contains no out of date values.
    //
    // `k` is the local knowledge and should be included with an update or a
    // request for an update.
    //
    // If an update should be sent to the remote-CVV, the update sent should
    // include `k` and the `values` result properties.
    //
    // If an update should be requested from the remote-CVV, `k` should be
    // included with the request for an update.
    compare: function(knowledge) {

        var result,
            requiresUpdate = this.hasOlderThan(knowledge),
            containsUpdate = this.hasNewerThan(knowledge),
            values;

        if (requiresUpdate) {
            result = {
                requiresUpdate: true,
                k: this.getKnowledge()
            };
        }
        if (containsUpdate) {
            result = result || { k: this.getKnowledge() };
            result.containsUpdate = true;
            values = this.getNewerValues(knowledge);
            if (values) {
                result.values = values;
            }
        }
        return result;
    }
};

exports.isVsnNew = isVsnNew;
exports.lwwResolver = lwwResolver;
exports.ContextualVV = ContextualVV;
