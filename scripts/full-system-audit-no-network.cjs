globalThis.fetch = async () => { throw new Error('External network disabled for full-system isolated tests'); };
for (const name of ['node:http','node:https']) {
  const transport = require(name);
  transport.request = transport.get = () => { throw new Error('External network disabled for full-system isolated tests'); };
}
