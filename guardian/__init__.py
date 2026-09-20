"""Guardian: a small, consent-first toolkit for keeping track of loved ones.

The public surface is intentionally tiny:

    from guardian import Guardian, Member, Group

    alice = Member("alice", "Alice")
    alice.grant("locate")                 # Alice opts in to being located
    g = Guardian()
    result = g.monitor(alice, mode="locate")

See ``guardian.monitor.Guardian.monitor`` for the one method that does the work.
"""

from .monitor import Guardian, Member, Group, MonitorResult, ConsentError, MODES

__all__ = [
    "Guardian",
    "Member",
    "Group",
    "MonitorResult",
    "ConsentError",
    "MODES",
]

__version__ = "0.1.0"
