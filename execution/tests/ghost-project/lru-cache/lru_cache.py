#!/usr/bin/env python3
import sys
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        if not isinstance(capacity, int) or isinstance(capacity, bool):
            raise TypeError("Capacity must be an integer")
        if capacity < 1:
            raise ValueError("Capacity must be at least 1")
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: int) -> int:
        if not isinstance(key, int) or isinstance(key, bool):
            raise TypeError("Key must be an integer")
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if not isinstance(key, int) or isinstance(key, bool):
            raise TypeError("Key must be an integer")
        if not isinstance(value, int) or isinstance(value, bool):
            raise TypeError("Value must be an integer")
        
        if key in self.cache:
            self.cache[key] = value
            self.cache.move_to_end(key)
        else:
            if len(self.cache) >= self.capacity:
                # Evict the least recently used key (first item in OrderedDict)
                self.cache.popitem(last=False)
            self.cache[key] = value

def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    capacity_str = sys.argv[1]
    try:
        capacity = int(capacity_str)
        if capacity < 1:
            sys.exit(1)
    except ValueError:
        sys.exit(1)

    parsed_ops = []
    for op_str in sys.argv[2:]:
        parts = op_str.split(',')
        if len(parts) < 1:
            sys.exit(1)
        
        op_type = parts[0]
        if op_type == 'put':
            if len(parts) != 3:
                sys.exit(1)
            try:
                key = int(parts[1])
                val = int(parts[2])
                parsed_ops.append(('put', key, val))
            except ValueError:
                sys.exit(1)
        elif op_type == 'get':
            if len(parts) != 2:
                sys.exit(1)
            try:
                key = int(parts[1])
                parsed_ops.append(('get', key))
            except ValueError:
                sys.exit(1)
        else:
            sys.exit(1)

    # Initialize cache and execute operations
    cache = LRUCache(capacity)
    for op in parsed_ops:
        if op[0] == 'put':
            cache.put(op[1], op[2])
        elif op[0] == 'get':
            res = cache.get(op[1])
            print(res)

if __name__ == '__main__':
    main()
