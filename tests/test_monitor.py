import pytest
from guardian import Guardian, Member, Group, MonitorResult, ConsentError


def test_single_member_with_consent():
    m = Member("a", "Alice").grant("locate")
    g = Guardian().register("locate", lambda mem, mode: (1.0, 2.0))
    r = g.monitor(m, mode="locate")
    assert isinstance(r, MonitorResult)
    assert r.ok and r.data == (1.0, 2.0)


def test_consent_is_enforced_per_mode():
    m = Member("a", "Alice").grant("locate")  # not "listen"
    g = Guardian()
    r = g.monitor(m, mode="listen")
    assert not r.ok
    assert "consent" in r.error.lower()


def test_group_fans_out_and_skips_non_consenters():
    yes = Member("y", "Yes").grant("view")
    no = Member("n", "No")
    grp = Group("g").add(yes, no)
    g = Guardian().register("view", lambda mem, mode: "frame")
    results = g.monitor(grp, mode="view")
    assert len(results) == 2
    by_id = {r.member_id: r for r in results}
    assert by_id["y"].ok
    assert not by_id["n"].ok


def test_missing_backend_returns_stub_not_crash():
    m = Member("a").grant("view")
    r = Guardian().monitor(m, mode="view")
    assert r.ok and r.data.get("stub") is True


def test_backend_error_is_captured_per_member():
    def boom(mem, mode):
        raise RuntimeError("camera offline")
    m = Member("a").grant("view")
    r = Guardian().register("view", boom).monitor(m, mode="view")
    assert not r.ok and "camera offline" in r.error


def test_invalid_mode_rejected():
    with pytest.raises(ValueError):
        Guardian().monitor(Member("a"), mode="teleport")


def test_emergency_override_bypasses_consent():
    m = Member("a", "Alice")  # no consent
    g = Guardian().register("locate", lambda mem, mode: "here")
    r = g.monitor(m, mode="locate", require_consent=False)
    assert r.ok and r.data == "here"
