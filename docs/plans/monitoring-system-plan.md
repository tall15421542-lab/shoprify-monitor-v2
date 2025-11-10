## Monitoring System Plan

- Allow users to create subscriptions for `product`, `store`, `product_type`, and `store + product_type`.
- Assume a single user profile and keep subscription ownership implicit.
- Store subscription definitions with entity scope, time interval, and change type fields.
- Extend the polling service to evaluate `product` subscriptions immediately during snapshot collection and attach the relevant snapshot identifiers to change-log entries.
- Reuse `hourly_*` aggregation tables to fetch comparable values for compound scopes and avoid mixing raw variant prices with aggregated metrics.
- For compound scopes, detect changes when computing aggregated metrics so that the “current” value exists, matching averages such as store or product type instead of single variant prices.
- Example: for `store + product_type` with a two-hour interval, compare the current aggregated average price against the latest average before `now - 2h` to decide on change-log entries.
- Write detected price changes into a change log collection with references to the subscription and supporting data: raw product snapshots for product-level monitors or aggregated `hourly_*` records for compound scopes.
- Track read status and increment unread counters when new change log entries appear, updating both within a transaction for consistency.
- Provide API endpoints to manage subscriptions, list change logs, and mark entries as read.
- Update the frontend dashboard with subscription management UI, unread counts, and filtered change log views.
- Design subscription evaluation and change log schema to support additional metrics and entities in future iterations.

