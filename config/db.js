var Path = require("path");
var Promise = require('bluebird');
var Pg = require("pg");
var Config = require(Path.join(__dirname, "./defaults"));

var Pgp = require('pg-promise')({
    promiseLib: Promise
});

var Db = Pgp(Config.pg);

module.exports = Db;
