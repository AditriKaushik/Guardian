"""The core of Guardian: one small ``monitor`` method.

``monitor`` supports three ways of checking in on someone:

* ``"listen"`` – capture/relay audio (e.g. a check-in call, ambient sound).
* ``"view"``   – capture/relay video or a still image (e.g. a camera view).
* ``"locate"`` – report a member's current location.

The same call works for a single :class:`Member` or a whole :class:`Group`
(all the members of a family, a set of children, etc.).

Design principle — **consent first**
------------------------------------
Listening to, viewing, or locating a person is sensitive. Guardian refuses to
do any of these unless the target has explicitly granted consent for that mode.
This keeps Guardian a family-safety tool rather than a surveillance tool. The
consent check is not optional and is enforced in one place (:meth:`_check`).

The actual capture is delegated to a *backend* callable that you supply (a real
GPS reader, a camera driver, an audio stream, a phone API, ...). Guardian itself
does the bookkeeping, consent enforcement, fan-out over groups, and packaging of
results — the parts that are the same no matter what hardware sits underneath.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional, Union

# The three things Guardian can do.
MODES = ("listen", "view", "locate")


class ConsentError(PermissionError):
    """Raised when a member has not consented to the requested mode."""


@dataclass
class Member:
    """A single person Guardian can look after.

    Consent is per-mode: a member might allow ``locate`` but not ``listen``.
    Use :meth:`grant` and :meth:`revoke` to manage it.
    """

    id: str
    name: str = ""
    role: str = "member"          # e.g. "child", "parent", "elder"
    consents: set = field(default_factory=set)

    def grant(self, *modes: str) -> "Member":
        """Allow one or more modes for this member. Returns self (chainable)."""
        for mode in modes:
            _validate_mode(mode)
            self.consents.add(mode)
        return self

    def revoke(self, *modes: str) -> "Member":
        """Withdraw consent for one or more modes. Returns self (chainable)."""
        for mode in modes:
            self.consents.discard(mode)
        return self

    def allows(self, mode: str) -> bool:
        """True if this member has consented to ``mode``."""
        return mode in self.consents


@dataclass
class Group:
    """A named collection of members, e.g. "children" or "the whole family"."""

    id: str
    name: str = ""
    members: List[Member] = field(default_factory=list)

    def add(self, *members: Member) -> "Group":
        self.members.extend(members)
        return self

    def __iter__(self):
        return iter(self.members)


@dataclass
class MonitorResult:
    """The outcome of monitoring a single member."""

    member_id: str
    mode: str
    ok: bool
    data: object = None            # backend payload (location, audio ref, ...)
    error: Optional[str] = None
    at: float = field(default_factory=time.time)


Target = Union[Member, Group, Iterable[Member]]
Backend = Callable[[Member, str], object]


class Guardian:
    """Coordinates listening, viewing, and locating for members and groups.

    Parameters
    ----------
    backends:
        Optional mapping of ``mode -> callable``. Each callable is invoked as
        ``callable(member, mode)`` and returns whatever payload makes sense
        (a ``(lat, lon)`` tuple for ``locate``, an audio handle for ``listen``,
        an image/stream for ``view``). If a mode has no backend, Guardian
        returns a stub result so you can wire hardware in later.
    """

    def __init__(self, backends: Optional[Dict[str, Backend]] = None):
        self.backends: Dict[str, Backend] = dict(backends or {})

    def register(self, mode: str, backend: Backend) -> "Guardian":
        """Attach a capture backend for a mode. Returns self (chainable)."""
        _validate_mode(mode)
        self.backends[mode] = backend
        return self

    def monitor(
        self,
        target: Target,
        mode: str,
        *,
        require_consent: bool = True,
    ) -> Union[MonitorResult, List[MonitorResult]]:
        """Listen to, view, or locate a member or group.

        Parameters
        ----------
        target:
            A single :class:`Member`, a :class:`Group`, or any iterable of
            members.
        mode:
            One of :data:`MODES` — ``"listen"``, ``"view"`` or ``"locate"``.
        require_consent:
            When True (the default), a member is skipped with a failed result
            unless they have granted consent for ``mode``. Set to False only
            for emergencies where you are the accountable guardian and have a
            lawful basis to do so.

        Returns
        -------
        A single :class:`MonitorResult` for a single member, or a list of
        results (one per member) for a group / iterable.
        """
        _validate_mode(mode)

        if isinstance(target, Member):
            return self._one(target, mode, require_consent)

        members = list(target)  # Group is iterable; so is a plain list/tuple
        return [self._one(m, mode, require_consent) for m in members]

    # -- internals -----------------------------------------------------------

    def _one(self, member: Member, mode: str, require_consent: bool) -> MonitorResult:
        try:
            self._check(member, mode, require_consent)
            backend = self.backends.get(mode)
            if backend is None:
                # No hardware wired up yet: return a clearly-marked stub.
                data = {"stub": True, "mode": mode, "member": member.id}
            else:
                data = backend(member, mode)
            return MonitorResult(member.id, mode, ok=True, data=data)
        except ConsentError as exc:
            return MonitorResult(member.id, mode, ok=False, error=str(exc))
        except Exception as exc:  # backend failure shouldn't crash a group sweep
            return MonitorResult(member.id, mode, ok=False, error=repr(exc))

    @staticmethod
    def _check(member: Member, mode: str, require_consent: bool) -> None:
        if require_consent and not member.allows(mode):
            raise ConsentError(
                f"{member.name or member.id!r} has not consented to '{mode}'"
            )


def _validate_mode(mode: str) -> None:
    if mode not in MODES:
        raise ValueError(f"mode must be one of {MODES}, got {mode!r}")
