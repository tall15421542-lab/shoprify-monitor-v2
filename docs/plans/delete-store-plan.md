Implement delete store option feature
=====================================

- Identify store status field and existing inactive handling across data layers.
- Update backend APIs to mark stores inactive and hide inactive stores from list responses.
- Adjust polling/aggregator logic so inactive stores skip processing.
- Update frontend store and dashboard pages to omit inactive stores or show inactive badge.
- Add tests plus manual check ensuring inactive store disappears from dashboard/store views.

