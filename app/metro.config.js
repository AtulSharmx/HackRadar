// Lets the app import ../shared (cities.json, match_cases.json), the files the collector also uses.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../shared')];

module.exports = config;
