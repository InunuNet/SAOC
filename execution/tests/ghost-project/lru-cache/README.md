# LRU Cache Simulator

A Python 3 implementation of a Least Recently Used (LRU) Cache operating under strict performance and resource constraints, utilizing only the Python Standard Library.

---

## Class Specification

### `LRUCache(capacity: int)`
Initializes the LRU cache with a maximum capacity.

- **Parameters**:
  - `capacity` (`int`): The maximum number of elements the cache can hold. Must be an integer greater than or equal to `1`.
- **Exceptions**:
  - `TypeError`: Raised if `capacity` is not an integer (or if it is a boolean).
  - `ValueError`: Raised if `capacity` is less than `1`.

#### Methods

##### `get(key: int) -> int`
Retrieves the value of the key if it exists in the cache, and moves the key to the most recently used position.
- **Parameters**:
  - `key` (`int`): The key to query. Must be an integer.
- **Returns**:
  - `int`: The value of the key if it exists; `-1` otherwise.
- **Exceptions**:
  - `TypeError`: Raised if `key` is not an integer (or if it is a boolean).
- **Time Complexity**: Average $O(1)$ time complexity.

##### `put(key: int, value: int) -> None`
Updates the value of the key if the key exists, or inserts the key-value pair if it does not. If the cache exceeds its capacity, the least recently used key is evicted.
- **Parameters**:
  - `key` (`int`): The key to insert or update. Must be an integer.
  - `value` (`int`): The value to store. Must be an integer.
- **Exceptions**:
  - `TypeError`: Raised if `key` or `value` is not an integer (or if either is a boolean).
- **Time Complexity**: Average $O(1)$ time complexity.

---

## Usage Example

The following example demonstrates how to use the `LRUCache` class programmatically in Python:

```python
from lru_cache import LRUCache

# Initialize cache with capacity 2
cache = LRUCache(capacity=2)

# Insert keys
cache.put(1, 10)
cache.put(2, 20)

# Retrieve values
print(cache.get(1))  # Returns 10 (moves key 1 to most recently used)

# Evict key 2 (least recently used)
cache.put(3, 30)

print(cache.get(2))  # Returns -1 (evicted)
print(cache.get(3))  # Returns 30
```

---

## CLI Interface

The simulator can be executed directly from the command line:

```bash
python3 lru_cache.py <capacity> <operation1> <operation2> ...
```

### Operations
Operations are passed as positional arguments in the format:
- `put,key,value` (e.g. `put,1,100`)
- `get,key` (e.g. `get,1`)

### Output and Behavior
- A `get` operation prints the retrieved integer value (or `-1` if not found) to `stdout`, followed by a newline.
- A `put` operation prints nothing to stdout.

### CLI Example
```bash
python3 lru_cache.py 2 put,1,10 put,2,20 get,1 put,3,30 get,2 get,3
```
Output:
```
10
-1
30
```

### Exit Codes
- `0`: Success (all arguments and operations parsed successfully).
- `1`: Invalid input or malformed arguments. This includes:
  - Fewer than 3 command-line arguments (i.e. missing capacity or operations).
  - Cache capacity less than `1` or non-integer.
  - Malformed operation formats (e.g. missing commas, incorrect number of fields).
  - Invalid operation types (anything other than `put` or `get`).
  - Non-integer keys or values.

---

## Running Tests

To run the automated test suite, execute the test runner script from the project root:

```bash
bash execution/tests/ghost-project/lru-cache/tests/run_tests.sh
```

The script runs unit tests for the core class API and tests for the CLI behavior, reporting the final result (e.g., `PASS 10/10`).

---

## Implementation Details

- **Dependencies**: Uses the Python Standard Library only (`collections.OrderedDict`). No third-party packages are required.
- **Python Version**: Python 3.8+.
