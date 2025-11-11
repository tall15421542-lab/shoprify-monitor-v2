## Implementation Steps
- Backend: Create a `subscriptions` store with fields for scope, interval, change type, and timestamps.
- Backend: Add subscription creation, listing, update, and delete handlers in the API.
- Data-processing: Extend the poller to load active subscriptions before each snapshot run.
- Data-processing: During snapshot processing, evaluate `product` scope subscriptions by comparing current values with the latest change log that satisfies the interval constraint.
- Data-processing: After aggregating metrics for store, product type, and store plus product type scopes, evaluate subscriptions by comparing the current metric to the latest change-log value that satisfies the subscription interval.
- Data-processing: Write detected differences into the change log, storing current and previous values without snapshot references.
- Backend: On subscription creation, insert an initial change log entry that captures the current baseline value.
- Data-processing: Update unread counters when writing new change log entries.
- Backend: Expose change log polling endpoints that accept a `since` timestamp to return new entries and counters.
- Backend: Handle read acknowledgements by updating change log statuses and unread counters in a single transaction.
- Frontend: Update the dashboard to show subscription management, unread counts, and filtered change views.
- Frontend: On product pages, add a subscribe button for product-type monitoring.
- Frontend: On store pages, add a subscribe button for store-level monitoring.
- Frontend: On the dashboard, add a subscribe action that captures current store and product-type selections and creates combinations for each selected pair.

## Schema
- `subscriptions`: id (uuid), scope_type (enum), scope_key (json), change_type (enum: `price_up`, `price_down`, `both`), created_at, updated_at.
- `change_logs`: id (uuid), subscription_id (uuid fk), current_value (decimal), previous_value (decimal), detected_at, read_at, is_baseline (boolean).
- `change_read_counters`: id (uuid), subscription_id (uuid fk), unread_count (int), updated_at.
- Maintain indexes on `subscriptions.scope_type`, `subscriptions.scope_key`, and `change_logs.subscription_id`.

## API Contract
- `POST /api/subscriptions` creates a subscription. Request needs scope, change type, and interval. Response returns the created subscription.
- `GET /api/subscriptions` lists subscriptions. Response returns an array of subscriptions.
- `PATCH /api/subscriptions/{id}` updates a subscription. Request needs updated scope, change type, or interval. Response returns the updated subscription.
- `DELETE /api/subscriptions/{id}` removes a subscription. Response confirms deletion.
- `GET /api/change-logs` lists change entries filtered by subscription, scope, read state, or `since` timestamp to support polling for new updates. Response returns entries with pagination metadata and unread counters.
- `POST /api/change-logs/mark-read` marks change entries as read by ids and updates counters within one transaction. Response returns the updated entry ids and new unread totals.

