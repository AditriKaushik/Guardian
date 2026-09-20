import pytest
from guardian.hub import HubState
from guardian.monitor import ConsentError

CONFIG = {
    "members": [
        {"id": "dad", "name": "David", "role": "parent", "token": "T-dad", "consents": ["locate"]},
        {"id": "sam", "name": "Sam", "role": "child", "token": "T-sam", "consents": []},
    ]
}


def new_state(tmp_path=None):
    return HubState(CONFIG, None)


def test_valid_report_is_stored():
    s = new_state()
    entry = s.record_location("dad", "T-dad", 28.61, 77.20)
    assert entry["lat"] == 28.61 and entry["lon"] == 77.20
    snap = {m["id"]: m for m in s.snapshot()}
    assert snap["dad"]["location"]["lon"] == 77.20


def test_bad_token_rejected():
    s = new_state()
    with pytest.raises(PermissionError):
        s.record_location("dad", "WRONG", 1.0, 2.0)


def test_missing_token_rejected():
    s = new_state()
    with pytest.raises(PermissionError):
        s.record_location("dad", "", 1.0, 2.0)


def test_consent_required_even_with_valid_token():
    s = new_state()  # sam has no 'locate' consent
    with pytest.raises(ConsentError):
        s.record_location("sam", "T-sam", 1.0, 2.0)


def test_unknown_member_rejected():
    s = new_state()
    with pytest.raises(KeyError):
        s.record_location("ghost", "x", 1.0, 2.0)


def test_snapshot_lists_all_members_even_without_location():
    s = new_state()
    ids = {m["id"] for m in s.snapshot()}
    assert ids == {"dad", "sam"}


def test_persistence_roundtrip(tmp_path):
    data = tmp_path / "loc.json"
    s1 = HubState(CONFIG, data)
    s1.record_location("dad", "T-dad", 10.0, 20.0)
    # a fresh state pointed at the same file recovers the last location
    s2 = HubState(CONFIG, data)
    snap = {m["id"]: m for m in s2.snapshot()}
    assert snap["dad"]["location"]["lat"] == 10.0
