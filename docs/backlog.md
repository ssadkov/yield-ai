# Backlog

## Tasks

- [ ] Unify protocol position fetching through `walletStore` (Variant A)
  - Goal: eliminate duplicate `userPositions` requests coming from `walletStore`, `Sidebar`, and `MobileTabs`.
  - Approach: keep `walletStore.fetchPositions()` as the single data source and pass protocol positions from the store into protocol `PositionsList` components.
  - Scope:
    - Add optional `positions` props to protocol `PositionsList` components.
    - When `positions` prop is provided, render from store data and skip internal `fetch()` calls.
    - Keep the current internal fetch logic only as a fallback for standalone pages or contexts that do not provide store data.
    - Update `Sidebar` and `MobileTabs` to read protocol positions from `walletStore` and pass them down.
  - Expected result:
    - One `userPositions` request per protocol instead of duplicated requests from multiple mounted components.
    - `ClaimAllRewardsModal` and reward aggregation continue to use the same store-backed source of truth.
