//wrapper to normalize api for mysql, and sqlite-3 database access
var _ = require('underscore');

var extractQueryType = function (statement) {
    return statement.split(' ')[0].toUpperCase();
};

var getCallback = function (args) {
    return (_.isFunction(args[1]) ? args[1] : args[2]) || function () {};
};

//returns an array of given length,
//with all values initialized to the given value
var pad = function (length, value) {
    var i, array = [];
    for(i = 0; i < length; i += 1) {
        array[i] = value;
    }
    return array;
};


var baseStrategy = (function () {
    var equalsToSql = function (whereEqualsKeys) {
            return _.map(whereEqualsKeys, function (key) {
                return key + ' = ?';
            }).join(', ');
        },
        select = function (context, table, whereEquals, callback) {
            context.query(
                "SELECT * FROM " + table + " WHERE " + equalsToSql(_.keys(whereEquals)),
                _.values(whereEquals),
                callback
            );
        };

    return {
        one: function (statement, a, b) {
            var callback = getCallback(arguments);
            a = _.isFunction(a) ? [] : a;
            this.query(statement, a, function (err, rows) {
                callback(err, rows ? rows[0] : []);
            });
        },
        select: function (table, whereEquals, callback) {
            select(this, table, whereEquals, callback);
        },
        selectOne: function (table, whereEquals, callback) {
            select(this, table, whereEquals, function (err, rows) {
                callback(err, rows ? rows[0] : []);
            });
        },
        insert: function (table, values, callback) {
            this.query(
                'INSERT INTO ' + table + '(' + _.keys(values).join(', ') + ') ' +
                'VALUES (' + pad(_.values(values).length, '?').join(', ') + ')',
                _.values(values),
                callback
            );
        },
        update: function (table, values, whereEquals, callback) {
            this.query(
                'UPDATE ' + table + ' SET ' + equalsToSql(_.keys(values)) + ' ' +
                'WHERE ' + equalsToSql(_.keys(whereEquals)),
                _.values(values).concat(_.values(whereEquals)),
                callback
            );
        },
        delete: function (table, whereEquals, callback) {
            this.query(
                'DELETE FROM ' + table + ' WHERE ' + equalsToSql(_.keys(whereEquals)),
                _.values(whereEquals),
                callback
            );
        }
    };
}());

exports.createMySqlStrategy = function (connection) {
    'use strict';
    var that = Object.create(baseStrategy);

    that.query = function (statement, a, b) {

        var callback = getCallback(arguments),
            query = _.bind(connection.query, connection, statement, a),
            defaultQuery = _.partial(query, callback);

        a = _.isFunction(a) ? [] : a;

        switch(extractQueryType(statement)) {
            case 'SELECT':
                defaultQuery();
                break;
            case 'INSERT':
                query(function (err, response) {
                    callback(err, err ? undefined : response.insertId);
                });
                break;
            case 'UPDATE':
                defaultQuery();
                break;
            case 'DELETE':
                defaultQuery();
                break;
            default:
                throw 'Invalid Query Type';
        }
    };

    return that;
};


exports.createSqliteStrategy = function (connection) {
    'use strict';
    var that = Object.create(baseStrategy);

    that.query = function (statement, a, b) {
        var callback = getCallback(arguments),
            query = _.bind(connection.run, connection, statement, a),
            defaultQuery = _.partial(query, callback);

        a = _.isFunction(a) ? [] : a;

        switch(extractQueryType(statement)) {
            case 'SELECT':
                connection.all(statement, a, callback);
                break;
            case 'INSERT':
                query(function (err) {
                    callback(err, this.lastID);
                });
                break;
            case 'UPDATE':
                defaultQuery();
                break;
            case 'DELETE':
                defaultQuery();
                break;
            default:
                throw 'Invalid Query Type';
        }
    };

    return that;
};
