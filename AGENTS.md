# Architecture Rules

- Permission diagnostics use one shared reactive service; consumers subscribe and lifecycle events trigger refreshes because duplicate native reads can create event-feedback loops.