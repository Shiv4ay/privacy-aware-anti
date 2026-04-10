# Gevent monkey-patch must happen before any ssl/urllib3 imports.
# Without this, locust's gevent monkey-patching conflicts with pytest's
# assertion rewriter and raises RecursionError on Python 3.12+.
import gevent.monkey
gevent.monkey.patch_all()
