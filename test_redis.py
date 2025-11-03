import redis

try:
    r = redis.Redis(host="localhost", port=6379, db=0)
    print("PING ->", r.ping())  # Should print True if Redis is running
except Exception as e:
    print("Error:", e)
