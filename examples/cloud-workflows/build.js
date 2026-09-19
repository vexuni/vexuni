export default async ({ sha }) => ({
  logs: ["Built " + sha],
  artifacts: {
    "index.html": `<!doctype html><meta charset="utf-8"><title>vexuni Workflow</title><h1>Built on Cloudflare</h1><p>Commit ${sha}</p>`,
  },
});
