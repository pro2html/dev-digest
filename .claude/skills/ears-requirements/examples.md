# EARS examples (good / bad)

All good rows follow DevDigest language: Ukrainian trigger, English `the system shall`.

## Vague vs observable

**Bad**

```
AC-01: The blast map should feel fast and intuitive.
```

**Good**

```
AC-01: КОЛИ the user requests a blast map for a PR with a complete index, the system shall return status "ok" and the graph derived only from index facts.
```

## Compound vs atomic

**Bad**

```
AC-02: КОЛИ the index is incomplete, the system shall show a warning, hide the graph, and email the workspace owner.
```

**Good** (split; drop undiscussed behaviour into Open questions)

```
AC-02: КОЛИ the repo index is incomplete, the system shall return status "partial" or "degraded" with an explicit reason.
AC-03: ПОКИ status is "partial" or "degraded", the system shall still return the nodes and edges that the index can prove.
```

## Implementation leak vs contract

**Bad**

```
AC-04: КОЛИ GET /pulls/:id/blast runs, BlastService shall call repoIntel.getBlastRadius and slice callers in callers.ts.
```

**Good**

```
AC-04: КОЛИ a workspace member requests blast data for a pull, the system shall include at most 20 callers per changed symbol, excluding the declaration file.
```

## Unwanted event

**Bad**

```
AC-05: ЯКЩО something goes wrong, ТОДІ the system shall handle it nicely.
```

**Good**

```
AC-05: ЯКЩО the caller is not a member of the pull's workspace, ТОДІ the system shall reject the request without returning blast nodes.
```

## Optional feature (`ДЕ`)

**Bad**

```
AC-06: ДЕ we have time, the system shall add an LLM summary of the graph.
```

**Good**

```
AC-06: ДЕ an LLM explanation is enabled, the system shall attach one short paragraph that describes the existing graph and shall not invent nodes or edges.
```

## Ubiquitous (always true)

**Bad**

```
AC-07: Secrets should not be stored carelessly.
```

**Good**

```
AC-07: The system shall not persist provider secrets in git or in the database.
```

## MCP contract-level (still behaviour)

**Bad**

```
AC-08: Replace the get_blast_radius stub in mcp/src/tools/get-blast-radius.ts.
```

**Good**

```
AC-08: КОЛИ an MCP client calls get_blast_radius with repo and pull identifiers, the system shall return the same blast payload as the HTTP blast resource for that pull.
```

## Guess vs marker

**Bad** (silent invention presented as fact)

```
AC-09: КОЛИ the index job fails, the system shall retry three times and then email the workspace owner.
```

(retry count and email were never in the brief)

**Good** (default in Assumptions, or a marker)

```
AC-09: ЯКЩО the repo index cannot be built, ТОДІ the system shall return status "degraded" with an explicit reason.

Assumptions:
- Index rebuild policy is whatever the existing indexer already does (no new retry/email behaviour).
```

```
[NEEDS CLARIFICATION: Should a failed index notify the workspace owner, or only surface "degraded" in the pull UI?]
```
