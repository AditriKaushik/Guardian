import json
from guardian.setup import build_config, main


def test_build_config_has_three_members_with_consents():
    cfg = build_config()
    ids = [m["id"] for m in cfg["members"]]
    assert ids == ["dad", "mom", "kid"]
    kid = next(m for m in cfg["members"] if m["id"] == "kid")
    assert "locate" in kid["consents"] and "view" in kid["consents"]


def test_tokens_are_unique_and_nonempty():
    cfg = build_config()
    tokens = [m["token"] for m in cfg["members"]]
    assert all(len(t) >= 16 for t in tokens)
    assert len(set(tokens)) == len(tokens)  # all different


def test_main_writes_file_and_is_idempotent(tmp_path):
    path = tmp_path / "hub_config.json"
    main(str(path))
    assert path.exists()
    first = json.loads(path.read_text())
    # second run must not overwrite existing tokens
    main(str(path))
    second = json.loads(path.read_text())
    assert first == second
