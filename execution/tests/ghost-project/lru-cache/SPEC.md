# LRU Cache Simulator

A Python 3 implementation of a Least Recently Used (LRU) Cache operating under strict performance and resource constraints.

## Class Specification

### `LRUCache(capacity: int)`
Initializes the LRU cache with positive size `capacity`.

#### Methods
- `get(key: int) -> int`:
  Return the value of the `key` if the key exists, otherwise return `-1`.
- `put(key: int, value: int) -> None`:
  Update the value of the `key` if the `key` exists. Otherwise, add the `key-value` pair to the cache. If the number of keys exceeds the `capacity` from this operation, evict the least recently used key.

### Constraints
- **Time Complexity**: Average $O(1)$ time complexity for both `get` and `put` operations.
- **Dependencies**: No imports beyond the Python Standard Library (stdlib).
- **Domain**: Cache capacity is $\ge 1$. Keys and values are integers.

---

## CLI Interface

The simulator must support execution directly from the command line:

```bash
python3 lru_cache.py <capacity> <operation1> <operation2> ...
```

### Operations
Operations are passed as positional arguments in the format:
- `put,key,value` (e.g. `put,1,100`)
- `get,key` (e.g. `get,1`)

### Output and Behavior
- A `get` operation must print the retrieved integer (or `-1` if the key is missing) to `stdout` followed by a newline.
- A `put` operation prints nothing to stdout.
- On any invalid input (such as capacity $< 1$, non-integer arguments, malformed operations, or wrong number of arguments), the CLI must exit with status `1`.
