-- Fork counts and fork lineage filter repositories by fork_source, but most
-- rows are not forks — a partial index keeps the lookup tiny.
CREATE INDEX repos_fork_source ON repositories(fork_source) WHERE fork_source IS NOT NULL;
