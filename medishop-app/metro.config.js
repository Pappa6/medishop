// This file fixes a known compatibility issue between Firebase's library
// structure and React Native's bundler (Metro), which otherwise causes
// the app to crash right after loading with a generic "Something went
// wrong" screen. This one setting resolves it.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
