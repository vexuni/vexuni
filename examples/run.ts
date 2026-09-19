import { Vexuni } from "../sdk/index";
import {
  memory,
  sessions,
  checkpoints,
  liveDiff,
  productFiles,
  parallelAttempts,
  review,
} from "./workflows";
const workflows = {
  memory,
  sessions,
  checkpoints,
  productFiles,
  parallelAttempts,
  review,
};
const name = process.argv[2];
if (!name || !(name in workflows || name === "liveDiff"))
  throw Error(
    "Choose: memory, sessions, checkpoints, liveDiff, productFiles, parallelAttempts, review",
  );
const origin = process.env.VEXUNI_ORIGIN,
  token = process.env.VEXUNI_TOKEN,
  target = process.env.VEXUNI_REPO;
if (!origin || !token || !target)
  throw Error(
    "Set VEXUNI_ORIGIN, VEXUNI_TOKEN and VEXUNI_REPO=namespace/name",
  );
const [namespace, ...segments] = target.split("/"),
  repoName = segments.join("/");
if (!namespace || !repoName) throw Error("Expected namespace/name");
const repo = new Vexuni({ origin, token }).repo(namespace, repoName);
if (name === "liveDiff") {
  const current = await repo.get();
  for await (const diff of liveDiff(repo, { branch: current.default_branch }))
    console.log(JSON.stringify(diff));
} else
  console.log(
    JSON.stringify(
      await workflows[name as keyof typeof workflows](repo),
      null,
      2,
    ),
  );
