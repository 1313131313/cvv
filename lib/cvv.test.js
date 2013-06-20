
var assert = require('assert'),
    _ = require('lodash'),
    cvvNs = require('./cvv'),
    ContextualVV = cvvNs.ContextualVV;


describe('isVsnNew(id, vsn, kMap)', function() {

    it('should throw an error if `vsn` is not a number', function() {

        var fn,
            callArgs = [
                ['id', [], {}],
                ['id', {}, {}],
                ['id', '0', {}],
                ['id', function(){}, {}],
                ['id', undefined, {}]
            ];

        callArgs.forEach(function(args) {
            fn = function() {
                cvvNs.isVsnNew.apply(undefined, args);
            };
            fn.should.throwError();
        });
    });

    it('should return `true` if `id` is unrecognized by `knowledge`', function() {

        var cvv = new ContextualVV('some-id'),
            k;

        // add a value, otherwise `getKnowledge()` will return `undefined`
        cvv.put('key', Math.random());
        k = cvv.getKnowledge();

        assert(cvvNs.isVsnNew('other-id', 0, k.map) === true);
        assert(cvvNs.isVsnNew('other-id', 0, {}) === true);
        assert(cvvNs.isVsnNew('other-id', 0, undefined) === true);
    });

    it('should return `true` if `vsn` is newer than `id:version` contained in `knowledge`', function() {

        var cvv = new ContextualVV('id'),
            vsnSet,
            k;

        cvv.put('key', 'any-value');
        vsnSet = cvv.getVsn('key');
        k = cvv.getKnowledge();

        assert(cvvNs.isVsnNew(vsnSet[0], vsnSet[1] + 1, k.map) === true);
    });

    it('should return `false` if the `vsn` is older than `id:version` contained in `knowledge`', function() {

        var cvv = new ContextualVV('some-id'),
            vsnSet,
            k;

        cvv.put('key', 'any-value');
        vsnSet = cvv.getVsn('key');
        cvv.put('key', 'updating');
        k = cvv.getKnowledge();

        assert(cvvNs.isVsnNew(vsnSet[0], vsnSet[1], k.map) === false);
    });

    it('should return `false` if the `vsn` contained in `knowledge` for `id:vsn` is the same as `vsn`', function() {

        var cvv = new ContextualVV('some-id'),
            vsnSet,
            k;

        cvv.put('key', 'any-value');
        vsnSet = cvv.getVsn('key');
        k = cvv.getKnowledge();

        k.map[vsnSet[0]].should.equal(vsnSet[1]);
        assert(cvvNs.isVsnNew(vsnSet[0], vsnSet[1], k.map) === false);
    });
});


describe('lwwResolver(itemA, itemB)', function() {

    it('should return `itemA` if its version is higher than `itemB`\'s', function() {

        var itemA = ['key', 0, 'a', 1],
            itemB = ['key', 0, 'b', 0];

        cvvNs.lwwResolver(itemA, itemB).should.equal(itemA);
    });

    it('should return `itemB` if its version is higher than `itemA`\'s', function() {

        var itemA = ['key', 0, 'a', 0],
            itemB = ['key', 0, 'b', 1];

        cvvNs.lwwResolver(itemA, itemB).should.equal(itemB);
    });

    it('should return `itemA` if both versions are the same and `itemA\'s id is less than `itemB`\'s id', function() {

        var itemA = ['key', 0, 'first', 0],
            itemB = ['key', 0, 'second', 0];

        cvvNs.lwwResolver(itemA, itemB).should.equal(itemA);
    });

    it('should return `itemB` if both versions are the same and `itemB\'s id is less than `itemA`\'s id', function() {

        var itemA = ['key', 0, 'second', 0],
            itemB = ['key', 0, 'first', 0];

        cvvNs.lwwResolver(itemA, itemB).should.equal(itemB);
    });

    it('should return `itemA` if both items have the same id, version and value', function() {

        var itemA = ['key', 0, 'id', 0],
            itemB = ['key', 0, 'id', 0];

        cvvNs.lwwResolver(itemA, itemB).should.equal(itemA);
    });

    it('throw an Error if both items have the same id and version but different values', function() {

        var itemA = ['key', 0, 'id', 0],
            itemB = ['key', 1, 'id', 0],
            fn;

        fn = function() {
            cvvNs.lwwResolver(itemA, itemB);
        };
        fn.should.throwError();
    });
});


describe('ContextualVV', function() {

    describe('#id()', function() {

        it('should be read-only and return the `id` initialized with', function() {

            var id = '' + Math.random(),
                cvv = new ContextualVV(id);

            cvv.getId().should.equal(id);
            cvv.getId('should be ignored');
            cvv.getId().should.equal(id);
        });
    });


    describe('#latestVersion()', function() {

        it('should start at 0 and increase when the value is updated', function() {

            var cvv = new ContextualVV('some-id'),
                key = 'some-key',
                vsn0,
                vsn1,
                vsn2,
                vsn3;

            cvv.latestVersion().should.equal(0);

            cvv.put(key, 'some-value-1');
            vsn0 = cvv.latestVersion();
            vsn0.should.be.above(0);

            cvv.put(key, 'some-value-2');
            vsn1 = cvv.latestVersion();
            vsn1.should.be.above(vsn0);

            cvv.put(key, 'some-value-3');
            vsn2 = cvv.latestVersion();
            vsn2.should.be.above(vsn1);

            cvv.put(key, 'some-value-4');
            vsn3 = cvv.latestVersion();
            vsn3.should.be.above(vsn2);
        });
    });


    describe('#get(key)', function() {

        it('should return undefined for an unrecognized key', function() {

            var cvv = new ContextualVV('some-id');

            assert(!cvv.get('some-key'), 'an unknown key should return undefined');
        });

        it('should return the latest value', function() {

            var cvv = new ContextualVV('some-id'),
                val = Math.random();

            cvv.put('some-key', val);
            cvv.get('some-key').should.equal(val);
        });
    });


    describe('#getVsn(key)', function() {

        it('should return undefined for an unrecognized key', function() {

            var cvv = new ContextualVV('some-id');

            assert(cvv.getVsn('some-key') === undefined);
        });

        it('should increase every time a value is updated', function() {

            var id = 'some-id',
                cvv = new ContextualVV(id),
                key = 'some-key',
                vsn0,
                vsn1,
                vsn2,
                vsn3;

            cvv.put(key, 'some-value-1');
            vsn0 = cvv.getVsn(key);
            vsn0[0].should.equal(id);
            vsn0[1].should.be.above(0);

            cvv.put(key, 'some-value-2');
            vsn1 = cvv.getVsn(key);
            vsn1[0].should.equal(id);
            vsn1[1].should.be.above(vsn0[1]);

            cvv.put(key, 'some-value-3');
            vsn2 = cvv.getVsn(key);
            vsn2[0].should.equal(id);
            vsn2[1].should.be.above(vsn1[1]);

            cvv.put(key, 'some-value-4');
            vsn3 = cvv.getVsn(key);
            vsn3[0].should.equal(id);
            vsn3[1].should.be.above(vsn2[1]);
        });

        it('should increase for every update even if the values are identical', function() {

            var id = 'some-id',
                cvv = new ContextualVV(id),
                key = 'some-key',
                val = 'some-value',
                vsn0,
                vsn1,
                vsn2,
                vsn3;

            cvv.put(key, val);
            vsn0 = cvv.getVsn(key);
            vsn0[0].should.equal(id);
            vsn0[1].should.be.above(0);

            cvv.put(key, val);
            vsn1 = cvv.getVsn(key);
            vsn1[0].should.equal(id);
            vsn1[1].should.be.above(vsn0[1]);

            cvv.put(key, val);
            vsn2 = cvv.getVsn(key);
            vsn2[0].should.equal(id);
            vsn2[1].should.be.above(vsn1[1]);

            cvv.put(key, val);
            vsn3 = cvv.getVsn(key);
            vsn3[0].should.equal(id);
            vsn3[1].should.be.above(vsn2[1]);
        });
    });


    describe('#put(key, value)', function() {

        it('should save `value` for new `key`s', function() {

            var cvv = new ContextualVV('some-id'),
                key = 'some-key',
                val = 0;

            cvv.put(key, val);
            cvv.get(key).should.equal(val);
        });

        it('should update the `value` for any given `key`', function() {

            var cvv = new ContextualVV('some-id'),
                key = 'some-key',
                val = 0;

            cvv.put(key, val);
            cvv.get(key).should.equal(val);
            val += '-new-stuff';
            cvv.put(key, val);
            cvv.get(key).should.equal(val);
        });
    });


    describe('#getKnowledge(id)', function() {

        it('should return `undefined` for the local `id` if nothing has been saved', function() {

            var cvv = new ContextualVV('some-id');
            assert(cvv.getKnowledge('some-id') === undefined);
        });

        it('should return `undefined` for an unrecognized `id`', function() {

            var cvv = new ContextualVV('some-id');
            assert(cvv.getKnowledge('new-id') === undefined);
        });

        it('should return the latest version for a recognized id', function() {

            var id = 'some-id',
                cvv = new ContextualVV(id),
                key0 = 'key-0',
                key1 = 'key-1',
                vsn;

            cvv.put(key0, 'some-value');
            vsn = cvv.getVsn(key0);
            cvv.getKnowledge(id).should.equal(vsn[1]);

            cvv.put(key0, 'other-value');
            vsn = cvv.getVsn(key0);
            cvv.getKnowledge(id).should.equal(vsn[1]);

            cvv.put(key1, 'another-value');
            vsn = cvv.getVsn(key1);
            cvv.getKnowledge(id).should.equal(vsn[1]);
        });
    });


    describe('#getKnowledge() [parameterless]', function() {

        it('should return an `undefined` if nothing has been saved', function() {

            var cvv = new ContextualVV('some-id'),
                k = cvv.getKnowledge();

            assert(k === undefined);
        });

        it('should return a single vsn if there is only local knowledge', function() {

            var id = 'some-id',
                cvv = new ContextualVV(id),
                vsn,
                correct;

            cvv.put('some-key', 0);
            vsn = cvv.latestVersion();
            correct = {
                len: 1,
                map: {}
            };
            correct.map[id] = vsn;
            cvv.getKnowledge().should.eql(correct);
        });
    });


    describe('#hasOlderThan(knowledge)', function() {

        it('should return `false` if `knowledge` is empty', function() {

            var cvv = new ContextualVV('some-id-0'),
                k = (new ContextualVV('some-id-1')).getKnowledge();

            cvv.put('key', 0);
            assert(cvv.hasOlderThan(k) === false);
        });

        it('should return `false` if both `knowledge` and the local knowledge are empty', function() {

            var cvv = new ContextualVV('some-id-0'),
                k = (new ContextualVV('some-id-1')).getKnowledge();

            assert(cvv.hasOlderThan(k) === false);
        });

        it('should return `true` if `knowledge` is not empty but the local knowledge is empty', function() {

            var cvv0 = new ContextualVV('some-id-0'),
                cvv1 = new ContextualVV('some-id-1'),
                k;

            cvv1.put('key', 1);
            k = cvv1.getKnowledge();
            assert(cvv0.hasOlderThan(k) === true);
        });

        it('should return `true` if `knowledge` has ids that do not exist in the local knowledge', function() {

            var cvv0 = new ContextualVV('some-id-0'),
                cvv1 = new ContextualVV('some-id-1'),
                k;

            cvv0.put('key', 1);
            cvv1.put('key', 1);
            k = cvv1.getKnowledge();
            assert(cvv0.hasOlderThan(k) === true);
        });

        it('should return `true` if `knowledge` has newer versions of ids that exist in local knowledge', function(done) {

            var cvv0 = new ContextualVV('shared-id'),
                cvv1 = new ContextualVV('shared-id'),
                k;

            cvv0.put('key', 1);
            setTimeout(function() {
                cvv1.put('any-key', 1);
                k = cvv1.getKnowledge();
                assert(cvv0.hasOlderThan(k) === true);
                done();
            }, 5);
        });

        it('should return `false` if `knowledge` has older versions of ids that exist in local knowledge', function(done) {

            var cvv0 = new ContextualVV('shared-id'),
                cvv1 = new ContextualVV('shared-id'),
                k;

            cvv1.put('any-key', 1);
            k = cvv1.getKnowledge();
            setTimeout(function() {
                cvv0.put('key', 1);
                assert(cvv0.hasOlderThan(k) === false);
                done();
            }, 5);
        });
    });


    describe('#hasNewerThan(knowledge)', function() {

        it('should return `false` if local knowledge is empty', function() {

            var cvv0 = new ContextualVV('some-id-0'),
                cvv1 = new ContextualVV('some-id-1'),
                k;

            cvv1.put('key', 0);
            k = cvv1.getKnowledge();
            assert(cvv0.hasNewerThan(k) === false);
        });

        it('should return `false` if both `knowledge` and the local knowledge are empty', function() {

            var cvv = new ContextualVV('some-id-0'),
                k = (new ContextualVV('some-id-1')).getKnowledge();

            assert(cvv.hasNewerThan(k) === false);
        });

        it('should return `true` if `knowledge` is empty but the local knowledge is not empty', function() {

            var cvv0 = new ContextualVV('some-id-0'),
                cvv1 = new ContextualVV('some-id-1'),
                k;

            cvv0.put('key', 1);
            k = cvv1.getKnowledge();
            assert(cvv0.hasNewerThan(k) === true);
        });

        it('should return `true` if local knowledge has ids that do not exist in `knowledge`', function() {

            var cvv0 = new ContextualVV('some-id-0'),
                cvv1 = new ContextualVV('some-id-1'),
                k;

            cvv0.put('key', 1);
            cvv1.put('key', 1);
            k = cvv1.getKnowledge();
            assert(cvv0.hasNewerThan(k) === true);
        });

        it('should return `true` if `knowledge` has older versions of ids that exist in local knowledge', function(done) {

            var cvv0 = new ContextualVV('shared-id'),
                cvv1 = new ContextualVV('shared-id'),
                k;

            cvv1.put('key', 1);
            k = cvv1.getKnowledge();
            setTimeout(function() {
                cvv0.put('any-key', 1);
                assert(cvv0.hasNewerThan(k) === true);
                done();
            }, 5);
        });

        it('should return `false` if `knowledge` has newer versions of all ids that exist in local knowledge', function(done) {

            var cvv0 = new ContextualVV('shared-id'),
                cvv1 = new ContextualVV('shared-id'),
                k;

            cvv0.put('any-key', 1);
            setTimeout(function() {
                cvv1.put('key', 1);
                k = cvv1.getKnowledge();
                assert(cvv0.hasNewerThan(k) === false);
                done();
            }, 5);
        });
    });


    describe('#getNewerValues(knowledge)', function() {

        it('should return `undefined` if there are no values stored locally', function() {

            var cvv0 = new ContextualVV('id-0'),
                cvv1 = new ContextualVV('id-1'),
                vals,
                k;

            cvv1.put('key', 'value');
            k = cvv1.getKnowledge();
            vals = cvv0.getNewerValues(k);
            assert(vals === undefined);
        });

        it('should return all stored values if `knowledge` is undefined', function() {

            var id = 'some-id',
                cvv = new ContextualVV(id),
                correct = [],
                vals;

            cvv.put('zero', 0);
            correct[0] = ['zero', 0, id, cvv.latestVersion()];

            cvv.put('one', 1);
            correct[1] = ['one', 1, id, cvv.latestVersion()];

            cvv.put('two', 2);
            correct[2] = ['two', 2, id, cvv.latestVersion()];

            vals = cvv.getNewerValues();
            vals.should.eql(correct);
        });

        it('should return `undefined` if there are no values that are newer than `knowledge`', function() {

            var cvv = new ContextualVV('some-id'),
                k;

            cvv.put('key', 1);
            k = cvv.getKnowledge();

            assert(cvv.getNewerValues(k) === undefined);
        });

        it('should return values with ids that do not exist in `knowledge`', function() {

            var cvv0 = new ContextualVV('id-0'),
                cvv1 = new ContextualVV('id-1'),
                k,
                vals,
                correct;

            cvv0.put('any-key', 1);
            k = cvv0.getKnowledge();

            cvv1.put('any', 2);
            correct = [['any', 2, 'id-1', cvv1.latestVersion()]];
            vals = cvv1.getNewerValues(k);
            vals.should.eql(correct);
        });

        it('should return values with newer id:version than the the id:version for the same id in `knowledge`', function() {

            var id = 'some-id',
                cvv = new ContextualVV(id),
                key = 'some-key',
                k,
                vsn,
                correct;

            cvv.put(key, 0);
            k = cvv.getKnowledge();
            cvv.put(key, 1);
            correct = [[key, 1, id, cvv.latestVersion()]];
            vals = cvv.getNewerValues(k);
            vals.should.eql(correct);
        });
    });


    describe('#merge(knowledge, undefined)', function() {

        it('should not update local knowledge if `knowledge` is the same as local knowledge', function() {

            var cvv = new ContextualVV('id'),
                correct,
                k0,
                k1;

            cvv.put('key', 'value');
            k0 = cvv.getKnowledge();
            correct = _.cloneDeep(k0);
            cvv.merge(k0);
            k1 = cvv.getKnowledge();
            assert(k1.should.eql(correct));
        });

        it('should not update local knowledge if `knowledge` contains only older versions for ids', function(done) {

            var cvv = new ContextualVV('id'),
                correct,
                k0,
                k1;

            cvv.put('key', 'value1');
            k0 = cvv.getKnowledge();

            setTimeout(function() {

                cvv.put('key', 'value2');
                correct = _.cloneDeep(cvv.getKnowledge());

                cvv.merge(k0);
                k1 = cvv.getKnowledge();
                assert(k1.should.eql(correct));

                done();
            }, 10);
        });

        it('should add ids in `knowledge` to the local knowledge if they do not exist in local knowledge', function() {

            var id = 'id-0',
                cvv0 = new ContextualVV(id),
                cvv1 = new ContextualVV('id-1'),
                k;

            cvv0.put('some-key', 1);
            cvv1.put('any-key', 1);
            k = cvv0.getKnowledge();
            cvv1.merge(k);
            cvv1.getKnowledge().map.should.have.property(id, cvv0.latestVersion());
        });

        it('should update local knowledge when `knowledge` has a newer version for a given id', function(done) {

            var cvv0 = new ContextualVV('id'),
                cvv1 = new ContextualVV('id'),
                correct,
                k;

            cvv0.put('key', 'value1');

            setTimeout(function() {

                cvv1.put('key', 'value2');
                k = cvv1.getKnowledge();
                correct = _.cloneDeep(k);

                cvv0.merge(k);
                assert(cvv0.getKnowledge().should.eql(correct));

                done();
            }, 10);
        });
    });


    describe('#merge(knowledge, values)', function() {

        it('should add new-value when the key is not known', function() {

            var cvv0 = new ContextualVV('id-0'),
                cvv1 = new ContextualVV('id-1'),
                key = 'some-key',
                correctVal = 'awesome-test-val',
                vals,
                k;

            cvv0.put(key, correctVal);
            vals = cvv0.getNewerValues();
            k = cvv0.getKnowledge();
            cvv1.merge(k, vals);

            cvv1.get(key).should.equal(correctVal);
            cvv1.getVsn(key).should.eql(cvv0.getVsn(key));
            cvv1.getKnowledge().should.eql(k);
        });

        it('should ignore new-value when the version is equal vs local-knowledge', function(done) {

            var cvv0 = new ContextualVV('id-0'),
                cvv1 = new ContextualVV('id-1'),
                key = 'some-key',
                oldVal = 'old-test-val',
                updatedVal = 'awesome-test-val',
                vals,
                k0,
                k1;

            cvv0.put(key, oldVal);
            k1 = cvv1.getKnowledge();
            vals = cvv0.getNewerValues(k1);
            k0 = cvv0.getKnowledge();
            cvv1.merge(k0, vals);
            cvv1.get(key).should.equal(oldVal);
            cvv1.latestVersion().should.equal(0);
            cvv1.getKnowledge().should.eql(k0);
            cvv1.getKnowledge().len.should.equal(1);

            setTimeout(function() {

                cvv1.put(key, updatedVal);
                cvv1.merge(k0, vals);

                cvv1.get(key).should.equal(updatedVal);
                cvv1.getVsn(key)[0].should.equal('id-1');
                cvv1.getVsn(key)[1].should.not.equal(k0.map['id-0']);
                cvv1.getVsn(key)[1].should.equal(cvv1.latestVersion());
                cvv1.getKnowledge().len.should.equal(2);

                done();
            }, 10);
        });

        it('should ignore new-value when the version is old vs local-knowledge', function(done) {

            var cvv0 = new ContextualVV('id-0'),
                cvv1 = new ContextualVV('id-1'),
                key = 'some-key',
                oldVal = 'old-test-val',
                updatedVal = 'awesome-test-val',
                oldVals,
                newVals,
                oldKnow,
                newKnow,
                k1;

            cvv0.put(key, oldVal);
            k1 = cvv1.getKnowledge();
            oldVals = cvv0.getNewerValues(k1);
            oldKnow = cvv0.getKnowledge();

            setTimeout(function() {

                cvv0.put(key, updatedVal);

                k1 = cvv1.getKnowledge();
                newVals = cvv0.getNewerValues(k1);
                newKnow = cvv0.getKnowledge();

                cvv1.merge(newKnow, newVals);
                cvv1.get(key).should.be.equal(updatedVal);

                cvv1.merge(oldKnow, oldVals);
                cvv1.get(key).should.be.equal(updatedVal);
                done();
            }, 10);
        });

        describe('the version of new-value is new relative to local-knowledge', function() {

            it('should keep new-value when local-value is old vs `knowledge`', function(done) {

                var cvv0 = new ContextualVV('id-0'),
                    cvv1 = new ContextualVV('id-1'),
                    key = 'some-key',
                    oldVal = 'old-test-val',
                    updatedVal = 'awesome-test-val',
                    oldVals,
                    newVals,
                    oldKnow,
                    newKnow,
                    k1;

                cvv0.put(key, oldVal);
                k1 = cvv1.getKnowledge();
                oldVals = cvv0.getNewerValues(k1);
                oldKnow = cvv0.getKnowledge();

                cvv1.merge(oldKnow, oldVals);
                cvv1.get(key).should.be.equal(oldVal);

                setTimeout(function() {

                    cvv0.put(key, updatedVal);

                    k1 = cvv1.getKnowledge();
                    newVals = cvv0.getNewerValues(k1);
                    newKnow = cvv0.getKnowledge();

                    cvv1.merge(newKnow, newVals);
                    cvv1.get(key).should.be.equal(updatedVal);
                    done();
                }, 10);
            });

            describe('the version of local-value is new vs `knowledge` (in conflict)', function() {

                it('should keep new-value when it has a higher version number', function(done) {

                    var cvv0 = new ContextualVV('id-0'),
                        cvv1 = new ContextualVV('id-1'),
                        key = 'some-key',
                        val0 = 'old-test-val',
                        val1 = 'awesome-test-val',
                        vals,
                        k,
                        vsn;

                    cvv1.put(key, val0);
                    k = cvv1.getKnowledge();

                    setTimeout(function() {

                        cvv0.put(key, val1);

                        vals = cvv0.getNewerValues(k);
                        k = cvv0.getKnowledge();

                        cvv1.merge(k, vals);

                        vsn = cvv0.latestVersion();
                        cvv1.getVsn(key).should.eql(['id-0', vsn]);
                        cvv1.get(key).should.be.equal(val1);

                        done();
                    }, 10);
                });

                it('should keep local-value when it has a higher version number', function(done) {

                    var cvv0 = new ContextualVV('id-0'),
                        cvv1 = new ContextualVV('id-1'),
                        key = 'some-key',
                        val0 = 'old-test-val',
                        val1 = 'awesome-test-val',
                        vals,
                        k,
                        vsn;

                    cvv0.put(key, val0);
                    k = cvv1.getKnowledge();
                    vals = cvv0.getNewerValues(k);
                    k = cvv0.getKnowledge();

                    setTimeout(function() {

                        cvv1.put(key, val1);
                        cvv1.merge(k, vals);

                        vsn = cvv1.latestVersion();
                        cvv1.getVsn(key).should.eql(['id-1', vsn]);
                        cvv1.get(key).should.be.equal(val1);

                        done();
                    }, 10);
                });
            });
        });
    });

    describe('#compare(knowledge) - `knowledge` belongs to a remote-CVV', function() {

        describe('`knowledge` is equavalent to local knowledge', function() {

            it('should return `undefined`', function() {

                var cvv,
                    k;

                cvv = new ContextualVV('id');

                k = _.cloneDeep(cvv.getKnowledge());
                assert(cvv.compare(k) === undefined);

                cvv.put('key', 'any-value');
                k = _.cloneDeep(cvv.getKnowledge());
                assert(cvv.compare(k) === undefined);
            });
        });

        describe('`knowledge` only has older versions', function() {

            describe('there are no new local values the remote-CVV needs', function() {

                var cvvSetter,
                    cvvLocal,
                    cvvRemote,
                    k,
                    vals,
                    result;

                before(function(done) {

                    cvvSetter = new ContextualVV('a');
                    cvvLocal = new ContextualVV('b');
                    cvvRemote = new ContextualVV('c');

                    cvvLocal.put('key', 0);

                    setTimeout(function() {

                        cvvSetter.put('key', 1);
                        k = cvvSetter.getKnowledge();
                        vals = cvvSetter.getNewerValues();

                        // lww should cause cvvLocal value for 'key' to be overwritten
                        cvvLocal.merge(k, vals);
                        // some extra checks (prob shouldn't be here...)
                        cvvLocal.get('key').should.equal(1);
                        cvvLocal.getVsn('key').should.eql(['a', k.map.a]);
                        cvvLocal.getKnowledge('a').should.equal(k.map.a);
                        cvvLocal.getKnowledge().len.should.equal(2);
                        // cvvRemote should integrate cvvSetter's value for 'key'
                        cvvRemote.merge(k, vals);
                        cvvRemote.get('key').should.equal(1);
                        cvvRemote.getKnowledge('a').should.equal(k.map.a);
                        cvvRemote.getKnowledge().len.should.equal(1);

                        // k should indicate knowledge of cvvSetter
                        k = cvvRemote.getKnowledge();
                        // result should have a knowledge update, but not a value update
                        result = cvvLocal.compare(k);

                        done();
                    }, 10);
                });

                it('should return an object with `k` local knowledge', function() {
                    result.k.should.eql(cvvLocal.getKnowledge());
                });
                it('should return an object with `containsUpdate` is `true`', function() {
                    assert(result.containsUpdate === true);
                });
                it('should return an object without a `values` property', function() {
                    assert(result.values === undefined);
                });
                it('should return an object without a `requiresUpdate` property', function() {
                    assert(result.requiresUpdate === undefined);
                });
            });

            describe('there are new local values the remote-CVV needs', function() {

                var cvvLocal,
                    cvvRemote,
                    k,
                    vals,
                    result;

                before(function() {

                    cvvLocal = new ContextualVV('a');
                    cvvRemote = new ContextualVV('b');

                    cvvLocal.put('key', 0);
                    k = cvvLocal.getKnowledge();
                    vals = cvvLocal.getNewerValues();

                    cvvRemote.merge(k, vals);
                    k = cvvRemote.getKnowledge();

                    cvvLocal.put('key', 1);
                    result = cvvLocal.compare(k);
                });

                it('should return an object with: `k` is local knowledge', function() {
                    result.k.should.eql(cvvLocal.getKnowledge());
                });
                it('should return an object with: `containsUpdate` is `true`', function() {
                    assert(result.containsUpdate === true);
                });
                it('should return an object with: `values` is an `Array` of the local values the remote-CVV needs', function() {
                    result.values.should.eql([['key', 1, 'a', cvvLocal.latestVersion()]]);
                });
                it('should return an object without a `requiresUpdate` property', function() {
                    assert(result.requiresUpdate === undefined);
                });
            });
        });

        describe('`knowledge` only has newer versions', function() {

            describe('local knowledge is empty', function() {

                var cvvLocal,
                    cvvRemote,
                    k,
                    vals,
                    result;

                before(function() {

                    cvvLocal = new ContextualVV('a');
                    cvvRemote = new ContextualVV('b');

                    cvvRemote.put('key', 0);
                    k = cvvRemote.getKnowledge();
                    result = cvvLocal.compare(k);
                });

                it('should return an object with: `k` is local knowledge', function() {
                    assert(result.k === cvvLocal.getKnowledge());
                });
                it('should return an object with: `requiresUpdate` is `true`', function() {
                    assert(result.requiresUpdate === true);
                });
                it('should return an object without a `containsUpdate` property', function() {
                    assert(result.containsUpdate === undefined);
                });
                it('should return an object without a `values` property', function() {
                    assert(result.values === undefined);
                });
            });

            describe('`knowledge` and the local knowledge have some versions in common', function() {

                var cvvLocal,
                    cvvRemote,
                    k,
                    vals,
                    result;

                before(function() {

                    cvvLocal = new ContextualVV('a');
                    cvvRemote = new ContextualVV('b');

                    cvvLocal.put('key-0', true);
                    cvvRemote.merge(cvvLocal.getKnowledge(), cvvLocal.getNewerValues());

                    cvvRemote.put('key-1', true);
                    result = cvvLocal.compare(cvvRemote.getKnowledge());
                });

                it('should return an object with: `k` is local knowledge', function() {
                    result.k.should.eql(cvvLocal.getKnowledge());
                });
                it('should return an object with: `requiresUpdate` is `true`', function() {
                    assert(result.requiresUpdate === true);
                });
                it('should return an object without a `containsUpdate` property', function() {
                    assert(result.containsUpdate === undefined);
                });
                it('should return an object without a `values` property', function() {
                    assert(result.values === undefined);
                });
            });
        });

        describe('`knowledge` has both newer versions and older versions', function() {

            describe('there are no new local values the remote-CVV needs', function() {

                var cvvLocal,
                    cvvMiddle,
                    cvvRemote,
                    k,
                    vals,
                    result;

                before(function(done) {

                    cvvLocal = new ContextualVV('a');
                    cvvMiddle = new ContextualVV('b');
                    cvvRemote = new ContextualVV('c');

                    // old knowledge remote has
                    cvvLocal.put('key-0', 0);
                    k = cvvLocal.getKnowledge();
                    vals = cvvLocal.getNewerValues();
                    cvvRemote.merge(k, vals);

                    // update local version
                    cvvLocal.put('key-0', 1);

                    // new knowledge remote has
                    cvvRemote.put('key-1', true);

                    setTimeout(function() {

                        // overwrites local version, therefore no new value to share
                        cvvMiddle.put('key-0', 2);
                        k = cvvMiddle.getKnowledge();
                        vals = cvvMiddle.getNewerValues();
                        cvvLocal.merge(k, vals);
                        cvvRemote.merge(k, vals);

                        k = cvvRemote.getKnowledge();
                        result = cvvLocal.compare(k);

                        done();
                    }, 10);
                });

                it('should return an object with: `k` is local knowledge', function() {
                    result.k.should.eql(cvvLocal.getKnowledge());
                });
                it('should return an object with: `requiresUpdate` is `true`', function() {
                    assert(result.requiresUpdate === true);
                });
                it('should return an object with: `containsUpdate` is `true`', function() {
                    assert(result.containsUpdate === true);
                });
                it('should return an object without a `values` property', function() {
                    assert(result.values === undefined);
                });
            });

            describe('there are new local values the remote-CVV needs', function() {

                var cvvLocal,
                    cvvRemote,
                    k,
                    vals,
                    result;

                before(function() {

                    cvvLocal = new ContextualVV('a');
                    cvvRemote = new ContextualVV('b');

                    // old knowledge remote has
                    cvvLocal.put('key-0', 0);
                    k = cvvLocal.getKnowledge();
                    vals = cvvLocal.getNewerValues();
                    cvvRemote.merge(k, vals);

                    // udpated local version
                    cvvLocal.put('key-0', 1);

                    // new knowledge remote has
                    cvvRemote.put('key-1', true);

                    k = cvvRemote.getKnowledge();
                    result = cvvLocal.compare(k);
                });

                it('should return an object with: `k` is local knowledge', function() {
                    result.k.should.eql(cvvLocal.getKnowledge());
                });
                it('should return an object with: `requiresUpdate` is `true`', function() {
                    assert(result.requiresUpdate === true);
                });
                it('should return an object with: `containsUpdate` is `true`', function() {
                    assert(result.containsUpdate === true);
                });
                it('should return an object with: `values` is an `Array` of the local values the remote-CVV needs', function() {
                    result.values.should.eql([['key-0', 1, 'a', cvvLocal.latestVersion()]]);
                });
            });
        });
    });
});
