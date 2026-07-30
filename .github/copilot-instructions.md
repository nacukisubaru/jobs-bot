# Code navigation rules

Before reading any file in full, always use codebase-memory-mcp tools first:

- `get_architecture` — start here for any broad question about the project
- `search_graph` — find functions, classes, methods by name pattern
- `trace_path` — trace call chains (who calls what, depth 1-5)
- `get_code_snippet` — read a specific function body by qualified name
- `detect_changes` — before editing, check blast radius of the change

Only open a file directly (Read) if the graph tool returned insufficient context
or the file is not indexed (e.g. config files, markdown).

Never grep the whole codebase if a graph query can answer the question.
