// Metro config for Expo in a pnpm monorepo.
// Forces a single physical copy of React / react-dom so Metro (which follows
// pnpm symlinks) does not bundle duplicate React instances and trigger
// "Invalid hook call" / "Cannot read properties of null (reading 'useRef')".
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so workspace packages resolve.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Canonical real paths (resolve symlinks) for the singletons.
const realReact = fs.realpathSync(path.resolve(projectRoot, 'node_modules/react'));
const realReactDom = fs.realpathSync(path.resolve(projectRoot, 'node_modules/react-dom'));

const pinnedRoots = [
  ['react-dom', realReactDom],
  ['react', realReact],
];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [name, root] of pinnedRoots) {
    if (moduleName === name) {
      return context.resolveRequest({ ...context, originModulePath: path.join(root, 'index.js') }, name, platform);
    }
    if (moduleName.startsWith(name + '/')) {
      const subPath = moduleName.slice(name.length + 1);
      return { type: 'sourceFile', filePath: require.resolve(path.join(root, subPath)) };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
